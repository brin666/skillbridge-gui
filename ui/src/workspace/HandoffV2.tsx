import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { WorkspaceError } from "./api";
import { Glyph } from "./Glyph";
import { confirmationName, Failure, kindName, Notes } from "./shared";
import { Tile, type VisualAsset } from "./Visuals";
import { PackagePrompt } from "./PromptView";
import type { CartContext } from "./types";
import type { WorkspaceModel } from "./useWorkspace";
const phases: Record<string, string> = {
  queued: "等待开始",
  checking: "检查资料",
  copying: "复制文件",
  verifying: "核对完整性",
  publishing: "发布文件包",
  finished: "已结束",
};
export function HandoffPanel({
  model,
  run,
  selected,
  context,
  setContext,
  dirty,
  onSave,
  onRemove,
  onClose,
  onAsset,
  onPackage,
}: {
  model: WorkspaceModel;
  run: (action: () => Promise<unknown>) => void;
  selected: VisualAsset[];
  context: CartContext;
  setContext: (c: CartContext) => void;
  dirty: boolean;
  onSave: () => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  onClose: () => void;
  onAsset: (id: string) => void;
  onPackage: (id: string) => void;
}) {
  const { cartState, preview, job, intent, submitting } = model;
  const current =
    !!preview &&
    preview.cart.id === cartState.cart?.id &&
    preview.cart.version === cartState.cart.version;
  const busy =
    cartState.blocked ||
    cartState.locked ||
    !!cartState.pending.length ||
    !model.connected ||
    model.creating ||
    model.loading ||
    model.issues.some((i) => i.area === "交接包草稿");
  const canExport =
    current && preview.canExport && !busy && !dirty && !model.previewing;
  const jobCurrent =
    job?.cartId === cartState.cart?.id &&
    job?.cartVersion === cartState.cart?.version;
  const ready = job?.status === "complete" && jobCurrent && !!job.packageId;
  return (
    <div
      className={`handoff phase-${ready ? "ready" : job?.status === "running" ? "generating" : "idle"}`}
    >
      <div className="ho-head">
        <h2>交接预览</h2>
        <IconButton
          label="关闭"
          variant="ghost"
          icon={<Glyph name="close" size={18} />}
          onClick={onClose}
          data-autofocus
        />
      </div>
      <div className="ho-fields">
        <TextInput
          label="本次任务"
          value={context.task?.description || ""}
          isDisabled={busy}
          onChange={(description) =>
            setContext({
              ...context,
              task: description ? { ...context.task, description } : null,
            })
          }
        />
        <TextInput
          label="项目位置"
          placeholder="可选 · 绝对路径"
          value={context.project?.path || ""}
          isDisabled={busy}
          onChange={(path) =>
            setContext({
              ...context,
              project: path ? { ...context.project, path } : null,
            })
          }
        />
      </div>
      <details className="context-options">
        <summary>目标与操作范围</summary>
        <div className="form-pair">
          <TextInput
            label="目标 Harness（可选）"
            value={context.targetHint?.harness || ""}
            isDisabled={busy}
            onChange={(harness) =>
              setContext({
                ...context,
                targetHint: { ...context.targetHint, harness },
              })
            }
          />
          <TextInput
            label="目标 Agent（可选）"
            value={context.targetHint?.agent || ""}
            isDisabled={busy}
            onChange={(agent) =>
              setContext({
                ...context,
                targetHint: { ...context.targetHint, agent },
              })
            }
          />
        </div>
        <label className="form-field">
          操作范围
          <textarea
            aria-label="操作范围"
            value={context.operationScope}
            disabled={busy}
            rows={3}
            onChange={(e) =>
              setContext({ ...context, operationScope: e.target.value })
            }
          />
        </label>
      </details>
      {dirty && (
        <div className="context-save">
          <Button
            label="保存并重新检查"
            isDisabled={busy}
            onClick={() =>
              run(async () => {
                await onSave();
                await model.preparePreview();
              })
            }
          />
          <span>任务信息尚未保存</span>
        </div>
      )}
      <div className="ho-chips">
        {selected.length === 0 && <p className="ho-empty">交接包是空的</p>}
        {selected.map((item) => (
          <span className="ho-chip" key={item.id}>
            <Tile asset={item} size="sm" />
            <button className="chip-title" onClick={() => onAsset(item.id)}>
              {item.title}
            </button>
            {item.state && (
              <Tooltip content={item.state}>
                <span className="flag" tabIndex={0} />
              </Tooltip>
            )}
            <button
              className="ho-x"
              aria-label={`移除 ${item.title}`}
              disabled={busy}
              onClick={() => run(() => onRemove(item.id))}
            >
              <Glyph name="close" size={12} />
            </button>
          </span>
        ))}
      </div>
      {model.error && <Failure error={model.error} />}{" "}
      {cartState.blocked && (
        <Failure
          error={cartState.error}
          retryLabel="已核对最新草稿，继续"
          onRetry={() => run(() => model.session.acknowledge())}
        />
      )}
      <div className="preview-summary">
        <span>
          {model.previewing
            ? "正在检查资料…"
            : current
              ? preview.canExport
                ? "资料检查通过"
                : "有内容需要核对"
              : "请检查当前草稿"}
        </span>
        <Button
          label="重新检查"
          variant="ghost"
          size="sm"
          isDisabled={busy || dirty || model.previewing}
          onClick={() => run(() => model.preparePreview())}
        />
      </div>
      {current &&
        preview.errors.map((problem, i) => (
          <div key={i}>
            <Failure error={new WorkspaceError(problem)} />
            {problem.assetId && (
              <Button
                label="查看资料与修订"
                onClick={() => onAsset(problem.assetId!)}
              />
            )}
          </div>
        ))}
      {current && (
        <details className="manifest-details">
          <summary>实际文件与待补事项 · {preview.items.length} 项资料</summary>
          <p className="muted-copy">{preview.cart.operationScope}</p>
          <p className="muted-copy">
            导出目录：{model.status?.dataHome}/handoffs/
          </p>
          {preview.items.map((item) => (
            <article className="preview-asset" key={item.assetId}>
              <h3>{item.title}</h3>
              <p className="muted-copy">
                {kindName(item.kind)} · {confirmationName(item.confirmation)} ·{" "}
                {item.scope.type === "project"
                  ? "项目"
                  : item.scope.type === "environment"
                    ? "应用环境"
                    : "个人"}{" "}
                {item.scope.path}
              </p>
              <ul className="file-list">
                {item.files.map((f) => (
                  <li key={f.path}>
                    <code>{f.path}</code>
                    <span>{f.size.toLocaleString()} B</span>
                  </li>
                ))}
              </ul>
              <Notes title="排除项" items={item.omissions} />
              <Notes title="待补事项" items={item.followUps} />
            </article>
          ))}
        </details>
      )}
      {intent && !job && (
        <p className="warning-box">请求结果尚未确认，重试将沿用原请求编号。</p>
      )}
      {job && (
        <section className={`job-panel job-${job.status}`} aria-live="polite">
          <h3>
            {job.status === "running"
              ? "正在生成交接包"
              : job.status === "complete"
                ? "包已生成"
                : job.status === "cancelled"
                  ? "导出已取消"
                  : "导出失败"}
          </h3>
          <p>
            {phases[job.phase] || job.phase}
            {job.cancelRequested && job.status === "running"
              ? " · 等待取消确认"
              : ""}
            {!jobCurrent ? " · 对应先前草稿版本" : ""}
          </p>
          {job.error && <Failure error={new WorkspaceError(job.error)} />}
          <details>
            <summary>任务详情</summary>
            <pre>
              {JSON.stringify(
                {
                  id: job.id,
                  requestId: job.requestId,
                  status: job.status,
                  phase: job.phase,
                  cartVersion: job.cartVersion,
                },
                null,
                2,
              )}
            </pre>
          </details>
          {job.status === "running" && (
            <Button
              label={job.cancelRequested ? "等待取消确认" : "取消导出"}
              isDisabled={job.cancelRequested}
              onClick={() => run(() => model.cancelExport())}
            />
          )}{" "}
          {job.status === "complete" && job.packageId && (
            <Button
              label="包详情与接收结果"
              variant="ghost"
              onClick={() => onPackage(job.packageId!)}
            />
          )}
        </section>
      )}
      {model.pollError && (
        <Failure error={model.pollError} onRetry={model.retryPoll} />
      )}
      {ready ? (
        <PackagePrompt id={job.packageId!} />
      ) : (
        <div className="ho-prompt">
          <div className={`ho-gen ${job?.status === "running" ? "busy" : ""}`}>
            <span className="gen-orb" aria-hidden="true">
              <Glyph name="sparkle" size={22} />
            </span>
            <Button
              label={
                submitting
                  ? "正在提交…"
                  : job?.status === "running"
                    ? "正在生成…"
                    : intent && !job
                      ? "查询／重试原请求"
                      : job?.status === "failed" || job?.status === "cancelled"
                        ? "重新生成（新任务）"
                        : "生成交接包"
              }
              variant="primary"
              size="lg"
              isDisabled={
                submitting ||
                job?.status === "running" ||
                (!intent && !canExport)
              }
              onClick={() => run(() => model.startExport(!!intent))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
