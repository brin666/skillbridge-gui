import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { api, asError, WorkspaceError } from "./api";
import { CartSession } from "./cartSession";
import type {
  Asset,
  Cart,
  CartPreview,
  Environment,
  ExportIntent,
  ExportJob,
  PackageRecord,
  Preference,
  Report,
  Status,
} from "./types";

function readLocal(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* The server remains the source of truth; drafts can be chosen from its list. */
  }
}
export const environmentScope = (env: Environment) =>
  `harness:${encodeURIComponent((env.harness || "unknown").trim().toLowerCase())}:agent:${encodeURIComponent((env.agent || "default").trim().toLowerCase())}`;
export function useWorkspace() {
  const [session] = useState(() => new CartSession(api));
  const cartState = useSyncExternalStore(session.subscribe, session.snapshot);
  const [status, setStatus] = useState<Status | null>(null);
  const [connected, setConnected] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [scope, setScope] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<
    Array<{ area: string; error: WorkspaceError }>
  >([]);
  const [error, setError] = useState<WorkspaceError | null>(null);
  const [preview, setPreview] = useState<CartPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [intent, setIntent] = useState<ExportIntent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pollError, setPollError] = useState<WorkspaceError | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [busyPreferences, setBusyPreferences] = useState<string[]>([]);
  const preferenceLocks = useRef(new Set<string>());
  const loadGeneration = useRef(0);
  const creation = useRef<Promise<Cart> | null>(null);
  const switching = useRef(false);
  const restoredHome = useRef("");
  const exportLock = useRef(false);
  const intentRef = useRef<ExportIntent | null>(null);
  const profileKey = status?.dataHome || "";
  const rememberIntent = useCallback(
    (value: ExportIntent | null) => {
      intentRef.current = value;
      setIntent(value);
      if (profileKey)
        writeLocal(
          `skillbridge.export:${profileKey}`,
          value ? JSON.stringify(value) : null,
        );
    },
    [profileKey],
  );

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const nextStatus = await api.status();
      if (generation !== loadGeneration.current) return;
      if (
        restoredHome.current &&
        restoredHome.current !== nextStatus.dataHome
      ) {
        session.invalidate();
        setAssets([]);
        setEnvironments([]);
        setPreferences([]);
        setReports([]);
        setCarts([]);
        setPackages([]);
        setPreview(null);
        setJob(null);
        setIntent(null);
        intentRef.current = null;
        setStatus(nextStatus);
        throw new WorkspaceError({ code: "PROFILE_CHANGED" });
      }
      const results = await Promise.allSettled([
        api.assets(scope),
        api.environments(),
        api.preferences(),
        api.reports(),
        api.carts(),
        api.packages(),
        api.exports(),
      ] as const);
      if (generation !== loadGeneration.current) return;
      setStatus(nextStatus);
      setConnected(true);
      setError((old) => (old?.code === "NETWORK_ERROR" ? null : old));
      const areas = [
        "资料列表",
        "环境",
        "常用偏好",
        "Agent 报告",
        "交接包草稿",
        "交接历史",
        "导出任务",
      ];
      setIssues(
        results.flatMap((result, index) =>
          result.status === "rejected"
            ? [{ area: areas[index], error: asError(result.reason) }]
            : [],
        ),
      );
      setAssets(results[0].status === "fulfilled" ? results[0].value : []);
      setEnvironments(
        results[1].status === "fulfilled" ? results[1].value : [],
      );
      setPreferences(results[2].status === "fulfilled" ? results[2].value : []);
      setReports(results[3].status === "fulfilled" ? results[3].value : []);
      setPackages(results[5].status === "fulfilled" ? results[5].value : []);
      if (results[4].status === "rejected") setCarts([]);
      if (results[4].status === "fulfilled") {
        const available = [...results[4].value].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        );
        setCarts(available);
        if (restoredHome.current !== nextStatus.dataHome) {
          restoredHome.current = nextStatus.dataHome;
          const savedId = readLocal(`skillbridge.cart:${nextStatus.dataHome}`);
          let savedIntent: ExportIntent | null = null;
          try {
            savedIntent = JSON.parse(
              readLocal(`skillbridge.export:${nextStatus.dataHome}`) || "null",
            ) as ExportIntent | null;
            if (
              savedIntent &&
              (!savedIntent.requestId ||
                !savedIntent.cartId ||
                !Number.isInteger(savedIntent.expectedVersion))
            )
              savedIntent = null;
          } catch {
            savedIntent = null;
          }
          const jobs =
            results[6].status === "fulfilled" ? results[6].value : [];
          const matchingJob = savedIntent
            ? jobs.find((j) => j.requestId === savedIntent?.requestId)
            : jobs.find(
                (j) =>
                  j.cartId === (savedId || available[0]?.id) &&
                  j.status === "running",
              );
          const active =
            available.find(
              (c) =>
                c.id ===
                (matchingJob?.cartId || savedIntent?.cartId || savedId),
            ) ||
            available[0] ||
            null;
          session.setCart(active);
          if (matchingJob) {
            setJob(matchingJob);
            if (matchingJob.status === "running")
              savedIntent = {
                cartId: matchingJob.cartId,
                expectedVersion: matchingJob.cartVersion,
                requestId: matchingJob.requestId,
                jobId: matchingJob.id,
              };
            else savedIntent = null;
          }
          intentRef.current = savedIntent;
          setIntent(savedIntent);
          session.lock(!!savedIntent || matchingJob?.status === "running");
          if (!savedIntent)
            writeLocal(`skillbridge.export:${nextStatus.dataHome}`, null);
        }
      }
    } catch (failure) {
      if (generation === loadGeneration.current) {
        setConnected(false);
        setError(asError(failure));
      }
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [scope, session]);
  useEffect(() => {
    void load();
    return () => {
      loadGeneration.current++;
    };
  }, [load]);
  useEffect(() => {
    if (profileKey && cartState.cart)
      writeLocal(`skillbridge.cart:${profileKey}`, cartState.cart.id);
  }, [profileKey, cartState.cart?.id]);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api.job(job!.id);
        if (disposed) return;
        setJob(next);
        setPollError(null);
        if (next.status !== "running") {
          rememberIntent(null);
          session.lock(false);
          void api
            .packages()
            .then(setPackages)
            .catch((e) => setError(asError(e)));
          return;
        }
      } catch (failure) {
        if (!disposed) setPollError(asError(failure));
      }
      if (!disposed) timer = setTimeout(() => void poll(), 900);
    }
    timer = setTimeout(() => void poll(), pollAttempt ? 0 : 650);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [job?.id, job?.status, pollAttempt, rememberIntent, session]);

  async function ensureCart() {
    if (switching.current) throw new WorkspaceError({ code: "CART_LOCKED" });
    if (!connected || issues.some((i) => i.area === "交接包草稿"))
      throw new WorkspaceError({ code: "NETWORK_ERROR" });
    if (session.snapshot().cart) return session.snapshot().cart!;
    if (!creation.current) {
      setCreating(true);
      creation.current = api
        .createCart()
        .then((cart) => {
          session.setCart(cart);
          setCarts((list) => [cart, ...list]);
          return cart;
        })
        .finally(() => {
          creation.current = null;
          setCreating(false);
        });
    }
    return creation.current;
  }
  async function newCart() {
    if (
      session.snapshot().locked ||
      creating ||
      switching.current ||
      creation.current ||
      session.snapshot().pending.length
    )
      throw new WorkspaceError({ code: "CART_LOCKED" });
    switching.current = true;
    session.lock(true);
    setCreating(true);
    try {
      const cart = await api.createCart();
      session.setCart(cart);
      setPreview(null);
      setJob(null);
      setCarts((list) => [cart, ...list]);
      return cart;
    } finally {
      switching.current = false;
      session.lock(false);
      setCreating(false);
    }
  }
  async function chooseCart(id: string) {
    if (
      session.snapshot().locked ||
      creating ||
      switching.current ||
      creation.current ||
      session.snapshot().pending.length
    )
      throw new WorkspaceError({ code: "CART_LOCKED" });
    switching.current = true;
    session.lock(true);
    setCreating(true);
    try {
      const cart = await api.cart(id);
      session.setCart(cart);
      setPreview(null);
      setJob(null);
      return cart;
    } finally {
      switching.current = false;
      session.lock(false);
      setCreating(false);
    }
  }
  async function add(asset: Asset) {
    await ensureCart();
    return session.add(asset.id, asset.revisionId);
  }
  async function toggleFrequent(asset: Asset) {
    const key = `${scope}:${asset.id}`;
    if (preferenceLocks.current.has(key)) return;
    preferenceLocks.current.add(key);
    setBusyPreferences((old) => [...old, key]);
    const previous = preferences.find(
      (p) => p.assetId === asset.id && p.scope === scope,
    );
    try {
      const result = await api.setPreference(asset.id, {
        scope,
        frequent: !previous?.frequent,
        ...(previous ? { expectedVersion: previous.version } : {}),
      });
      setPreferences((old) => [
        ...old.filter(
          (p) => !(p.scope === result.scope && p.assetId === result.assetId),
        ),
        result,
      ]);
    } catch (failure) {
      const issue = asError(failure);
      if (issue.code === "VERSION_CONFLICT")
        setPreferences(await api.preferences());
      throw issue;
    } finally {
      preferenceLocks.current.delete(key);
      setBusyPreferences((old) => old.filter((k) => k !== key));
    }
  }
  async function preparePreview() {
    setPreview(null);
    setPreviewing(true);
    setError(null);
    try {
      const cart = await session.settled();
      if (!cart) throw new WorkspaceError({ code: "EMPTY_CART" });
      const result = await api.preview(cart.id, cart.version);
      setPreview(result);
      return result;
    } catch (failure) {
      const issue = asError(failure);
      if (issue.code === "VERSION_CONFLICT") await session.reconcile(issue);
      throw issue;
    } finally {
      setPreviewing(false);
    }
  }
  async function startExport(retry = false) {
    if (exportLock.current) return;
    const cart = session.snapshot().cart;
    if (!cart) throw new WorkspaceError({ code: "EMPTY_CART" });
    let nextIntent = retry ? intentRef.current : null;
    if (!nextIntent) {
      if (
        session.snapshot().blocked ||
        session.snapshot().pending.length ||
        !preview?.canExport ||
        preview.cart.id !== cart.id ||
        preview.cart.version !== cart.version
      )
        throw new WorkspaceError({
          code: "PREVIEW_REQUIRED",
          message: "请重新预览当前草稿。",
        });
      nextIntent = {
        cartId: cart.id,
        expectedVersion: cart.version,
        requestId: crypto.randomUUID(),
      };
    }
    exportLock.current = true;
    setSubmitting(true);
    setError(null);
    setJob(null);
    session.lock(true);
    rememberIntent(nextIntent);
    try {
      const result = await api.export(nextIntent);
      setJob(result);
      setPollError(null);
      if (result.status === "running")
        rememberIntent({ ...nextIntent, jobId: result.id });
      else {
        rememberIntent(null);
        session.lock(false);
        setPackages(await api.packages());
      }
      return result;
    } catch (failure) {
      const issue = asError(failure);
      if (issue.code !== "NETWORK_ERROR" && issue.code !== "INVALID_RESPONSE") {
        rememberIntent(null);
        session.lock(false);
        if (issue.code === "VERSION_CONFLICT") await session.reconcile(issue);
      }
      throw issue;
    } finally {
      exportLock.current = false;
      setSubmitting(false);
    }
  }
  async function cancelExport() {
    if (job?.status === "running") {
      const next = await api.cancel(job.id);
      setJob(next);
      setPollError(null);
      if (next.status === "running") setPollAttempt((n) => n + 1);
      else {
        rememberIntent(null);
        session.lock(false);
        setPackages(await api.packages());
      }
    }
  }
  return {
    status,
    connected,
    assets,
    environments,
    preferences,
    reports,
    carts,
    packages,
    scope,
    setScope,
    loading,
    issues,
    error,
    setError,
    load,
    session,
    cartState,
    ensureCart,
    newCart,
    chooseCart,
    add,
    toggleFrequent,
    busyPreferences,
    creating,
    preview,
    previewing,
    preparePreview,
    job,
    intent,
    submitting,
    pollError,
    retryPoll: () => setPollAttempt((n) => n + 1),
    startExport,
    cancelExport,
  };
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>;
