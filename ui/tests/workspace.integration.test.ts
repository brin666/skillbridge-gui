import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createWorkspaceApi, WorkspaceError } from "../src/workspace/api";
import { CartSession } from "../src/workspace/cartSession";
import type {
  Asset,
  Cart,
  ExportIntent,
  ExportJob,
  Kind,
} from "../src/workspace/types";

const base = "http://127.0.0.1:17321/api/v1";
const api = createWorkspaceApi(base);
const runId = `gui-${Date.now()}`;
const root = `D:/SkillBridgeData/gui-dev-fixtures/${runId}`;
const evidence: Record<string, unknown> = { runId, root, checks: [] };
function check(name: string) {
  (evidence.checks as string[]).push(name);
}
async function raw(route: string, body: unknown, method = "POST") {
  const response = await fetch(base + route, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.ok(response.ok, JSON.stringify(result));
  return result;
}
async function finish(job: ExportJob) {
  const limit = Date.now() + 45000;
  while (job.status === "running" && Date.now() < limit) {
    await new Promise((r) => setTimeout(r, 150));
    job = await api.job(job.id);
  }
  assert.notEqual(job.status, "running");
  return job;
}
const isCode = (code: string) => (error: unknown) =>
  error instanceof WorkspaceError && error.code === code;

test("profile invalidation discards a delayed real HTTP write response", async () => {
  const status = await api.status();
  assert.equal(
    status.dataHome.replaceAll("\\", "/").toLowerCase(),
    "d:/skillbridgedata/gui-dev",
  );
  let release!: () => void, received!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const arrived = new Promise<void>((resolve) => {
    received = resolve;
  });
  const delayed = createWorkspaceApi(base, async (input, init) => {
    const response = await fetch(input, init);
    if (String(input).endsWith("/items") && init?.method === "POST") {
      received();
      await gate;
    }
    return response;
  });
  const asset = await api.register({
    kind: "rule",
    title: "延迟响应验证 · 合成资料",
    content: "Synthetic delayed-response fixture.",
    sourceKey: "late-" + crypto.randomUUID(),
    ownership: "user",
    scope: { type: "personal" },
  });
  const session = new CartSession(delayed);
  session.setCart(await api.createCart());
  const pending = session.add(asset.id, asset.revisionId);
  await arrived;
  session.invalidate();
  release();
  await assert.rejects(pending, isCode("QUEUE_PAUSED"));
  assert.equal(session.snapshot().cart, null);
  assert.equal(session.snapshot().locked, true);
  assert.equal(session.snapshot().error?.code, "PROFILE_CHANGED");
  await raw(
    "/assets/" + asset.id,
    { expectedVersion: asset.version, archived: true },
    "PATCH",
  );
});

test(
  "workspace GUI uses the real independent HTTP profile end to end",
  { timeout: 180000 },
  async () => {
    const status = await api.status();
    assert.equal(
      status.dataHome.replaceAll("\\", "/").toLowerCase(),
      "d:/skillbridgedata/gui-dev",
    );
    assert.equal(status.legacySyncUsed, false);
    await fs.mkdir(`${root}/skills/visual-notes/scripts`, { recursive: true });
    await fs.mkdir(`${root}/skills/visual-notes/assets`, { recursive: true });
    const original =
      "# Synthetic visual notes\n\nSynthetic GUI test fixture; do not execute scripts.\n";
    await fs.writeFile(`${root}/skills/visual-notes/SKILL.md`, original);
    await fs.writeFile(
      `${root}/skills/visual-notes/scripts/example.py`,
      '# Synthetic companion script; not executed\nprint("fixture only")\n',
    );
    await fs.writeFile(
      `${root}/skills/visual-notes/assets/palette.json`,
      JSON.stringify({
        purpose: "synthetic UI fixture",
        colors: ["#4057d8", "#eef1ff"],
      }),
    );
    await fs.mkdir(`${root}/skills/visual-notes/node_modules`, {
      recursive: true,
    });
    await fs.writeFile(
      `${root}/skills/visual-notes/node_modules/excluded.txt`,
      "synthetic excluded dependency",
    );
    const scan = await api.scan([
      {
        path: `${root}/skills`,
        environment: { harness: "GUI Test Harness", agent: "Synthetic Agent" },
      },
      `${root}/does-not-exist`,
    ]);
    assert.equal(scan.assets.length, 1);
    assert.equal(scan.errors.length, 1);
    check("explicit Skill scan and partial failure");
    const skill = (await raw(
      `/assets/${scan.assets[0].id}`,
      {
        expectedVersion: scan.assets[0].version,
        title: "界面协作 Skill · 合成资料",
      },
      "PATCH",
    )) as Asset;
    const all: Asset[] = [skill];
    for (const [kind, title, content] of [
      [
        "rule",
        "项目约定 · 合成资料",
        "# 合成项目规则\n仅用于 GUI 联调，不修改真实项目。",
      ],
      [
        "memory",
        "项目背景 · 合成资料",
        "# 合成项目记忆\n待用户确认的示例背景，不代表真实偏好。",
      ],
      [
        "mcp",
        "文档工具 · 合成配置",
        {
          mcpServers: {
            documents: {
              command: "synthetic-do-not-run",
              args: ["--fixture"],
              env: { ACCESS_TOKEN: "${GUI_FIXTURE_TOKEN}" },
            },
            unselected: { command: "not-selected" },
          },
        },
      ],
      [
        "ledger",
        "任务账本 · 合成资料",
        {
          schemaVersion: 1,
          source: "synthetic-gui-fixture",
          entries: [{ task: "验证 GUI 交接", status: "fixture" }],
        },
      ],
    ] as Array<[Kind, string, string | object]>)
      all.push(
        await api.register({
          kind,
          title,
          content: content as never,
          sourceKey: `${runId}-${kind}`,
          ownership: "user",
          scope: {
            type: kind === "rule" ? "project" : "personal",
            ...(kind === "rule" ? { path: root } : {}),
          },
          environment: {
            harness: "GUI Test Harness",
            agent: "Synthetic Agent",
          },
          ...(kind === "mcp" ? { serverName: "documents" } : {}),
        }),
      );
    check("five registered kinds, explicit MCP server selection");
    const session = new CartSession(api);
    session.setCart(
      await api.createCart({
        task: { description: "HTTP 五类资料验证 · 合成档案" },
        project: { path: root },
        targetHint: { harness: "Synthetic Target" },
        operationScope: "仅阅读所选合成资料，不执行脚本，不修改目标配置。",
      }),
    );
    await Promise.all(all.map((a) => session.add(a.id, a.revisionId)));
    assert.equal(session.snapshot().cart!.items.length, 5);
    assert.equal(session.snapshot().cart!.version, 6);
    check("parallel UI additions serialized using latest cart version");
    const before = session.snapshot().cart!;
    await session.add(skill.id, skill.revisionId);
    assert.equal(session.snapshot().cart!.version, before.version);
    assert.equal(session.snapshot().cart!.items.length, 5);
    check("duplicate addition is idempotent");
    const duplicate = await api.register({
      kind: "rule",
      title: all[1].title,
      content: "Another distinct synthetic rule",
      sourceKey: `run-${runId}-duplicate`,
      scope: { type: "personal" },
      ownership: "unknown",
    });
    await session.add(duplicate.id, duplicate.revisionId);
    assert.equal(session.snapshot().cart!.items.length, 6);
    await session.remove(duplicate.id);
    check("different assets with identical titles remain separate");
    let preference = await api.setPreference(skill.id, {
      scope: "harness:gui%20test%20harness:agent:synthetic%20agent",
      frequent: true,
    });
    assert.equal(preference.version, 1);
    await assert.rejects(
      api.setPreference(skill.id, {
        scope: preference.scope,
        frequent: false,
        expectedVersion: 0,
      }),
      isCode("VERSION_CONFLICT"),
    );
    assert.equal(
      (await api.preferences()).find((p) => p.id === preference.id)?.frequent,
      true,
    );
    preference = await api.setPreference(skill.id, {
      scope: preference.scope,
      frequent: false,
      expectedVersion: preference.version,
    });
    assert.equal(preference.frequent, false);
    await api.setPreference(skill.id, { scope: "personal", frequent: true });
    check("preference versions and scopes independent from cart");
    await session.remove(skill.id);
    assert.equal(
      (await api.preferences()).find(
        (p) => p.assetId === skill.id && p.scope === "personal",
      )?.frequent,
      true,
    );
    assert.equal(
      await fs.readFile(`${root}/skills/visual-notes/SKILL.md`, "utf8"),
      original,
    );
    await session.add(skill.id, skill.revisionId);
    const external = await api.editCart(
      session.snapshot().cart!.id,
      session.snapshot().cart!.version,
      { task: { description: "外部更新 · 合成冲突验证" } },
    );
    const conflict = await Promise.allSettled([
      session.remove(all[1].id),
      session.remove(all[2].id),
    ]);
    assert.ok(conflict.every((r) => r.status === "rejected"));
    assert.equal(session.snapshot().blocked, true);
    assert.equal(session.snapshot().cart!.version, external.version);
    assert.equal(session.snapshot().cart!.items.length, 5);
    await session.acknowledge();
    check(
      "version conflict reloads latest draft and blocks queued writes until acknowledged",
    );
    const draft = await api.cart(session.snapshot().cart!.id);
    assert.equal(draft.items.length, 5);
    check("draft reload preserves cross-category selections");
    let preview = await api.preview(draft.id, draft.version);
    assert.equal(preview.canExport, true);
    assert.equal(new Set(preview.items.map((i) => i.kind)).size, 5);
    assert.ok(preview.items.find((i) => i.kind === "mcp")!.followUps.length);
    assert.ok(preview.items.find((i) => i.kind === "skill")!.omissions.length);
    const intent: ExportIntent = {
      cartId: draft.id,
      expectedVersion: draft.version,
      requestId: crypto.randomUUID(),
    };
    // The server handles a real export; only its first HTTP response is deliberately lost.
    const lossApi = createWorkspaceApi(base, async (input, init) => {
      const result = await fetch(input, init);
      if (String(input).endsWith("/export"))
        throw new TypeError("synthetic response loss");
      return result;
    });
    await assert.rejects(lossApi.export(intent), isCode("NETWORK_ERROR"));
    let job = await finish(await api.export(intent));
    assert.equal(job.status, "complete");
    assert.equal((await api.export(intent)).id, job.id);
    check("lost response retry reuses requestId and original real export");
    const pack = await api.package(job.packageId!);
    const prompt = await api.prompt(pack.id);
    assert.equal(
      prompt.text,
      await fs.readFile(path.join(pack.path, "HANDOFF.md"), "utf8"),
    );
    assert.equal((await api.verify(pack.id)).valid, true);
    assert.ok(
      pack.manifest.files.some((f) => f.path.endsWith("scripts/example.py")),
    );
    assert.ok(
      pack.manifest.files.some((f) => f.path.endsWith("assets/palette.json")),
    );
    assert.equal(pack.manifest.items.length, 5);
    check(
      "real package contains full Skill scripts/assets and backend prompt matches file",
    );
    assert.equal((await api.receipts(pack.id)).length, 0);
    await raw("/receipts", {
      id: `receipt-${runId}`,
      packageId: pack.id,
      source: "GUI 合成回执测试（非真实 Agent 执行）",
      target: { harness: "Synthetic Target" },
      items: [
        {
          assetId: skill.id,
          status: "read",
          evidence: "合成测试报告：用于检查状态展示，不代表实际读取。",
        },
        {
          assetId: all[1].id,
          status: "recognized",
          evidence: "合成状态样本。",
        },
        {
          assetId: all[2].id,
          status: "verified",
          evidence: "合成自述样本；没有独立执行验证。",
        },
      ],
    });
    assert.equal((await api.receipts(pack.id))[0].verification, "reported");
    assert.equal((await api.verify(pack.id)).runtimeVerified, false);
    check(
      "unknown receipt and reported receipt are distinct from independent verification",
    );
    await fs.appendFile(
      `${root}/skills/visual-notes/SKILL.md`,
      "\nChanged by synthetic test.\n",
    );
    preview = await api.preview(draft.id, draft.version);
    assert.equal(preview.canExport, false);
    assert.ok(preview.errors.some((e) => e.code === "SOURCE_CHANGED"));
    const failedIntent = { ...intent, requestId: crypto.randomUUID() };
    job = await finish(await api.export(failedIntent));
    assert.equal(job.status, "failed");
    assert.equal(job.error?.code, "SOURCE_CHANGED");
    assert.equal((await api.export(failedIntent)).id, job.id);
    const refreshed = await api.refreshAsset(skill.id);
    assert.notEqual(refreshed.revisionId, skill.revisionId);
    assert.equal(
      (await api.cart(draft.id)).items.find((i) => i.assetId === skill.id)
        ?.revisionId,
      skill.revisionId,
    );
    await session.add(refreshed.id, refreshed.revisionId);
    const revised = session.snapshot().cart!;
    job = await finish(
      await api.export({
        cartId: revised.id,
        expectedVersion: revised.version,
        requestId: crypto.randomUUID(),
      }),
    );
    assert.equal(job.status, "complete");
    check(
      "source change blocks preview and fails export; explicit refreshed revision and new request recover",
    );
    await session.clear();
    assert.equal(session.snapshot().cart!.items.length, 0);
    assert.equal(
      (await api.preview(draft.id, session.snapshot().cart!.version)).canExport,
      false,
    );
    await assert.rejects(
      api.export({
        cartId: draft.id,
        expectedVersion: session.snapshot().cart!.version,
        requestId: crypto.randomUUID(),
      }),
      isCode("EMPTY_CART"),
    );
    check("clear and empty-cart export guard preserve source and preferences");
    await fs.mkdir(`${root}/bulk`, { recursive: true });
    await fs.writeFile(
      `${root}/bulk/SKILL.md`,
      "# Synthetic cancellation fixture\n",
    );
    const block = Buffer.alloc(256 * 1024, 0x61);
    for (let i = 0; i < 192; i++)
      await fs.writeFile(
        `${root}/bulk/file-${String(i).padStart(3, "0")}.txt`,
        block,
      );
    const bulk = await api.register({
      kind: "skill",
      title: "取消导出测试 · 合成大文件夹",
      path: `${root}/bulk`,
      ownership: "user",
      scope: { type: "personal" },
    });
    let cancelCart = await api.createCart({
      task: { description: "取消导出合成测试" },
    });
    cancelCart = await api.add(
      cancelCart.id,
      cancelCart.version,
      bulk.id,
      bulk.revisionId,
    );
    let cancelling = await api.export({
      cartId: cancelCart.id,
      expectedVersion: cancelCart.version,
      requestId: crypto.randomUUID(),
    });
    cancelling = await api.cancel(cancelling.id);
    cancelling = await finish(cancelling);
    assert.equal(cancelling.status, "cancelled");
    assert.equal(cancelling.packageId, null);
    check(
      "real running export cancellation reaches cancelled terminal without a package",
    );
    await raw(
      `/assets/${bulk.id}`,
      { expectedVersion: bulk.version, archived: true },
      "PATCH",
    );
    await raw(
      `/assets/${duplicate.id}`,
      { expectedVersion: duplicate.version, archived: true },
      "PATCH",
    );
    await raw("/reports", {
      id: `report-${runId}`,
      type: "recommendation",
      source: "GUI 合成推荐报告（非使用监控）",
      assetIds: [all[2].id],
      evidence: "合成推荐样本：用于验证推荐与用户常用确认分离。",
    });
    const ready = await api.createCart({
      task: { description: "新版 GUI 联调 · 合成资料" },
      project: { path: root },
      operationScope:
        "仅阅读这五类合成资料；不安装工具、不执行脚本、不更改 Agent 配置。",
    });
    evidence.assets = [refreshed, ...all.slice(1)];
    evidence.cartId = ready.id;
    evidence.packageId = pack.id;
    evidence.failedJobId = (await api.export(failedIntent)).id;
    evidence.cancelledJobId = cancelling.id;
    evidence.bulkAsset = bulk;
    evidence.backendStatus = status;
    await fs.mkdir("D:/skillbridge/ui/.qa", { recursive: true });
    await fs.writeFile(
      "D:/skillbridge/ui/.qa/http-evidence.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(
      JSON.stringify(
        { checks: evidence.checks, cartId: ready.id, packageId: pack.id, root },
        null,
        2,
      ),
    );
  },
);
