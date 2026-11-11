// 弹簧曲线：模拟一次阻尼弹簧，转换为 CSS linear() 缓动与时长。
export function spring(stiffness, damping, mass = 1) {
  let x = 0, v = 0, t = 0, still = 0;
  const dt = 1 / 240, samples = [0];
  while (t < 2.4) {
    const f = -stiffness * (x - 1) - damping * v;
    v += (f / mass) * dt; x += v * dt; t += dt; samples.push(x);
    if (Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) { if (++still > 20) break; } else still = 0;
  }
  const n = 40, pts = [];
  for (let i = 0; i <= n; i++) pts.push(+samples[Math.round((i / n) * (samples.length - 1))].toFixed(4));
  pts[0] = 0; pts[n] = 1;
  return {duration: Math.round(t * 1000), easing: `linear(${pts.join(', ')})`};
}

const supportsLinear = typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)');
export const springs = {
  snappy: spring(520, 34),
  bouncy: spring(380, 16),
  soft: spring(210, 25),
  gentle: spring(140, 22),
};
const fallback = {snappy: 'cubic-bezier(.2,.9,.3,1)', bouncy: 'cubic-bezier(.34,1.56,.64,1)', soft: 'cubic-bezier(.22,1,.36,1)', gentle: 'cubic-bezier(.22,1,.36,1)'};
export function ease(name) { return supportsLinear ? springs[name].easing : fallback[name]; }
export function dur(name) { return springs[name].duration; }

export function installSpringVars(root = document.documentElement) {
  for (const name of Object.keys(springs)) {
    root.style.setProperty(`--e-${name}`, ease(name));
    root.style.setProperty(`--d-${name}`, `${dur(name)}ms`);
  }
}

// 二次贝塞尔弧线采样为关键帧。
export function arcFrames(sx, sy, ex, ey, {lift = 140, startScale = 1, peakScale = 1.12, endScale = 0.42, spin = -10, fadeEnd = true} = {}) {
  const dx = ex - sx, dy = ey - sy;
  const cx = sx + dx * 0.55, cy = Math.max(-40, Math.min(sy, ey) - lift - Math.abs(dx) * 0.05);
  const frames = [], N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const x = u * u * sx + 2 * u * t * cx + t * t * ex - sx;
    const y = u * u * sy + 2 * u * t * cy + t * t * ey - sy;
    const s = t < 0.22 ? startScale + (peakScale - startScale) * (t / 0.22) : peakScale + (endScale - peakScale) * ((t - 0.22) / 0.78) ** 2.2;
    const r = Math.sin(t * Math.PI) * spin;
    const o = fadeEnd && t > 0.9 ? 1 - (t - 0.9) / 0.1 * 0.9 : 1;
    frames.push({transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${r.toFixed(2)}deg)`, opacity: o, offset: t});
  }
  return frames;
}
