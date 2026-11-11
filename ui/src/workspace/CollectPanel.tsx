import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { api, asError, WorkspaceError } from "./api";
import { categories, Failure, kindName } from "./shared";
import type { Kind, RegisterInput, ScanResult, Scope } from "./types";

export function CollectPanel({
  onChanged,
}: {
  onChanged: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"scan" | "register">("scan");
  const [roots, setRoots] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [kind, setKind] = useState<Kind>("skill");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"path" | "content">("path");
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [serverName, setServerName] = useState("");
  const [scope, setScope] = useState<Scope["type"]>("personal");
  const [scopePath, setScopePath] = useState("");
  const [harness, setHarness] = useState("");
  const [agent, setAgent] = useState("");
  const [sourceKey, setSourceKey] = useState(() => crypto.randomUUID());
  const [ownership, setOwnership] = useState<"user" | "unknown">("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<WorkspaceError | null>(null);
  const [success, setSuccess] = useState("");
  async function scan() {
    setBusy(true);
    setError(null);
    setResult(null);
    setSuccess("");
    try {
      const paths = roots
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (!paths.length)
        throw new WorkspaceError({ code: "SCAN_ROOT_REQUIRED" });
      const value = await api.scan(
        paths.map((path) =>
          harness
            ? { path, environment: { harness, agent: agent || undefined } }
            : path,
        ),
      );
      setResult(value);
      await onChanged();
    } catch (e) {
      setError(asError(e));
    } finally {
      setBusy(false);
    }
  }
  async function register() {
    setBusy(true);
    setError(null);
    setSuccess("");
    try {
      const request: RegisterInput = {
        kind,
        title: title.trim(),
        ownership,
        scope: { type: scope, ...(scopePath ? { path: scopePath } : {}) },
        ...(harness
          ? {
              environment: {
                harness: harness.trim(),
                agent: agent.trim() || undefined,
              },
            }
          : {}),
      };
      if (!request.title)
        throw new WorkspaceError({
          code: "TITLE_REQUIRED",
          message: "请填写资料标题。",
        });
      if (mode === "path" || kind === "skill") request.path = path.trim();
      else {
        request.sourceKey = sourceKey;
        if (kind === "mcp" || kind === "ledger") {
          try {
            request.content = JSON.parse(content) as RegisterInput["content"];
          } catch {
            throw new WorkspaceError({
              code: "INVALID_JSON",
              message: "MCP 与账本正文必须是有效 JSON。",
            });
          }
        } else request.content = content;
      }
      if (kind === "mcp" && serverName.trim())
        request.serverName = serverName.trim();
      const value = await api.register(request);
      setSuccess(`已登记「${value.title}」 · ${value.files.length} 个文件`);
      setSourceKey(crypto.randomUUID());
      setTitle("");
      setPath("");
      setContent("");
      await onChanged();
    } catch (e) {
      setError(asError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel-content">
      <div className="filter-tabs" role="group" aria-label="整理方式">
        <button
          className={tab === "scan" ? "active" : ""}
          onClick={() => setTab("scan")}
        >
          整理 Skill 目录
        </button>
        <button
          className={tab === "register" ? "active" : ""}
          onClick={() => setTab("register")}
        >
          登记资料
        </button>
      </div>
      {error && <Failure error={error} />}{" "}
      {success && (
        <p className="success-box" role="status">
          {success}
        </p>
      )}
      {tab === "scan" ? (
        <form
          className="workspace-form"
          onSubmit={(e) => {
            e.preventDefault();
            void scan();
          }}
        >
          <label>
            Skill 目录（每行一个绝对路径）
            <textarea
              aria-label="Skill 扫描目录"
              value={roots}
              onChange={(e) => setRoots(e.target.value)}
              rows={4}
              placeholder="D:/my-skills"
              required
            />
          </label>
          <p className="muted-copy">
            仅整理明确指定目录中的 Skill，不自动发现或扫描其他 Agent 配置。
          </p>
          <TextInput
            label="来源 Harness（可选）"
            value={harness}
            onChange={setHarness}
          />
          <TextInput
            label="来源 Agent（可选）"
            value={agent}
            onChange={setAgent}
          />
          <Button
            label={busy ? "正在整理…" : "开始整理"}
            type="submit"
            variant="primary"
            isDisabled={busy}
          />
          {result && (
            <section className="detail-section" aria-label="扫描结果">
              <h3>
                {result.errors.length
                  ? "整理完成，部分目录需要处理"
                  : "整理完成"}
              </h3>
              <p>
                发现 {result.scanned} 项资料，{result.errors.length} 项失败。
              </p>
              {result.assets.map((a) => (
                <p className="scan-item" key={a.id}>
                  {a.title} · {a.files.length} 个文件
                </p>
              ))}
              {result.errors.map((p, i) => (
                <Failure key={i} error={new WorkspaceError(p)} />
              ))}
            </section>
          )}
        </form>
      ) : (
        <form
          className="workspace-form"
          onSubmit={(e) => {
            e.preventDefault();
            void register();
          }}
        >
          <label>
            资料类别
            <select
              aria-label="登记资料类别"
              value={kind}
              onChange={(e) => {
                const value = e.target.value as Kind;
                setKind(value);
                setMode(value === "skill" ? "path" : "content");
                setOwnership(value === "skill" ? "unknown" : "user");
                setServerName("");
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <TextInput
            label="标题"
            value={title}
            onChange={setTitle}
            isRequired
          />
          {kind !== "skill" && (
            <label>
              来源方式
              <select
                value={mode}
                aria-label="资料来源方式"
                onChange={(e) => setMode(e.target.value as "path" | "content")}
              >
                <option value="content">内联内容</option>
                <option value="path">本地文件路径</option>
              </select>
            </label>
          )}
          {mode === "path" || kind === "skill" ? (
            <>
              <TextInput
                label={
                  kind === "skill"
                    ? "完整 Skill 文件夹绝对路径"
                    : "本地文件绝对路径"
                }
                value={path}
                onChange={setPath}
                placeholder={
                  kind === "skill"
                    ? "D:/my-skills/example"
                    : "D:/documents/example.md"
                }
                isRequired
              />
              <p className="muted-copy">
                {kind === "skill"
                  ? "目录需包含 SKILL.md，以及需要交接的脚本和素材。"
                  : "浏览器无法取得可靠的本机绝对路径，请直接输入。"}
              </p>
            </>
          ) : (
            <label>
              {kind === "mcp" || kind === "ledger"
                ? "JSON 内容"
                : `${kindName(kind)}正文`}
              <textarea
                aria-label="资料正文"
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </label>
          )}
          {kind === "mcp" && (
            <>
              <TextInput
                label="serverName（服务集合配置必填）"
                value={serverName}
                onChange={setServerName}
              />
              <p className="muted-copy">
                若 JSON 顶层含 mcpServers 或
                servers，请填写本次选择的服务名；每次只登记该服务。
              </p>
            </>
          )}
          <div className="form-pair">
            <label>
              适用范围
              <select
                aria-label="资料适用范围"
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope["type"])}
              >
                <option value="personal">个人</option>
                <option value="project">项目</option>
                <option value="environment">应用环境</option>
              </select>
            </label>
            <label>
              资料归属
              <select
                value={ownership}
                onChange={(e) =>
                  setOwnership(e.target.value as "user" | "unknown")
                }
              >
                <option value="user">用户资料</option>
                <option value="unknown">归属未知</option>
              </select>
            </label>
          </div>
          {scope !== "personal" && (
            <TextInput
              label="项目或环境位置"
              value={scopePath}
              onChange={setScopePath}
            />
          )}
          <TextInput
            label="来源 Harness（可选）"
            value={harness}
            onChange={setHarness}
          />
          <TextInput
            label="来源 Agent（可选）"
            value={agent}
            onChange={setAgent}
          />
          <Button
            label={busy ? "正在登记…" : "登记资料"}
            type="submit"
            variant="primary"
            isDisabled={busy}
          />
        </form>
      )}
    </div>
  );
}
