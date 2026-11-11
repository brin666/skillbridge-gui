import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Card } from "@astryxdesign/core/Card";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Glyph } from "./Glyph";
import { categories } from "./shared";
import type { Kind } from "./types";
export interface VisualAsset {
  id: string;
  title: string;
  icon: string;
  source: string;
  brief: string;
  subtitle?: string;
  description?: string;
  locationLabel?: string;
  footer?: string;
  state?: string;
  frequent?: boolean;
  recommended?: boolean;
}
export function useMedia(query: string) {
  const [value, setValue] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const change = () => setValue(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, [query]);
  return value;
}
export function usePresence<T extends { id: string }>(items: T[], ms: number) {
  const [list, setList] = useState(() =>
    items.map((item) => ({ item, leaving: false })),
  );
  const latest = useRef(items);
  latest.current = items;
  const sig = items.map((i) => i.id).join("|");
  useLayoutEffect(() => {
    const now = latest.current;
    setList((prev) => {
      const ids = new Set(now.map((i) => i.id));
      const next = now.map((item) => ({ item, leaving: false }));
      if (ms > 0)
        prev.forEach((e, idx) => {
          if (!ids.has(e.item.id))
            next.splice(Math.min(idx, next.length), 0, {
              item: e.item,
              leaving: true,
            });
        });
      return next;
    });
    if (ms > 0) {
      const t = setTimeout(
        () => setList((l) => l.filter((e) => !e.leaving)),
        ms,
      );
      return () => clearTimeout(t);
    }
  }, [sig, ms]);
  return list.map((e) => ({
    ...e,
    item: items.find((i) => i.id === e.item.id) || e.item,
  }));
}
export function Ticker({ value }: { value: number }) {
  const [tick, setTick] = useState({value, direction: "up"});
  if (tick.value !== value) {
    setTick({value, direction: value > tick.value ? "up" : "down"});
  }
  return (
    <span className="ticker" aria-hidden="true">
      <span key={value} className={`tick tick-${tick.direction}`}>
        {value}
      </span>
    </span>
  );
}
export function Tile({
  asset,
  size = "md",
  tileId,
}: {
  asset: VisualAsset;
  size?: "sm" | "md" | "lg";
  tileId?: string;
}) {
  return (
    <span className={`tile tile-${size}`} data-tile={tileId}>
      <Glyph
        name={asset.icon}
        size={size === "lg" ? 26 : size === "sm" ? 15 : 21}
      />
    </span>
  );
}
const harness: Record<string, string> = {
  Codex: "codex",
  "Claude Code": "claude",
  Hermes: "hermes",
  Pi: "pi",
  SkillBridge: "bridge",
  Cursor: "cursor",
};
export function Rail({
  category,
  onPick,
  reduced,
  systemReduce,
  setManualReduce,
  onCollect,
  onHistory,
  onStatus,
}: {
  category: Kind;
  onPick: (kind: Kind) => void;
  reduced: boolean;
  systemReduce: boolean;
  setManualReduce: (value: boolean) => void;
  onCollect: () => void;
  onHistory: () => void;
  onStatus: () => void;
}) {
  const idx = categories.findIndex((c) => c.id === category);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const [ind, setInd] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabs.current[idx];
      if (el)
        setInd({
          x: el.offsetLeft,
          y: el.offsetTop,
          w: el.offsetWidth,
          h: el.offsetHeight,
        });
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [idx]);
  return (
    <nav className="rail" aria-label="资料分类">
      <div className="brand" aria-label="SkillBridge">
        <svg width="22" height="22" viewBox="0 0 28 28" aria-hidden="true">
          <path
            d="M5 21V10a9 9 0 0 1 18 0v11M5 15h18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div
        className="rail-tabs"
        role="tablist"
        aria-orientation={
          useMedia("(max-width: 900px)") ? "horizontal" : "vertical"
        }
      >
        {ind && (
          <span
            className="rail-ind"
            style={{
              transform: `translate(${ind.x}px, ${ind.y}px)`,
              width: ind.w,
              height: ind.h,
            }}
            aria-hidden="true"
          />
        )}
        {categories.map((c, i) => (
          <Tooltip key={c.id} content={c.label} placement="end">
            <button
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              aria-selected={category === c.id}
              aria-label={c.label}
              data-category={c.id}
              className={`rail-tab ${category === c.id ? "on" : ""}`}
              onClick={() => onPick(c.id)}
              onKeyDown={(event) => {
                const offset =
                  event.key === "ArrowDown" || event.key === "ArrowRight"
                    ? 1
                    : event.key === "ArrowUp" || event.key === "ArrowLeft"
                      ? -1
                      : 0;
                if (offset) {
                  event.preventDefault();
                  const next =
                    (i + offset + categories.length) % categories.length;
                  onPick(categories[next].id);
                  tabs.current[next]?.focus();
                }
              }}
            >
              <Glyph name={c.icon} size={21} />
              <span className="rail-label">{c.label}</span>
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="rail-foot">
        <Tooltip content="整理与登记" placement="end">
          <button
            className="rail-mini"
            aria-label="整理与登记"
            onClick={onCollect}
          >
            <Glyph name="plus" size={18} />
          </button>
        </Tooltip>
        <Tooltip content="交接历史" placement="end">
          <button
            className="rail-mini"
            aria-label="交接历史"
            onClick={onHistory}
          >
            <Glyph name="folder" size={18} />
          </button>
        </Tooltip>
        <Tooltip
          content={
            systemReduce
              ? "系统已减少动态效果"
              : reduced
                ? "已减少动态效果"
                : "减少动态效果"
          }
          placement="end"
        >
          <button
            className={`rail-mini ${reduced ? "on" : ""}`}
            aria-pressed={reduced}
            aria-label="减少动态效果"
            disabled={systemReduce}
            onClick={() => setManualReduce(!reduced)}
          >
            <Glyph name={reduced ? "calm" : "wave"} size={18} />
          </button>
        </Tooltip>
        <Tooltip content="档案、常用范围与筛选" placement="end">
          <button className="sample" onClick={onStatus}>
            档案
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
export function SourceFilter({
  value,
  onChange,
  sources,
}: {
  value: string;
  onChange: (value: string) => void;
  sources: string[];
}) {
  const opts = [
    { id: "all", label: "全部来源", icon: "all" },
    ...sources.map((label) => ({
      id: label,
      label,
      icon: harness[label] || "folder",
    })),
  ];
  const idx = Math.max(
    0,
    opts.findIndex((o) => o.id === value),
  );
  return (
    <div
      className="seg"
      role="radiogroup"
      aria-label="来源"
      style={{ "--i": idx } as CSSProperties}
    >
      <span className="seg-ind" aria-hidden="true" />
      {opts.map((o) => (
        <Tooltip key={o.id} content={o.label} placement="below">
          <button
            role="radio"
            aria-checked={value === o.id}
            aria-label={o.label}
            tabIndex={value === o.id ? 0 : -1}
            className={value === o.id ? "on" : ""}
            onClick={() => onChange(o.id)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (idx + 1) % opts.length
                : event.key === "ArrowLeft" ? (idx + opts.length - 1) % opts.length
                : event.key === "Home" ? 0 : event.key === "End" ? opts.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              onChange(opts[next].id);
              event.currentTarget.closest('[role="radiogroup"]')
                ?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[next]?.focus();
            }}
          >
            <Glyph name={o.icon} size={17} stroke={1.8} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
export function AddButton({
  added,
  title,
  id,
  onClick,
  disabled = false,
  withLabel = false,
}: {
  added: boolean;
  title: string;
  id: string;
  onClick: () => void;
  disabled?: boolean;
  withLabel?: boolean;
}) {
  const [burst, setBurst] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (added) setBurst((n) => n + 1);
  }, [added]);
  const icon = (
    <span className={`morph ${added ? "is-on" : ""}`} aria-hidden="true">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="m-v" d="M12 5v14" />
        <path className="m-h" d="M5 12h14" />
        <path className="m-c" d="m5 12.5 4.5 4.5L19 7.5" pathLength="1" />
      </svg>
    </span>
  );
  return (
    <span className={`add ${added ? "on" : ""} ${withLabel ? "wide" : ""}`}>
      {burst > 0 && (
        <span key={burst} className="burst" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ "--a": `${i * 45}deg` } as CSSProperties} />
          ))}
        </span>
      )}
      {withLabel ? (
        <Button
          label={added ? "已加入" : "加入"}
          aria-label={`${added ? "移出" : "加入"} ${title}`}
          aria-pressed={added}
          data-add={id}
          isDisabled={disabled}
          variant={added ? "secondary" : "primary"}
          icon={icon}
          onClick={onClick}
        />
      ) : (
        <IconButton
          label={`${added ? "移出" : "加入"} ${title}`}
          aria-pressed={added}
          data-add={id}
          isDisabled={disabled}
          variant={added ? "primary" : "secondary"}
          icon={icon}
          onClick={onClick}
        />
      )}
    </span>
  );
}
export function ItemCard({
  asset,
  added,
  onAdd,
  onOpen,
  index = 0,
  ghost = false,
  disabled = false,
}: {
  asset: VisualAsset;
  added: boolean;
  onAdd?: () => void;
  onOpen?: () => void;
  index?: number;
  ghost?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function move(event: PointerEvent) {
    const card = ref.current;
    if (!card || event.pointerType === "touch" || card.closest(".rm")) return;
    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
    card.style.setProperty("--rx", `${(0.5 - y) * 5}deg`);
    card.style.setProperty("--ry", `${(x - 0.5) * 6}deg`);
  }
  function leave() {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  }
  return (
    <div className="cell" style={{ "--i": index } as CSSProperties}>
      <div
        ref={ref}
        className="tilt readable-card"
        data-asset={ghost ? undefined : asset.id}
        data-selected={added}
        onPointerMove={ghost ? undefined : move}
        onPointerLeave={ghost ? undefined : leave}
      >
        <Card padding={0}>
          <article className="item">
            {!ghost && (
              <button
                className="hit"
                onClick={onOpen}
                aria-label={`查看 ${asset.title}`}
              />
            )}
            <div className="item-top">
              <Tile asset={asset} tileId={ghost ? undefined : asset.id} />
              {asset.locationLabel && <span className="item-location">{asset.locationLabel}</span>}
              <Tooltip content={asset.source} placement="above">
                <span className="harness">
                  <Glyph name={harness[asset.source] || "folder"} size={13} />
                  <span className="sr-only">{asset.source}</span>
                </span>
              </Tooltip>
            </div>
            <h3 className="item-name">
              {asset.title}
              {asset.state && (
                <Tooltip content={asset.state}>
                  <span className="flag" tabIndex={ghost ? -1 : 0}>
                    <span className="sr-only">{asset.state}</span>
                  </span>
                </Tooltip>
              )}
            </h3>
            {asset.subtitle && <p className="item-original" title={asset.subtitle}>{asset.subtitle}</p>}
            <p className="item-description" title={asset.description || asset.brief}>
              {asset.description || asset.brief}
            </p>
            <p className="item-brief" title={asset.brief}>{asset.footer || asset.brief}</p>
            <span className="spot" aria-hidden="true" />
            {!ghost && (
              <AddButton
                added={added}
                title={asset.title}
                id={asset.id}
                disabled={disabled}
                onClick={() => onAdd?.()}
              />
            )}
          </article>
        </Card>
      </div>
    </div>
  );
}
