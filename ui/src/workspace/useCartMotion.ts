import { useEffect, useRef } from "react";
import { arcFrames, ease, dur } from "./motion";
import type { VisualAsset } from "./Visuals";
export function useCartMotion(
  reduced: boolean,
  narrow: boolean,
  overlay: boolean,
) {
  const bagRef = useRef<HTMLButtonElement>(null),
    pillRef = useRef<HTMLButtonElement>(null);
  const flights = useRef(
    new Map<string, { nodes: HTMLElement[]; anims: Animation[] }>(),
  );
  const landDelay = useRef(new Map<string, number>());
  useEffect(() => {
    if (reduced) cancelFlights();
  }, [reduced]);
  useEffect(() => {
    const stop = () => cancelFlights();
    addEventListener("resize", stop);
    return () => {
      removeEventListener("resize", stop);
      cancelFlights();
    };
  }, []);
  function cancelFlights() {
    flights.current.forEach((f) => {
      f.anims.forEach((a) => a.cancel());
      f.nodes.forEach((n) => n.remove());
    });
    flights.current.clear();
    document.querySelectorAll(".land-ring").forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.remove();
    });
    bagRef.current?.getAnimations().forEach((a) => a.cancel());
    pillRef.current?.getAnimations().forEach((a) => a.cancel());
  }
  function cartTarget() {
    return (narrow ? pillRef.current : bagRef.current)?.getBoundingClientRect();
  }

  function bump(kind: "in" | "out") {
    const el = narrow ? pillRef.current : bagRef.current;
    if (!el || reduced) return;
    const frames =
      kind === "in"
        ? [
            { transform: "scale(1)" },
            { transform: "scale(0.8) rotate(-6deg)", offset: 0.18 },
            { transform: "scale(1)" },
          ]
        : [
            { transform: "scale(1)" },
            { transform: "scale(0.9) rotate(4deg)", offset: 0.25 },
            { transform: "scale(1)" },
          ];
    el.animate(frames, {
      duration: dur("bouncy"),
      easing: kind === "in" ? ease("bouncy") : ease("snappy"),
    });
    if (kind === "in") {
      const r = el.getBoundingClientRect();
      const ring = document.createElement("div");
      ring.className = "land-ring";
      ring.setAttribute("aria-hidden", "true");
      ring.style.left = `${r.left + r.width / 2}px`;
      ring.style.top = `${r.top + r.height / 2}px`;
      document.body.append(ring);
      ring
        .animate(
          [
            { transform: "translate(-50%,-50%) scale(.4)", opacity: 0.55 },
            { transform: "translate(-50%,-50%) scale(2.1)", opacity: 0 },
          ],
          { duration: 620, easing: "cubic-bezier(.2,.7,.2,1)" },
        )
        .finished.catch(() => {})
        .finally(() => ring.remove());
    }
  }

  function fly(asset: VisualAsset, removing: boolean) {
    const prev = flights.current.get(asset.id);
    const prevRect = prev?.nodes[0]?.getBoundingClientRect();
    if (prev) {
      prev.anims.forEach((a) => a.cancel());
      prev.nodes.forEach((n) => n.remove());
      flights.current.delete(asset.id);
    }
    if (reduced || overlay) return false;
    const cardTile = document.querySelector<HTMLElement>(
      `[data-tile="${asset.id}"]`,
    );
    const cart = cartTarget();
    if (!cart || cart.width === 0) return false;
    const tileRect = cardTile?.getBoundingClientRect();
    const from =
      prevRect ||
      (removing
        ? document
            .querySelector(`[data-stack="${asset.id}"]`)
            ?.getBoundingClientRect() || cart
        : tileRect);
    const to = removing ? tileRect : cart;
    if (!from || !to || to.width === 0 || to.bottom < 0 || to.top > innerHeight)
      return false;

    const size = 46;
    const sx = from.left + from.width / 2 - size / 2,
      sy = from.top + from.height / 2 - size / 2;
    const ex = to.left + to.width / 2 - size / 2,
      ey = to.top + to.height / 2 - size / 2;
    const token = document.createElement("div");
    token.className = "token";
    token.setAttribute("aria-hidden", "true");
    token.innerHTML =
      (cardTile || document.querySelector(`[data-stack="${asset.id}"]`))
        ?.innerHTML || "";
    token.style.left = `${sx}px`;
    token.style.top = `${sy}px`;
    const nodes = [token],
      anims: Animation[] = [];
    const duration = removing ? 560 : 700;
    const opts = removing
      ? {
          lift: 80,
          startScale: 0.5,
          peakScale: 0.9,
          endScale: 1,
          spin: 8,
          fadeEnd: true,
        }
      : { lift: 150, spin: -12 };
    const frames = arcFrames(sx, sy, ex, ey, opts);
    document.body.append(token);
    anims.push(
      token.animate(frames, {
        duration,
        easing: "cubic-bezier(.5,0,.3,1)",
        fill: "forwards",
      }),
    );
    if (!removing) {
      // 彗尾：两颗跟随的小光点
      [1, 2].forEach((i) => {
        const dot = document.createElement("div");
        dot.className = "trail";
        dot.setAttribute("aria-hidden", "true");
        dot.style.left = `${sx + size / 2 - 5}px`;
        dot.style.top = `${sy + size / 2 - 5}px`;
        document.body.append(dot);
        nodes.push(dot);
        const f = arcFrames(sx, sy, ex, ey, {
          ...opts,
          startScale: 1 - i * 0.25,
          peakScale: 1 - i * 0.2,
          endScale: 0.3,
        }).map((k) => ({ ...k, opacity: k.opacity * (0.55 - i * 0.18) }));
        anims.push(
          dot.animate(f, {
            duration,
            delay: i * 55,
            easing: "cubic-bezier(.5,0,.3,1)",
            fill: "both",
          }),
        );
      });
    }
    flights.current.set(asset.id, { nodes, anims });
    anims[0].finished
      .then(() => {
        if (flights.current.get(asset.id)?.nodes[0] === token) {
          if (!removing) bump("in");
          else
            cardTile?.animate(
              [
                { transform: "scale(1)" },
                { transform: "scale(1.14)", offset: 0.3 },
                { transform: "scale(1)" },
              ],
              { duration: dur("bouncy"), easing: ease("bouncy") },
            );
        }
      })
      .catch(() => {})
      .finally(() => {
        Promise.allSettled(anims.map((a) => a.finished)).then(() => {
          nodes.forEach((n) => n.remove());
          if (flights.current.get(asset.id)?.nodes[0] === token)
            flights.current.delete(asset.id);
        });
      });
    return duration;
  }

  return { fly, cancel: cancelFlights, bump, bagRef, pillRef, landDelay };
}
