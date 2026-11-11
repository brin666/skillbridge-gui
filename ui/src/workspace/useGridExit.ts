import { useEffect, useRef } from "react";

/** Preserve the v2 exit using only the currently rendered window, not a second full list. */
export function useGridExit(reduced: boolean) {
  const layer = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (reduced) layer.current?.replaceChildren();
  }, [reduced]);
  function capture() {
    clearTimeout(timer.current);
    const host = layer.current;
    if (!host) return;
    host.replaceChildren();
    const grid = host.parentElement?.querySelector<HTMLElement>(":scope > .asset-grid");
    if (reduced || !grid) return;
    const copy = grid.cloneNode(true) as HTMLElement;
    copy.className = "asset-grid grid-out";
    copy.inert = true;
    copy.setAttribute("aria-hidden", "true");
    // A rapid reversal starts the outgoing layer at its current visible position.
    const originals = grid.querySelectorAll<HTMLElement>(".cell, .tilt, .tile, .spot");
    copy.querySelectorAll<HTMLElement>(".cell, .tilt, .tile, .spot").forEach((node, index) => {
      const style = getComputedStyle(originals[index]);
      node.style.animation = "none";
      node.style.transition = "none";
      node.style.transform = style.transform;
      node.style.opacity = style.opacity;
      node.style.filter = style.filter;
    });
    copy.querySelectorAll<HTMLElement>("*").forEach(node => {
      for (const attr of [...node.attributes]) {
        if (attr.name === "id" || attr.name.startsWith("data-") || attr.name.startsWith("aria-")) node.removeAttribute(attr.name);
      }
      if (node.matches("button, input, [tabindex]")) node.tabIndex = -1;
    });
    host.append(copy);
    timer.current = setTimeout(() => host.replaceChildren(), 240);
  }
  return {layer, capture};
}
