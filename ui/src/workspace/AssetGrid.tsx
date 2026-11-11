import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ItemCard, type VisualAsset } from "./Visuals";

const ROW = 262, GAP = 20;
const focusable = 'button:not([disabled]):not([aria-disabled="true"]):not([tabindex="-1"]), [tabindex="0"]:not([aria-disabled="true"])';

/** Keep a small window of real assets; focus can cross its edges using Tab. */
export function AssetGrid({items, selected, pending, disabled, direction, onAdd, onOpen}: {
  items: VisualAsset[]; selected: Set<string>; pending: string[]; disabled: boolean;
  direction: number;
  onAdd: (id: string) => void; onOpen: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({width: 0, columns: 1, start: 0, end: 12});
  const [focused, setFocused] = useState<string | null>(null);
  const pendingFocus = useRef<{index: number; last: boolean} | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const grid = root.current;
      if (!grid) return;
      const width = grid.clientWidth;
      const columns = innerWidth <= 900 ? 1 : Math.max(1, Math.floor((width + GAP) / (262 + GAP)));
      const top = Math.max(0, -grid.getBoundingClientRect().top);
      const start = Math.max(0, Math.floor(top / ROW) - 2) * columns;
      const end = Math.min(items.length, (Math.ceil((top + innerHeight) / ROW) + 2) * columns);
      setView(old => old.width === width && old.columns === columns && old.start === start && old.end === end
        ? old : {width, columns, start, end});
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    if (root.current) observer.observe(root.current);
    addEventListener("scroll", schedule, {passive: true});
    addEventListener("resize", schedule);
    measure();
    return () => { observer.disconnect(); removeEventListener("scroll", schedule); removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, [items.length]);
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const cell = root.current?.querySelector(`[data-index="${target.index}"]`);
    const controls = cell?.querySelectorAll<HTMLElement>(focusable);
    if (controls?.length) {
      controls[target.last ? controls.length - 1 : 0].focus({preventScroll: true});
      pendingFocus.current = null;
    }
  });
  function keyboard(event: KeyboardEvent) {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>("[data-index]");
    if (!cell) return;
    const controls = [...cell.querySelectorAll<HTMLElement>(focusable)];
    if (target !== controls[event.shiftKey ? 0 : controls.length - 1]) return;
    const index = Number(cell.dataset.index) + (event.shiftKey ? -1 : 1);
    if (index < 0 || index >= items.length) return;
    if (root.current?.querySelector(`[data-index="${index}"]`)) return;
    event.preventDefault();
    pendingFocus.current = {index, last: event.shiftKey};
    setFocused(items[index].id);
    const offset = root.current!.getBoundingClientRect().top + scrollY;
    window.scrollTo({top: offset + Math.floor(index / view.columns) * ROW - 80, behavior: "instant"});
  }
  const indices = new Set<number>();
  for (let i = view.start; i < Math.min(items.length, view.end); i++) indices.add(i);
  const focusIndex = items.findIndex(a => a.id === focused);
  if (focusIndex >= 0) indices.add(focusIndex);
  return <div ref={root} className={`asset-grid grid-in dir-${direction}`} role="list" aria-label="资料列表"
    style={{height: Math.max(0, Math.ceil(items.length / view.columns) * ROW - GAP)}}
    onKeyDown={keyboard} onFocusCapture={event => {
      const index = Number((event.target as HTMLElement).closest<HTMLElement>("[data-index]")?.dataset.index);
      if (items[index]) setFocused(items[index].id);
    }}>
    {[...indices].sort((a,b) => a-b).map(index => {
      const asset = items[index], width = (view.width - GAP * (view.columns - 1)) / view.columns;
      return <div className="asset-grid-cell" key={asset.id} role="listitem" data-index={index}
        aria-posinset={index + 1} aria-setsize={items.length}
        style={{width: Math.max(0, width), height: ROW - GAP,
          transform: `translate(${(index % view.columns) * (width + GAP)}px, ${Math.floor(index / view.columns) * ROW}px)`}}>
        <ItemCard asset={asset} index={Math.max(0, Math.min(index - view.start, 11))}
          added={selected.has(asset.id)} disabled={disabled || pending.includes(asset.id)}
          onAdd={() => onAdd(asset.id)} onOpen={() => onOpen(asset.id)} />
      </div>;
    })}
  </div>;
}
