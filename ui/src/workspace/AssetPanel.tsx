import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { api, asError, WorkspaceError } from "./api";
import {
  AssetIcon,
  confirmationName,
  Failure,
  kindName,
  Notes,
  scopeName,
  sourceName,
} from "./shared";
import type { Asset } from "./types";
import type { WorkspaceModel } from "./useWorkspace";
import { displayTitle, presentationOf } from "./presentation";

export function AssetPanel({
  id,
  model,
  onChange,
}: {
  id: string;
  model: WorkspaceModel;
  onChange: () => Promise<void>;
}) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<WorkspaceError | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadCount, setLoadCount] = useState(0);
  useEffect(() => {
    let active = true;
    setAsset(null);
    setError(null);
    api
      .asset(id)
      .then((a) => {
        if (active) setAsset(a);
      })
      .catch((e) => {
        if (active) setError(asError(e));
      });
    return () => {
      active = false;
    };
  }, [id, loadCount]);
  const selected = model.cartState.cart?.items.find((i) => i.assetId === id);
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChange();
    } catch (e) {
      const issue = asError(e);
      if (issue.code === "VERSION_CONFLICT") {
        try {
          setAsset(await api.asset(id));
        } catch {
          /* Keep the original error visible. */
        }
      }
      setError(issue);
    } finally {
      setBusy(false);
    }
  }
  if (!asset)
    return (
      <div className="panel-content">
        {error ? (
          <Failure error={error} onRetry={() => setLoadCount((n) => n + 1)} />
        ) : (
          <p role="status">正在读取资料…</p>
        )}
      </div>
    );
  const current = asset;
  const presentation = presentationOf(asset);
  const recommended = model.reports.filter((r) => r.assetIds.includes(id));
  const frequent = model.preferences.some(
    (p) => p.assetId === id && p.scope === model.scope && p.frequent,
  );
  return (
    <div className="detail-content">
      <AssetIcon kind={asset.kind} />
      <h2>{displayTitle(asset)}</h2>
      {presentation?.originalName && <p className="muted-copy">{presentation.originalName}</p>}
      {presentation && <section className="detail-section">
        <h3>{asset.kind === "skill" ? presentation.translation || "用途说明" : presentation.titleSource}</h3>
        <p className="muted-copy">{presentation.summary || "暂无文档摘要"}</p>
        {presentation.originalDescription && <details className="technical">
          <summary>原文说明</summary><pre>{presentation.originalDescription}</pre>
        </details>}
      </section>}
      {!presentation && asset.environment?.presentation != null && <p className="muted-copy">
        文件已更新，先前说明已停用。重新整理 Codex 资料后可更新说明。
      </p>}
      {error && <Failure error={error} />}
      <dl className="detail-meta">
        <div>
          <dt>分类</dt>
          <dd>{kindName(asset.kind)}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{sourceName(asset)}</dd>
        </div>
        <div>
          <dt>范围</dt>
          <dd>
            {scopeName(asset)} {asset.scope.path}
          </dd>
        </div>
        <div>
          <dt>确认状态</dt>
          <dd>{confirmationName(asset.confirmation)}</dd>
        </div>
        <div>
          <dt>归属</dt>
          <dd>
            {asset.ownership === "unknown"
              ? "归属未知"
              : asset.ownership === "system"
                ? "系统资料"
                : "用户资料"}
          </dd>
        </div>
        <div>
          <dt>当前常用范围</dt>
          <dd className="break-text">{model.scope}</dd>
        </div>
      </dl>
      <p className="source-path">
        {asset.source.path || `内联资料 · ${asset.source.sourceKey}`}
      </p>
      <details className="technical">
        <summary>资产与修订标识</summary>
        <pre>
          {JSON.stringify(
            {
              assetId: asset.id,
              assetVersion: asset.version,
              revisionId: asset.revisionId,
              selectedRevision: selected?.revisionId,
              threadId: presentation?.threadId,
              titleSource: presentation?.titleSource,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <section className="detail-section">
        <h3>内容</h3>
        {asset.source.content !== undefined ? (
          <pre>{asset.source.content}</pre>
        ) : (
          <p className="muted-copy">
            接口未返回文件正文。以下展示真实元信息与文件清单，不推断正文内容。
          </p>
        )}
      </section>
      <section className="detail-section">
        <h3>
          文件清单 <span>{asset.files.length}</span>
        </h3>
        <ul className="file-list">
          {asset.files.map((f) => (
            <li key={f.path}>
              <code>{f.path}</code>
              <span>{f.size.toLocaleString()} B</span>
            </li>
          ))}
        </ul>
      </section>
      <Notes title="排除项" items={asset.omissions} />
      <Notes title="待补事项" items={asset.followUps} />
      {recommended.length > 0 && (
        <section className="detail-section">
          <h3>Agent 报告</h3>
          {recommended.map((r) => (
            <div className="report-note" key={r.id}>
              <strong>
                {r.type === "recommendation" ? "推荐候选" : "资料观察"}
              </strong>
              <p>{r.evidence || "未提供证据说明"}</p>
              <small>
                报告来源：{r.source} · {r.observedAt || r.createdAt}
              </small>
            </div>
          ))}
          <p className="muted-copy">报告不自动修改常用偏好。</p>
        </section>
      )}
      <div className="detail-actions wrap">
        <Button
          label={frequent ? "取消常用" : "确认为常用"}
          onClick={() => void act(() => model.toggleFrequent(current))}
          isDisabled={busy || model.issues.some((i) => i.area === "常用偏好")}
        />
        {(asset.kind === "rule" || asset.kind === "memory") && (
          <>
            <Button
              label="确认资料"
              isDisabled={busy || asset.confirmation === "confirmed"}
              onClick={() =>
                void act(async () =>
                  setAsset(
                    await api.updateAsset(id, {
                      expectedVersion: current.version,
                      confirmation: "confirmed",
                    }),
                  ),
                )
              }
            />
            <Button
              label="标记过期"
              isDisabled={busy || asset.confirmation === "outdated"}
              onClick={() =>
                void act(async () =>
                  setAsset(
                    await api.updateAsset(id, {
                      expectedVersion: current.version,
                      confirmation: "outdated",
                    }),
                  ),
                )
              }
            />
          </>
        )}
      </div>
      {asset.source.type === "path" && (
        <div className="detail-section">
          <Button
            label="刷新文件资料"
            isDisabled={busy}
            onClick={() =>
              void act(async () => setAsset(await api.refreshAsset(id)))
            }
          />
          <p className="muted-copy">
            刷新后先核对文件与修订，再决定是否更新交接包。
          </p>
        </div>
      )}
      {selected && selected.revisionId !== asset.revisionId && (
        <p className="warning-box">
          交接包仍保留先前修订；刷新资料不会替换本次选择。
        </p>
      )}
      <div className="detail-actions">
        <Button
          label={
            selected
              ? selected.revisionId !== asset.revisionId
                ? "使用此修订更新选择"
                : "已加入 · 更新选择快照"
              : "加入交接包"
          }
          variant="primary"
          isDisabled={
            busy ||
            model.cartState.blocked ||
            model.cartState.locked ||
            model.cartState.pending.includes(id) ||
            asset.ownership === "system"
          }
          onClick={() => void act(() => model.add(current))}
        />
        {selected && (
          <Button
            label="移出交接包"
            isDisabled={
              busy || model.cartState.blocked || model.cartState.locked
            }
            onClick={() => void act(() => model.session.remove(id))}
          />
        )}
      </div>
    </div>
  );
}
