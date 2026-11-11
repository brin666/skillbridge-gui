import { Button } from "@astryxdesign/core/Button";
import { Glyph } from "./Glyph";
import { sourceNames } from "./provenance";
import { asError, problemText } from "./api";
import type { Asset, Kind, Problem, Omission } from "./types";

export const categories: Array<{
  id: Kind;
  label: string;
  icon: string;
  subtitle: string;
  tone: string;
}> = [
  {
    id: "skill",
    label: "Skills",
    icon: "layers",
    subtitle: "挑选这次任务需要的技能。",
    tone: "blue",
  },
  {
    id: "rule",
    label: "规则",
    icon: "file",
    subtitle: "把工作约定一起带给下一个 Agent。",
    tone: "amber",
  },
  {
    id: "memory",
    label: "记忆",
    icon: "memory",
    subtitle: "保留项目背景，减少重复解释。",
    tone: "violet",
  },
  {
    id: "mcp",
    label: "MCP",
    icon: "plug",
    subtitle: "选取工具配置与依赖说明。",
    tone: "cyan",
  },
  {
    id: "ledger",
    label: "账本",
    icon: "chart",
    subtitle: "按需附上已有任务记录。",
    tone: "rose",
  },
];
export const kindName = (kind: Kind) =>
  categories.find((c) => c.id === kind)!.label;
export const confirmationName = (value: string) =>
  ({
    draft: "待确认",
    confirmed: "已确认",
    outdated: "已过期",
    not_required: "无需确认",
  })[value] || value;
export const sourceName = (asset: Asset) => sourceNames(asset).join(" / ");
export const scopeName = (asset: Asset) =>
  ({ personal: "个人", project: "项目", environment: "应用环境" })[
    asset.scope.type
  ] || "未标明范围";
export const dateText = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });
export function AssetIcon({
  kind,
  small = false,
}: {
  kind: Kind;
  small?: boolean;
}) {
  const c = categories.find((c) => c.id === kind)!;
  return (
    <span className={`asset-icon tone-${c.tone} ${small ? "small" : ""}`}>
      <Glyph name={c.icon} size={small ? 17 : 23} />
    </span>
  );
}
export function Failure({
  error,
  onRetry,
  onDismiss,
  title,
  retryLabel = "重试",
}: {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  title?: string;
  retryLabel?: string;
}) {
  const failure = asError(error);
  return (
    <div className="failure-box" role="alert">
      <div className="failure-heading">
        <Glyph name="warning" size={18} />
        <strong>{title || failure.message}</strong>
        {onDismiss && (
          <button
            className="icon-button"
            aria-label="关闭错误提示"
            onClick={onDismiss}
          >
            <Glyph name="close" size={16} />
          </button>
        )}
      </div>
      {title && <p>{failure.message}</p>}
      <details>
        <summary>技术详情</summary>
        <pre>{JSON.stringify(failure.problem, null, 2)}</pre>
      </details>
      {onRetry && <Button label={retryLabel} size="sm" onClick={onRetry} />}
    </div>
  );
}
const omissionReasons: Record<string, string> = {
  generated_or_repository_directory: "已排除依赖、缓存或版本库目录。",
  local_credentials: "已排除本机凭据文件。",
  link_not_followed: "未跟随符号链接；需要时请在接收环境另行准备。",
};
export function Notes({
  title,
  items,
}: {
  title: string;
  items: Array<Problem | Omission>;
}) {
  return (
    <section className="detail-section">
      <h3>
        {title} <span>{items.length}</span>
      </h3>
      {items.length ? (
        <ul className="notes-list">
          {items.map((p, i) => (
            <li key={i}>
              <strong>
                {p.path ||
                  ("field" in p ? p.field : undefined) ||
                  p.assetId ||
                  ("code" in p ? p.code : undefined)}
              </strong>
              <span>
                {"reason" in p
                  ? omissionReasons[p.reason] ||
                    "此文件已由后端排除，具体原因见详情。"
                  : problemText(p)}
              </span>
              <details>
                <summary>详情</summary>
                <pre>{JSON.stringify(p, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy">没有记录到{title}。</p>
      )}
    </section>
  );
}
export function Empty({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="search-empty">
      <Glyph name="folder" size={34} />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <Button label={action} onClick={onAction} />}
    </div>
  );
}
