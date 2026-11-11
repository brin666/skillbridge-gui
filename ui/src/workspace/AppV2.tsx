import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Drawer } from "@astryxdesign/core/Drawer";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { asError } from "./api";
import { environmentScope, useWorkspace } from "./useWorkspace";
import { useCartMotion } from "./useCartMotion";
import { installSpringVars } from "./motion";
import { Glyph } from "./Glyph";
import {
  categories,
  confirmationName,
  dateText,
  Empty,
  Failure,
  scopeName,
  sourceName,
} from "./shared";
import {
  Rail,
  SourceFilter,
  Ticker,
  useMedia,
  type VisualAsset,
} from "./Visuals";
import { CollectPanel } from "./CollectPanel";
import { CartPanel, Dock, type CartProps } from "./CartV2";
import { AssetPanel } from "./AssetPanel";
import { AssetGrid } from "./AssetGrid";
import { useGridExit } from "./useGridExit";
import { cardDate, displayTitle, presentationOf, presentationSearch, shortProject } from "./presentation";
import { HandoffPanel } from "./HandoffV2";
import { PackagePanel } from "./PackagePanel";
import type { Asset, CartContext, Environment, Kind } from "./types";
import "./styles.css";
import "./panels.css";
installSpringVars();
type Panel =
  | { type: "collect" | "cart" | "handoff" | "history" | "drafts" | "status" }
  | { type: "asset" | "package"; id: string }
  | null;
