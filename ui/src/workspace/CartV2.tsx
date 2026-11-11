import { useRef, useEffect, type RefObject } from "react";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Glyph } from "./Glyph";
import { Failure } from "./shared";
import { Ticker, Tile, usePresence, type VisualAsset } from "./Visuals";
import type { WorkspaceModel } from "./useWorkspace";
import type { CartContext } from "./types";
export interface CartProps {
  model: WorkspaceModel;
  selected: VisualAsset[];
  context: CartContext;
  setContext: (value: CartContext) => void;
  dirty: boolean;
  reduced: boolean;
  landDelay: RefObject<Map<string, number>>;
  run: (action: () => Promise<unknown>) => void;
  onDrafts: () => void;
  onOpen: (id: string) => void;
  onPreview: () => void;
  onJob: () => void;
  onClear: () => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  onSave: () => Promise<unknown>;
}
export function CartPanel({
  model,
  selected,
  context,
  setContext,
  dirty,
  reduced,
  landDelay,
  run,
  onDrafts,
  onOpen,
  onPreview,
  onJob,
  onClear,
  onRemove,
  onSave,
  onClose,
  docked = false,
}: CartProps & { onClose: () => void; docked?: boolean }) {
  const { cartState } = model;
  const cart = cartState.cart;
  const rows = usePresence(selected, reduced ? 0 : 280);
  const busy =
    cartState.locked ||
    cartState.blocked ||
    !model.connected ||
    model.loading ||
    model.creating ||
    model.issues.some((i) => i.area === "交接包草稿");
  return (
    <div className="cart">
      <div className="cart-head">
        <h2>
          交接包
          <span className="cart-n" data-cart-count={selected.length}>
            <Ticker value={selected.length} />
            <span className="sr-only">{selected.length} 项</span>
          </span>
        </h2>
        <div className="cart-head-actions">
          <Tooltip content="交接包草稿">
            <IconButton
              label="交接包草稿"
              variant="ghost"
              size="sm"
              icon={<Glyph name="folder" size={16} />}
              onClick={onDrafts}
            />
          </Tooltip>
          {selected.length > 0 && (
            <Button
              label="清空"
              variant="ghost"
              size="sm"
              isDisabled={busy || !!cartState.pending.length}
              onClick={() => run(onClear)}
            />
          )}
          <IconButton
            label={docked ? "收起" : "关闭"}
            variant="ghost"
            size="sm"
            icon={<Glyph name="close" size={16} />}
            onClick={onClose}
          />
        </div>
      </div>
      <div className="cart-task">
        <TextInput
          label="本次任务"
          value={context.task?.description || ""}
          isDisabled={!cart || busy || cartState.pending.includes("context")}
          onChange={(description) =>
            setContext({
              ...context,
              task: description ? { ...context.task, description } : null,
            })
          }
          placeholder="这次想完成什么？"
        />
        {dirty && (
          <div className="context-save">
            <Button
              label="保存任务"
              size="sm"
              isDisabled={busy || !!cartState.pending.length}
              onClick={() => run(onSave)}
            />
            <span>尚未保存</span>
          </div>
        )}
      </div>
      <div className="cart-list">
        {!rows.length && (
          <div className="cart-empty">
            <span className="empty-orb">
              <Glyph name="bag" size={24} />
            </span>
            <p>还是空的</p>
          </div>
        )}
        {rows.map(({ item, leaving }) => (
          <div
            key={item.id}
            className={`row ${leaving ? "leaving" : ""}`}
            style={
              landDelay.current.get(item.id)
                ? { animationDelay: `${landDelay.current.get(item.id)}ms` }
                : undefined
            }
          >
            <Tile asset={item} size="sm" />
            <button
              className="row-name"
              disabled={leaving}
              onClick={() => onOpen(item.id)}
              tabIndex={leaving ? -1 : 0}
            >
              {item.title}
              {item.state && (
                <Tooltip content={item.state}>
                  <span className="flag" />
                </Tooltip>
              )}
            </button>
            <IconButton
              label={`移除 ${item.title}`}
              variant="ghost"
              size="sm"
              icon={<Glyph name="close" size={14} />}
              onClick={() => run(() => onRemove(item.id))}
              isDisabled={
                leaving || busy || cartState.pending.includes(item.id)
              }
            />
          </div>
        ))}
      </div>
      <div className="cart-foot">
        {cartState.blocked && (
          <Failure
            error={cartState.error}
            onRetry={() => run(() => model.session.acknowledge())}
            retryLabel="已核对最新草稿，继续"
          />
        )}
        <Button
          label={model.previewing ? "检查中…" : "预览交接"}
          variant="primary"
          size="lg"
          width="100%"
          isDisabled={
            !selected.length ||
            busy ||
            dirty ||
            !!cartState.pending.length ||
            model.previewing
          }
          endContent={<Glyph name="arrow" size={17} />}
          onClick={onPreview}
        />
        {cartState.pending.length > 0 && (
          <p className="muted-copy" role="status">
            正在保存…
          </p>
        )}
        {(model.job || model.intent) && (
          <button className="text-button" onClick={onJob}>
            查看导出任务
          </button>
        )}
      </div>
    </div>
  );
}
export function Dock({
  open,
  setOpen,
  bagRef,
  ...props
}: CartProps & {
  open: boolean;
  setOpen: (value: boolean) => void;
  bagRef: RefObject<HTMLButtonElement | null>;
}) {
  const dockRef = useRef<HTMLElement>(null);
  const stack = usePresence(
    [...props.selected].reverse().slice(0, 6),
    props.reduced ? 0 : 280,
  );
  const extra = Math.max(0, props.selected.length - 6);
  useEffect(() => {
    if (!open) return;
    const down = (e: globalThis.PointerEvent) => {
      const target = e.target as Element;
      if (
        dockRef.current &&
        !dockRef.current.contains(target) &&
        !target.closest("[data-add]") &&
        !target.closest("dialog")
      )
        setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        setOpen(false);
    };
    addEventListener("pointerdown", down);
    addEventListener("keydown", key);
    return () => {
      removeEventListener("pointerdown", down);
      removeEventListener("keydown", key);
    };
  }, [open, setOpen]);
  return (
    <aside
      ref={dockRef}
      className={`dock ${open ? "open" : ""} ${props.selected.length ? "has" : ""}`}
      aria-label="交接包"
      onClick={(event) => {
        if (
          !open &&
          !(event.target as Element).closest(
            "button, input, textarea, select, a, [role='button']",
          )
        ) {
          setOpen(true);
        }
      }}
    >
      <button
        ref={bagRef}
        className="bag"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`交接包，${props.selected.length} 项`}
      >
        <Glyph name="bag" size={22} />
        <span className="bag-count">
          <Ticker value={props.selected.length} />
        </span>
      </button>
      <div className="dock-slim" aria-hidden={open} inert={open}>
        <div className="stack">
          {stack.map(({ item, leaving }) => (
            <button
              key={item.id}
              className={`stack-item ${leaving ? "leaving" : ""}`}
              data-stack={leaving ? undefined : item.id}
              disabled={leaving}
              tabIndex={open || leaving ? -1 : 0}
              style={
                props.landDelay.current.get(item.id)
                  ? {
                      animationDelay: `${props.landDelay.current.get(item.id)}ms`,
                    }
                  : undefined
              }
              onClick={() => setOpen(true)}
              aria-label={item.title}
            >
              <Glyph name={item.icon} size={16} />
            </button>
          ))}
          {extra > 0 && <span className="stack-more">+{extra}</span>}
          {!props.selected.length && (
            <span className="stack-slot" aria-hidden="true" />
          )}
        </div>
        <Tooltip content="预览交接" placement="start">
          <button
            className="dock-go"
            disabled={
              !props.selected.length ||
              props.dirty ||
              props.model.cartState.locked ||
              props.model.cartState.blocked ||
              !!props.model.cartState.pending.length ||
              !props.model.connected ||
              props.model.loading ||
              props.model.creating ||
              props.model.issues.some((i) => i.area === "交接包草稿")
            }
            onClick={props.onPreview}
            aria-label="预览交接"
            tabIndex={open ? -1 : 0}
          >
            <Glyph name="arrow" size={18} />
          </button>
        </Tooltip>
      </div>
      <div className="dock-full" aria-hidden={!open} inert={!open}>
        <CartPanel {...props} docked onClose={() => setOpen(false)} />
      </div>
    </aside>
  );
}