const blank: CartContext = {
  task: null,
  project: null,
  targetHint: null,
  operationScope: "",
};
export default function AppV2() {
  const model = useWorkspace();
  const { cartState, assets } = model;
  const cart = cartState.cart;
  const [category, setCategory] = useState<Kind>("skill"),
    [query, setQuery] = useState(""),
    [source, setSource] = useState("all"),
    [filter, setFilter] = useState("all");
  const [panel, setPanel] = useState<Panel>(null),
    [dockOpen, setDockOpen] = useState(false),
    [manualReduce, setManualReduce] = useState(false);
  const [direction, setDirection] = useState(1);
  const [notice, setNotice] = useState<{
    text: string;
    key: number;
    undo?: () => Promise<unknown>;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const narrow = useMedia("(max-width: 900px)"),
    systemReduce = useMedia("(prefers-reduced-motion: reduce)"),
    reduced = manualReduce || systemReduce;
  const motion = useCartMotion(reduced, narrow, !!panel);
  const gridExit = useGridExit(reduced);
  const [context, setContext] = useState<CartContext>(blank);
  const serverContext = JSON.stringify(
    cart
      ? {
          task: cart.task,
          project: cart.project,
          targetHint: cart.targetHint,
          operationScope: cart.operationScope,
        }
      : blank,
  );
  useEffect(
    () => setContext(JSON.parse(serverContext) as CartContext),
    [cart?.id, serverContext],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (narrow) setDockOpen(false);
  }, [narrow]);
  useEffect(() => setNotice(null), [cart?.id]);
  const dirty = JSON.stringify(context) !== serverContext;
  const busy =
    cartState.locked ||
    cartState.blocked ||
    !model.connected ||
    model.loading ||
    model.creating ||
    model.issues.some((i) => i.area === "交接包草稿");
  const current = categories.find((c) => c.id === category)!;
  const selectedIds = useMemo(() => new Set(cart?.items.map((i) => i.assetId) || []), [cart?.items]);
  const frequent = useMemo(() => new Set(
    model.preferences
      .filter((p) => p.scope === model.scope && p.frequent)
      .map((p) => p.assetId),
  ), [model.preferences, model.scope]);
  const recommended = useMemo(() => new Set(
    model.reports
      .filter((r) => r.type === "recommendation")
      .flatMap((r) => r.assetIds),
  ), [model.reports]);
  const presentations = useMemo(() => new Map(assets.map(a => [a.id, presentationOf(a)])), [assets]);
  const scopes = useMemo(() => {
    const map = new Map<string, Environment>();
    [
      ...model.environments,
      ...assets.map((a) => a.environment).filter((e): e is Environment => !!e),
    ].forEach((e) => {
      if (e.harness || e.agent) map.set(environmentScope(e), e);
    });
    return [...map.entries()];
  }, [model.environments, assets]);
  const visual = useCallback((a: Asset): VisualAsset => {
    const p = presentations.get(a.id);
    const state = [frequent.has(a.id) ? "已确认常用" : recommended.has(a.id) ? "Agent 推荐" : "",
      a.confirmation !== "not_required" ? confirmationName(a.confirmation) : "",
      a.ownership === "unknown" ? "归属未知" : ""].filter(Boolean).join(" · ");
    return {
      id: a.id,
      title: displayTitle(a),
      subtitle: a.kind === "skill" ? p?.originalName : a.kind === "memory" ? p?.titleSource : undefined,
      description: a.kind === "memory" && p
        ? a.scope.path ? "项目：" + shortProject(a.scope.path) : p.summary || "个人记忆"
        : p?.summary,
      locationLabel: p?.locationLabel,
      footer: [sourceName(a), state, a.kind === "memory" ? cardDate(p?.date || a.updatedAt) : p?.translation].filter(Boolean).join(" · "),
      icon: categories.find((c) => c.id === a.kind)!.icon,
      source: sourceName(a),
      brief: [
        frequent.has(a.id)
          ? "已确认常用"
          : recommended.has(a.id)
            ? "Agent 推荐"
            : "",
        scopeName(a),
        a.confirmation !== "not_required"
          ? confirmationName(a.confirmation)
          : "",
        a.ownership === "unknown" ? "归属未知" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      state:
        a.confirmation === "outdated"
          ? "已过期"
          : a.followUps.length
            ? "有待补事项"
            : undefined,
    };
  }, [presentations, frequent, recommended]);
  const visualAssets = useMemo(() => new Map(assets.map(a => [a.id, visual(a)])), [assets, visual]);
  const selected: VisualAsset[] = (cart?.items || []).map((item) => {
    const a = assets.find((a) => a.id === item.assetId);
    return a
      ? {
          ...visualAssets.get(a.id)!,
          title: a.revisionId === item.revisionId ? displayTitle(a) : item.metadata.title,
          state:
            a.revisionId !== item.revisionId
              ? "交接包保留先前修订"
              : visualAssets.get(a.id)?.state,
        }
      : {
          id: item.assetId,
          title: item.metadata.title,
          source: "资料未在清单中",
          icon: "file",
          brief: "请核对资料状态",
          state: "资料未在当前清单中",
        };
  });
  const searchIndex = useMemo(() => new Map(assets.map(a => [a.id, presentationSearch(a)])), [assets]);
  const visible = useMemo(() =>
    assets
      .filter(
        (a) =>
          a.kind === category &&
          (source === "all" || sourceName(a) === source) &&
          (filter !== "frequent" || frequent.has(a.id)) &&
          (filter !== "recommended" || recommended.has(a.id)) &&
          (filter !== "selected" || selectedIds.has(a.id)) &&
          searchIndex.get(a.id)!.includes(query.trim().toLocaleLowerCase()),
      )
      .sort((a, b) => Number(frequent.has(b.id)) - Number(frequent.has(a.id)) ||
        (category === "memory" ? Number(!!presentations.get(b.id)?.threadId) - Number(!!presentations.get(a.id)?.threadId) ||
          (presentations.get(b.id)?.date || b.updatedAt).localeCompare(presentations.get(a.id)?.date || a.updatedAt) : 0)),
    [assets, category, source, filter, frequent, recommended, selectedIds, searchIndex, query, presentations]);
  const sources = useMemo(() => [...new Set(assets.map(sourceName))], [assets]);
  function tell(text: string, undo?: () => Promise<unknown>) {
    clearTimeout(timer.current);
    setNotice({ text, undo, key: Date.now() });
    timer.current = setTimeout(() => setNotice(null), 4200);
  }
  function run(action: () => Promise<unknown>) {
    void action().catch((e) => {
      const error = asError(e);
      if (error.code !== "WRITE_PENDING") model.setError(error);
    });
  }
  function open(value: Panel) {
    motion.cancel();
    setPanel(value);
  }
  function switchCategory(kind: Kind) {
    if (kind === category) return;
    gridExit.capture();
    setDirection(categories.findIndex(c => c.id === kind) > categories.findIndex(c => c.id === category) ? 1 : -1);
    setCategory(kind);
    setQuery("");
    window.scrollTo({ top: 0 });
  }
  async function toggle(a: Asset) {
    const item = model.session.snapshot().cart?.items.find((i) => i.assetId === a.id);
    if (item) {
      await model.session.remove(a.id);
      motion.fly(visual(a), true);
      tell("已移出 " + displayTitle(a), () =>
        model.session.add(item.assetId, item.revisionId, item.purpose),
      );
    } else {
      await model.add(a);
      const flight = motion.fly(visual(a), false);
      if (flight) motion.landDelay.current.set(a.id, Math.round(flight * 0.86));
      else motion.bump("in");
      if (reduced) tell("已加入 " + displayTitle(a), () => model.session.remove(a.id));
    }
  }
  async function remove(id: string) {
    const item = cart?.items.find((i) => i.assetId === id);
    if (!item) return;
    await model.session.remove(id);
    const a = assets.find((a) => a.id === id);
    if (a) motion.fly(visual(a), true);
    tell("已移出 " + (a ? displayTitle(a) : item.metadata.title), () =>
      model.session.add(item.assetId, item.revisionId, item.purpose),
    );
  }
  async function clear() {
    const before = [...(cart?.items || [])];
    await model.session.clear();
    motion.cancel();
    motion.bump("out");
    tell("已清空 " + before.length + " 项", async () => {
      for (const item of before)
        await model.session.add(item.assetId, item.revisionId, item.purpose);
    });
  }
  async function save() {
    await model.session.edit(context);
    tell("任务信息已保存");
  }
  async function preview() {
    setDockOpen(false);
    open({ type: "handoff" });
    await model.preparePreview();
  }
  const cartProps: CartProps = {
    model,
    selected,
    context,
    setContext,
    dirty,
    reduced,
    landDelay: motion.landDelay,
    run,
    onDrafts: () => open({ type: "drafts" }),
    onOpen: (id) => open({ type: "asset", id }),
    onPreview: () => run(preview),
    onJob: () => open({ type: "handoff" }),
    onClear: clear,
    onRemove: remove,
    onSave: save,
  };
  const panelTitle =
    panel?.type === "asset"
      ? "资料详情"
      : panel?.type === "package"
        ? "交接包与接收结果"
        : panel?.type === "collect"
          ? "整理与登记"
          : panel?.type === "history"
            ? "交接历史"
            : panel?.type === "drafts"
              ? "交接包草稿"
              : panel?.type === "status"
                ? "本机档案"
                : "交接包";
  return (
    <Theme theme={neutralTheme} mode="light">
      <div
        className={`app ${reduced ? "rm" : ""} ${dockOpen ? "dock-open" : ""}`}
      >
        <a href="#grid" className="skip">
          跳到资料
        </a>
        <Rail
          category={category}
          onPick={switchCategory}
          reduced={reduced}
          systemReduce={systemReduce}
          setManualReduce={setManualReduce}
          onCollect={() => open({ type: "collect" })}
          onHistory={() => open({ type: "history" })}
          onStatus={() => open({ type: "status" })}
        />
        <main className="main" id="grid" tabIndex={-1}>
          {model.error && (
            <Failure
              error={model.error}
              onRetry={() =>
                model.error?.code === "PROFILE_CHANGED"
                  ? location.reload()
                  : void model.load()
              }
              onDismiss={() => model.setError(null)}
            />
          )}{" "}
          {model.issues.map((i) => (
            <Failure
              key={i.area}
              error={i.error}
              title={i.area + "加载失败"}
              onRetry={() => void model.load()}
            />
          ))}
          <header className="head">
            <h1 className="title" aria-live="polite">
              <span key={category} className={`title-text dir-${direction}`}>
                {current.label}
              </span>
              <span key={"n-" + category} className="title-count">
                {visible.length}
              </span>
            </h1>
            <div className="tools">
              <div className="search">
                <TextInput
                  label={"搜索" + current.label}
                  isLabelHidden
                  value={query}
                  onChange={value => {setQuery(value); window.scrollTo({top: 0});}}
                  placeholder="搜索名称或用途"
                  startIcon={<Glyph name="search" size={16} />}
                  hasClear
                />
              </div>
              <SourceFilter
                value={source}
                onChange={setSource}
                sources={sources}
              />
              <Tooltip content="整理与登记">
                <IconButton
                  label="整理与登记"
                  variant="ghost"
                  icon={<Glyph name="plus" size={18} />}
                  onClick={() => open({ type: "collect" })}
                />
              </Tooltip>
              {narrow && (
                <Tooltip content="档案与历史">
                  <IconButton
                    label="档案与历史"
                    variant="ghost"
                    icon={<Glyph name="folder" size={18} />}
                    onClick={() => open({ type: "status" })}
                  />
                </Tooltip>
              )}
            </div>
          </header>
          {filter !== "all" && (
            <button className="active-filter" onClick={() => setFilter("all")}>
              {filter === "frequent"
                ? "常用"
                : filter === "recommended"
                  ? "Agent 推荐"
                  : "已加入"}{" "}
              <Glyph name="close" size={12} />
            </button>
          )}
          <div className="stage">
            <div ref={gridExit.layer} className="stage-exit" aria-hidden="true" inert />
            {model.loading && !assets.length ? (
              <Empty title="正在读取档案…" />
            ) : !model.connected && !assets.length ? (
              <Empty
                title="无法连接本机档案"
                action="重新连接"
                onAction={() => void model.load()}
              />
            ) : model.issues.some((i) => i.area === "资料列表") ? (
              <Empty
                title="资料列表未能读取"
                action="重试"
                onAction={() => void model.load()}
              />
            ) : !visible.length ? (
              <Empty
                title={
                  assets.some((a) => a.kind === category)
                    ? "没有匹配的资料"
                    : "还没有" + current.label + "资料"
                }
                action={
                  assets.some((a) => a.kind === category)
                    ? "清除筛选"
                    : "整理与登记"
                }
                onAction={() => {
                  if (assets.some((a) => a.kind === category)) {
                    setQuery("");
                    setSource("all");
                    setFilter("all");
                  } else open({ type: "collect" });
                }}
              />
            ) : (
              <AssetGrid key={category} direction={direction}
                items={visible.map(a => visualAssets.get(a.id)!)} selected={selectedIds} pending={cartState.pending} disabled={busy}
                onAdd={id => {const asset = assets.find(a => a.id === id); if (asset) run(() => toggle(asset));}}
                onOpen={id => open({type: "asset", id})} />
            )}
          </div>
        </main>
        {!narrow && (
          <Dock
            {...cartProps}
            bagRef={motion.bagRef}
            open={dockOpen}
            setOpen={setDockOpen}
          />
        )}{" "}
        {narrow && (
          <button
            ref={motion.pillRef}
            className={`pill ${selected.length ? "has" : ""}`}
            onClick={() => open({ type: "cart" })}
            aria-label={`交接包，${selected.length} 项`}
          >
            <Glyph name="bag" size={20} />
            <span>交接包</span>
            <span className="pill-count">
              <Ticker value={selected.length} />
            </span>
          </button>
        )}
        <div className="toast-region" role="status" aria-live="polite">
          {notice && (
            <div key={notice.key} className="toast">
              <Glyph name="check" size={15} />
              <span>{notice.text}</span>
              {notice.undo && (
                <button
                  disabled={busy || !!cartState.pending.length}
                  onClick={() =>
                    run(async () => {
                      await notice.undo?.();
                      setNotice(null);
                    })
                  }
                >
                  撤回
                </button>
              )}
            </div>
          )}
        </div>
        <Drawer
          isOpen={!!panel && panel.type !== "handoff"}
          onOpenChange={(value) => {
            if (!value) setPanel(null);
          }}
          label={panelTitle}
          width={
            panel?.type === "asset" ? 460 : panel?.type === "cart" ? 420 : 620
          }
          padding={0}
          experimental={{ isFullWidthOnMobile: true }}
        >
          {panel?.type === "cart" ? (
            <div className="sheet">
              <CartPanel {...cartProps} onClose={() => setPanel(null)} />
            </div>
          ) : (
            <>
              <div className="drawer-header">
                <span>{panelTitle}</span>
                <IconButton
                  label="关闭面板"
                  variant="ghost"
                  icon={<Glyph name="close" size={18} />}
                  data-autofocus
                  onClick={() => setPanel(null)}
                />
              </div>
              {panel?.type === "collect" && (
                <CollectPanel onChanged={model.load} />
              )}{" "}
              {panel?.type === "asset" && (
                <AssetPanel
                  key={panel.id}
                  id={panel.id}
                  model={model}
                  onChange={model.load}
                />
              )}{" "}
              {panel?.type === "package" && (
                <PackagePanel key={panel.id} id={panel.id} />
              )}
              {panel?.type === "history" && (
                <div className="panel-content">
                  <div className="panel-heading">
                    <h2>交接历史</h2>
                    <Button label="刷新" onClick={() => void model.load()} />
                  </div>
                  {model.issues
                    .filter((i) => i.area === "交接历史")
                    .map((i) => (
                      <Failure key={i.area} error={i.error} />
                    ))}
                  {model.issues.some((i) => i.area === "交接历史") ? (
                    <Empty
                      title="交接历史未能读取"
                      action="重试"
                      onAction={() => void model.load()}
                    />
                  ) : !model.packages.length ? (
                    <Empty title="还没有交接包" />
                  ) : (
                    model.packages.map((p) => (
                      <button
                        className="history-row"
                        key={p.id}
                        onClick={() => open({ type: "package", id: p.id })}
                      >
                        <Glyph name="bag" />
                        <span>
                          <strong>
                            包已生成
                            {p.status === "ready_with_followups"
                              ? " · 有待补事项"
                              : ""}
                          </strong>
                          <small>
                            {dateText(p.createdAt)} ·{" "}
                            {p.receiptStatus === "reported"
                              ? "有接收报告"
                              : "尚未收到报告"}
                          </small>
                          <code>{p.id}</code>
                        </span>
                        <Glyph name="arrow" />
                      </button>
                    ))
                  )}
                </div>
              )}
              {panel?.type === "drafts" && (
                <div className="panel-content">
                  <div className="panel-heading">
                    <h2>交接包草稿</h2>
                    <Button
                      label="新建草稿"
                      isDisabled={busy || dirty || !!cartState.pending.length}
                      onClick={() =>
                        run(async () => {
                          await model.newCart();
                          setPanel(null);
                          setDockOpen(!narrow);
                        })
                      }
                    />
                  </div>
                  {dirty && (
                    <p className="warning-box">任务信息尚未保存，请先保存。</p>
                  )}
                  <Button
                    label="刷新草稿列表"
                    onClick={() => void model.load()}
                  />
                  {model.issues
                    .filter((i) => i.area === "交接包草稿")
                    .map((i) => (
                      <Failure key={i.area} error={i.error} />
                    ))}
                  {model.carts.map((c) => (
                    <button
                      className="history-row"
                      key={c.id}
                      disabled={busy || dirty || !!cartState.pending.length}
                      onClick={() =>
                        run(async () => {
                          await model.chooseCart(c.id);
                          setPanel(null);
                          setDockOpen(!narrow);
                        })
                      }
                    >
                      <Glyph name="bag" />
                      <span>
                        <strong>
                          {c.id === cart?.id ? "当前 · " : ""}
                          {c.task?.description || "未命名交接"}
                        </strong>
                        <small>
                          {c.id === cart?.id
                            ? cart.items.length
                            : c.items.length}{" "}
                          项 · {dateText(c.updatedAt)}
                        </small>
                        <code>{c.id}</code>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {panel?.type === "status" && (
                <div className="panel-content">
                  <h2>{model.connected ? "本机档案" : "无法连接本机服务"}</h2>
                  {model.error && <Failure error={model.error} />}
                  <dl className="detail-meta">
                    <div>
                      <dt>资料位置</dt>
                      <dd>{model.status?.dataHome || "尚未读取"}</dd>
                    </div>
                    <div>
                      <dt>后端版本</dt>
                      <dd>{model.status?.version || "未知"}</dd>
                    </div>
                  </dl>
                  <Button
                    label="重新读取档案"
                    onClick={() => void model.load()}
                  />
                  <section className="detail-section">
                    <label className="form-field">
                      常用范围
                      <select
                        aria-label="常用范围"
                        value={model.scope}
                        onChange={(e) => model.setScope(e.target.value)}
                      >
                        <option value="personal">个人通用</option>
                        {scopes.map(([key, env]) => (
                          <option key={key} value={key}>
                            {env.harness || "未知 Harness"} /{" "}
                            {env.agent || "默认 Agent"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      资料筛选
                      <select
                        aria-label="资料筛选"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">全部</option>
                        <option value="frequent">用户已确认常用</option>
                        <option value="recommended">Agent 推荐</option>
                        <option value="selected">交接包已选</option>
                      </select>
                    </label>
                  </section>
                  <div className="detail-actions wrap">
                    <Button
                      label="交接历史"
                      onClick={() => open({ type: "history" })}
                    />
                    <Button
                      label="交接包草稿"
                      onClick={() => open({ type: "drafts" })}
                    />
                    <Button
                      label="整理与登记"
                      onClick={() => open({ type: "collect" })}
                    />
                  </div>
                  <section className="detail-section">
                    <h3>已登记环境</h3>
                    {model.environments.length ? (
                      model.environments.map((e, i) => (
                        <p className="muted-copy" key={e.id || i}>
                          {e.harness || "未知 Harness"} /{" "}
                          {e.agent || "默认 Agent"}
                        </p>
                      ))
                    ) : (
                      <p className="muted-copy">暂无环境记录</p>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </Drawer>
        <Dialog
          isOpen={panel?.type === "handoff"}
          onOpenChange={(value) => {
            if (!value) setPanel(null);
          }}
          width={720}
          padding={0}
          aria-label="交接预览"
        >
          {panel?.type === "handoff" && (
            <HandoffPanel
              model={model}
              run={run}
              selected={selected}
              context={context}
              setContext={setContext}
              dirty={dirty}
              onSave={save}
              onRemove={remove}
              onClose={() => setPanel(null)}
              onAsset={(id) => open({ type: "asset", id })}
              onPackage={(id) => open({ type: "package", id })}
            />
          )}
        </Dialog>
      </div>
    </Theme>
  );
}
