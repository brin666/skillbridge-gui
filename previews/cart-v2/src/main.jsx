import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Card} from '@astryxdesign/core/Card';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Drawer} from '@astryxdesign/core/Drawer';
import {Dialog} from '@astryxdesign/core/Dialog';
import {Tooltip} from '@astryxdesign/core/Tooltip';
import {categories, assets} from './data';
import {installSpringVars, arcFrames, ease, dur} from './motion';
import './styles.css';

installSpringVars();

/* ---------- 图标 ---------- */
const paths = {
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>,
  memory: <><path d="M12 4a4 4 0 0 0-7.5 2A3.5 3.5 0 0 0 4 13a4 4 0 0 0 8 4.5A4 4 0 0 0 20 13a3.5 3.5 0 0 0-.5-7A4 4 0 0 0 12 4Z"/><path d="M12 4v16"/></>,
  plug: <><path d="M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v3"/></>,
  chart: <><path d="M4 3v17h17M8 15v-4M13 15V7M18 15v-6"/></>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  pen: <><path d="m15 4 5 5M5 19l1-6L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L11 18l-6 1Z"/></>,
  motion: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6"/></>,
  text: <><path d="M4 5h16M12 5v15M8 20h8"/></>,
  folder: <><path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></>,
  bag: <><path d="M5.5 8h13l1 12.5h-15L5.5 8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>, check: <path d="m5 12.5 4.5 4.5L19 7.5"/>,
  arrow: <path d="M5 12h14m-5.5-5.5L19 12l-5.5 5.5"/>, search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  copy: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/></>,
  sparkle: <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z"/>,
  calm: <><path d="M4 12c2.5-3 5.5-3 8 0s5.5 3 8 0"/></>,
  wave: <><path d="M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0"/></>,
  all: <><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/></>,
  // 来源（自绘示意图形，非官方标志）
  codex: <><path d="M12 3.2 19.6 7.6v8.8L12 20.8l-7.6-4.4V7.6Z"/><path d="m9 10 2.5 2L9 14M13 14.5h2.5"/></>,
  claude: <><path d="M12 4v16M4 12h16M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/></>,
  cursor: <><path d="M5 4 19 11l-6 1.8L10.5 19Z"/></>,
};
function Glyph({name, size = 20, stroke = 1.7}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>;
}
const harness = {'Codex': 'codex', 'Claude Code': 'claude', 'Cursor': 'cursor'};
function Harness({source, size = 13}) {
  return <Tooltip content={source} placement="above"><span className={`harness h-${harness[source]}`} tabIndex={-1}><Glyph name={harness[source]} size={size} stroke={1.8}/><span className="sr-only">{source}</span></span></Tooltip>;
}
function Tile({asset, size = 'md', ...rest}) {
  return <span className={`tile tile-${size}`} {...rest}><Glyph name={asset.icon} size={size === 'lg' ? 26 : size === 'sm' ? 15 : 21}/></span>;
}

/* ---------- 小工具 ---------- */
function Ticker({value}) {
  const prev = useRef(value);
  const dir = value >= prev.current ? 'up' : 'down';
  useEffect(() => { prev.current = value; }, [value]);
  return <span className="ticker" aria-hidden="true"><span key={value} className={`tick tick-${dir}`}>{value}</span></span>;
}
// 保留刚移除的条目一小段时间，用于离场动画
function usePresence(items, ms) {
  const [list, setList] = useState(() => items.map(item => ({item, leaving: false})));
  const latest = useRef(items); latest.current = items;
  const sig = items.map(i => i.id).join('|');
  useLayoutEffect(() => {
    const now = latest.current;
    setList(prev => {
      const ids = new Set(now.map(i => i.id));
      const next = now.map(item => ({item, leaving: false}));
      if (ms > 0) prev.forEach((e, idx) => { if (!ids.has(e.item.id)) next.splice(Math.min(idx, next.length), 0, {item: e.item, leaving: true}); });
      return next;
    });
    if (ms > 0) { const t = setTimeout(() => setList(l => l.filter(e => !e.leaving)), ms); return () => clearTimeout(t); }
  }, [sig, ms]);
  return list;
}
function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
}

const STORE = 'skillbridge.cart-preview.v2';
const DEFAULT_TASK = '设计 SkillBridge 新版界面';
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || '{}');
    return {
      ids: Array.isArray(d.ids) ? [...new Set(d.ids)].filter(id => assets.some(a => a.id === id)) : [],
      task: typeof d.task === 'string' ? d.task : DEFAULT_TASK,
      project: typeof d.project === 'string' ? d.project : 'D:\\skillbridge',
    };
  } catch { return {ids: [], task: DEFAULT_TASK, project: 'D:\\skillbridge'}; }
}
const byId = id => assets.find(a => a.id === id);
const catOf = a => categories.find(c => c.id === a.type);

/* ---------- 应用 ---------- */
function App() {
  const [draft, setDraft] = useState(loadDraft);
  const [category, setCategory] = useState('skills');
  const [prevCategory, setPrevCategory] = useState(null);
  const [dir, setDir] = useState(1);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [dockOpen, setDockOpen] = useState(false);
  const [overlay, setOverlay] = useState(null); // 'detail' | 'cart' | 'handoff'
  const [detailId, setDetailId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [manualReduce, setManualReduce] = useState(false);
  const systemReduce = useMedia('(prefers-reduced-motion: reduce)');
  const narrow = useMedia('(max-width: 900px)');
  const reduced = manualReduce || systemReduce;

  const idsRef = useRef(new Set(draft.ids));
  const lockRef = useRef(new Map());
  const flights = useRef(new Map());
  const landDelay = useRef(new Map());
  const bagRef = useRef(null);
  const pillRef = useRef(null);
  const dockRef = useRef(null);
  const toastTimer = useRef();

  const selected = draft.ids.map(byId).filter(Boolean);
  const current = categories.find(c => c.id === category);
  const detail = detailId ? byId(detailId) : null;
  const list = (cat) => assets
    .filter(a => a.type === cat && (source === 'all' || a.source === source) && `${a.title} ${a.brief} ${a.description} ${a.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.frequent ? 1 : 0) - (a.frequent ? 1 : 0));
  const visible = list(category);

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(draft)); } catch { /* 浏览器不允许存储时仍可继续操作 */ } }, [draft]);
  useEffect(() => { if (reduced) cancelFlights(); }, [reduced]);
  useEffect(() => { const stop = () => cancelFlights(); addEventListener('resize', stop); return () => { removeEventListener('resize', stop); cancelFlights(); }; }, []);
  useEffect(() => { if (narrow) setDockOpen(false); }, [narrow]);
  useEffect(() => {
    if (!dockOpen) return;
    const onDown = e => { if (dockRef.current && !dockRef.current.contains(e.target) && !e.target.closest?.('[data-add]') && !e.target.closest?.('dialog')) setDockOpen(false); };
    const onKey = e => { if (e.key === 'Escape' && !overlay) setDockOpen(false); };
    addEventListener('pointerdown', onDown); addEventListener('keydown', onKey);
    return () => { removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey); };
  }, [dockOpen, overlay]);

  function tell(text, undo) {
    clearTimeout(toastTimer.current);
    setNotice({text, undo, key: Date.now()});
    toastTimer.current = setTimeout(() => setNotice(null), 4200);
  }
  function cancelFlights() { flights.current.forEach(f => { f.anims.forEach(a => a.cancel()); f.nodes.forEach(n => n.remove()); }); flights.current.clear(); }
  function cartTarget() { return (narrow ? pillRef.current : bagRef.current)?.getBoundingClientRect(); }

  function bump(kind) {
    const el = narrow ? pillRef.current : bagRef.current;
    if (!el || reduced) return;
    const frames = kind === 'in'
      ? [{transform: 'scale(1)'}, {transform: 'scale(0.8) rotate(-6deg)', offset: 0.18}, {transform: 'scale(1)'}]
      : [{transform: 'scale(1)'}, {transform: 'scale(0.9) rotate(4deg)', offset: 0.25}, {transform: 'scale(1)'}];
    el.animate(frames, {duration: dur('bouncy'), easing: kind === 'in' ? ease('bouncy') : ease('snappy')});
    if (kind === 'in') {
      const r = el.getBoundingClientRect();
      const ring = document.createElement('div');
      ring.className = 'land-ring'; ring.setAttribute('aria-hidden', 'true');
      ring.style.left = `${r.left + r.width / 2}px`; ring.style.top = `${r.top + r.height / 2}px`;
      document.body.append(ring);
      ring.animate([{transform: 'translate(-50%,-50%) scale(.4)', opacity: .55}, {transform: 'translate(-50%,-50%) scale(2.1)', opacity: 0}], {duration: 620, easing: 'cubic-bezier(.2,.7,.2,1)'}).finished.finally(() => ring.remove());
    }
  }

  function fly(asset, removing) {
    const prev = flights.current.get(asset.id);
    const prevRect = prev?.nodes[0]?.getBoundingClientRect();
    if (prev) { prev.anims.forEach(a => a.cancel()); prev.nodes.forEach(n => n.remove()); flights.current.delete(asset.id); }
    if (reduced || overlay) return false;
    const cardTile = document.querySelector(`[data-tile="${asset.id}"]`);
    const cart = cartTarget();
    if (!cart || cart.width === 0) return false;
    const tileRect = cardTile?.getBoundingClientRect();
    const from = prevRect || (removing ? (document.querySelector(`[data-stack="${asset.id}"]`)?.getBoundingClientRect() || cart) : tileRect);
    const to = removing ? tileRect : cart;
    if (!from || !to || to.width === 0 || to.bottom < 0 || to.top > innerHeight) return false;

    const size = 46;
    const sx = from.left + from.width / 2 - size / 2, sy = from.top + from.height / 2 - size / 2;
    const ex = to.left + to.width / 2 - size / 2, ey = to.top + to.height / 2 - size / 2;
    const token = document.createElement('div');
    token.className = 'token'; token.setAttribute('aria-hidden', 'true');
    token.innerHTML = (cardTile || document.querySelector(`[data-stack="${asset.id}"]`))?.innerHTML || '';
    token.style.left = `${sx}px`; token.style.top = `${sy}px`;
    const nodes = [token], anims = [];
    const duration = removing ? 560 : 700;
    const opts = removing
      ? {lift: 80, startScale: 0.5, peakScale: 0.9, endScale: 1, spin: 8, fadeEnd: true}
      : {lift: 150, spin: -12};
    const frames = arcFrames(sx, sy, ex, ey, opts);
    document.body.append(token);
    anims.push(token.animate(frames, {duration, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards'}));
    if (!removing) {
      // 彗尾：两颗跟随的小光点
      [1, 2].forEach(i => {
        const dot = document.createElement('div');
        dot.className = 'trail'; dot.setAttribute('aria-hidden', 'true');
        dot.style.left = `${sx + size / 2 - 5}px`; dot.style.top = `${sy + size / 2 - 5}px`;
        document.body.append(dot); nodes.push(dot);
        const f = arcFrames(sx, sy, ex, ey, {...opts, startScale: 1 - i * .25, peakScale: 1 - i * .2, endScale: .3}).map(k => ({...k, opacity: k.opacity * (0.55 - i * 0.18)}));
        anims.push(dot.animate(f, {duration, delay: i * 55, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both'}));
      });
    }
    flights.current.set(asset.id, {nodes, anims});
    anims[0].finished.then(() => {
      if (flights.current.get(asset.id)?.nodes[0] === token) {
        if (!removing) bump('in');
        else cardTile?.animate([{transform: 'scale(1)'}, {transform: 'scale(1.14)', offset: .3}, {transform: 'scale(1)'}], {duration: dur('bouncy'), easing: ease('bouncy')});
      }
    }).catch(() => {}).finally(() => {
      Promise.allSettled(anims.map(a => a.finished)).then(() => {
        nodes.forEach(n => n.remove());
        if (flights.current.get(asset.id)?.nodes[0] === token) flights.current.delete(asset.id);
      });
    });
    return duration;
  }

  function toggle(id, {force} = {}) {
    const now = performance.now();
    if (!force && now - (lockRef.current.get(id) || 0) < 320) return; // 防止连点误触
    lockRef.current.set(id, now);
    const asset = byId(id);
    const removing = idsRef.current.has(id);
    if (removing) idsRef.current.delete(id); else idsRef.current.add(id);
    // 先更新状态，动画只是装饰
    const flight = fly(asset, removing);
    if (removing || !flight) landDelay.current.delete(id); else landDelay.current.set(id, Math.round(flight * 0.86));
    setDraft(d => ({...d, ids: [...idsRef.current]}));
    if (!flight && !removing) bump('in');
    if (removing && !flight) bump('out');
    if (removing) tell(`已移出 ${asset.title}`, {id});
    else if (reduced) tell(`已加入 ${asset.title}`, {id, undoRemove: true});
  }
  function undo(u) {
    if (u.undoRemove) { if (idsRef.current.has(u.id)) toggle(u.id, {force: true}); }
    else if (!idsRef.current.has(u.id)) toggle(u.id, {force: true});
    setNotice(null);
  }
  function clearCart() {
    const before = [...idsRef.current];
    if (!before.length) return;
    idsRef.current.clear(); cancelFlights();
    setDraft(d => ({...d, ids: []}));
    bump('out');
    tell(`已清空 ${before.length} 项`, {restore: before});
  }
  function restore(ids) { ids.forEach(i => idsRef.current.add(i)); setDraft(d => ({...d, ids: [...idsRef.current]})); setNotice(null); bump('in'); }
  function switchCategory(id) {
    if (id === category) return;
    const a = categories.findIndex(c => c.id === category), b = categories.findIndex(c => c.id === id);
    setDir(b > a ? 1 : -1);
    setPrevCategory(reduced ? null : category);
    setCategory(id); setQuery('');
    document.querySelector('.main')?.scrollTo?.({top: 0});
    scrollTo({top: 0});
  }
  useEffect(() => { if (!prevCategory) return; const t = setTimeout(() => setPrevCategory(null), 240); return () => clearTimeout(t); }, [prevCategory, category]);
  function openDetail(id) { setDetailId(id); setOverlay('detail'); }
  function openHandoff() { if (!selected.length) return; setDockOpen(false); setOverlay('handoff'); }

  return <Theme theme={neutralTheme} mode="light">
    <div className={`app ${reduced ? 'rm' : ''} ${dockOpen ? 'dock-open' : ''}`}>
      <a href="#grid" className="skip">跳到资料</a>

      <Rail category={category} onPick={switchCategory} reduced={reduced} manualReduce={manualReduce} systemReduce={systemReduce} setManualReduce={setManualReduce}/>

      <main className="main" id="grid" tabIndex={-1}>
        <header className="head">
          <h1 className="title" aria-live="polite">
            <span key={category} className={`title-text dir-${dir}`}>{current.label}</span>
            <span key={`n-${category}`} className="title-count">{visible.length}</span>
          </h1>
          <div className="tools">
            <div className="search">
              <TextInput label={`搜索${current.label}`} isLabelHidden value={query} onChange={setQuery} placeholder="搜索" startIcon={<Glyph name="search" size={16}/>} hasClear/>
            </div>
            <SourceFilter value={source} onChange={setSource}/>
          </div>
        </header>

        <div className="stage">
          {prevCategory && <div className="grid grid-out" aria-hidden="true">{list(prevCategory).map(a => <ItemCard key={a.id} asset={a} added={draft.ids.includes(a.id)} ghost/>)}</div>}
          {visible.length === 0
            ? <div className="empty-search"><span className="empty-orb"><Glyph name="search" size={26}/></span><p>没有匹配的{current.label}</p><Button label="清除筛选" variant="secondary" onClick={() => { setQuery(''); setSource('all'); }}/></div>
            : <div key={category} className={`grid grid-in dir-${dir}`}>
                {visible.map((a, i) => <ItemCard key={a.id} index={i} asset={a} added={draft.ids.includes(a.id)} onAdd={() => toggle(a.id)} onOpen={() => openDetail(a.id)}/>)}
              </div>}
        </div>
      </main>

      {!narrow && <Dock ref={dockRef} bagRef={bagRef} open={dockOpen} setOpen={setDockOpen} selected={selected} draft={draft} setDraft={setDraft} landDelay={landDelay} reduced={reduced} onRemove={id => toggle(id, {force: true})} onOpen={openDetail} onHandoff={openHandoff} onClear={clearCart}/>}

      {narrow && <button ref={pillRef} className={`pill ${selected.length ? 'has' : ''}`} onClick={() => setOverlay('cart')} aria-label={`购物车，${selected.length} 项`}>
        <Glyph name="bag" size={20}/><span>购物车</span><span className="pill-count"><Ticker value={selected.length}/></span>
      </button>}

      <div className="toast-region" role="status" aria-live="polite">
        {notice && <div key={notice.key} className="toast"><Glyph name="check" size={15}/><span>{notice.text}</span>
          {notice.undo && <button onClick={() => (notice.undo.restore ? restore(notice.undo.restore) : undo(notice.undo))}>撤回</button>}
        </div>}
      </div>

      <Drawer isOpen={overlay === 'detail' && !!detail} onOpenChange={o => { if (!o) setOverlay(null); }} label={detail?.title || '详情'} width={460} padding={0} experimental={{isFullWidthOnMobile: true}}>
        {detail && <Detail asset={detail} added={draft.ids.includes(detail.id)} onAdd={() => toggle(detail.id)} onClose={() => setOverlay(null)}/>}
      </Drawer>

      <Drawer isOpen={overlay === 'cart'} onOpenChange={o => { if (!o) setOverlay(null); }} label="购物车" width={420} padding={0} experimental={{isFullWidthOnMobile: true}}>
        <div className="sheet">
          <CartPanel selected={selected} draft={draft} setDraft={setDraft} reduced={reduced} onRemove={id => toggle(id, {force: true})} onOpen={openDetail} onHandoff={openHandoff} onClear={clearCart} onClose={() => setOverlay(null)}/>
        </div>
      </Drawer>

      <Dialog isOpen={overlay === 'handoff'} onOpenChange={o => { if (!o) setOverlay(null); }} width={720} padding={0} aria-label="交接预览">
        {overlay === 'handoff' && <Handoff selected={selected} draft={draft} setDraft={setDraft} reduced={reduced} onRemove={id => toggle(id, {force: true})} onClose={() => setOverlay(null)} tell={tell}/>}
      </Dialog>
    </div>
  </Theme>;
}

/* ---------- 左侧图标导航 ---------- */
function Rail({category, onPick, reduced, manualReduce, systemReduce, setManualReduce}) {
  const idx = categories.findIndex(c => c.id === category);
  const tabs = useRef([]);
  const [ind, setInd] = useState(null);
  useLayoutEffect(() => {
    const measure = () => { const el = tabs.current[idx]; if (el) setInd({x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight}); };
    measure(); addEventListener('resize', measure); return () => removeEventListener('resize', measure);
  }, [idx]);
  return <nav className="rail" aria-label="资料分类">
    <div className="brand" aria-label="SkillBridge">
      <svg width="22" height="22" viewBox="0 0 28 28" aria-hidden="true"><path d="M5 21V10a9 9 0 0 1 18 0v11M5 15h18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/></svg>
    </div>
    <div className="rail-tabs" role="tablist" aria-orientation="vertical">
      {ind && <span className="rail-ind" style={{transform: `translate(${ind.x}px, ${ind.y}px)`, width: ind.w, height: ind.h}} aria-hidden="true"/>}
      {categories.map((c, i) => <Tooltip key={c.id} content={c.label} placement="end">
        <button ref={el => (tabs.current[i] = el)} role="tab" aria-selected={category === c.id} aria-label={c.label} data-category={c.id} className={`rail-tab ${category === c.id ? 'on' : ''}`} onClick={() => onPick(c.id)}>
          <Glyph name={c.icon} size={21}/><span className="rail-label">{c.label}</span>
        </button>
      </Tooltip>)}
    </div>
    <div className="rail-foot">
      <Tooltip content={systemReduce ? '系统已减少动态效果' : reduced ? '已减少动态效果' : '减少动态效果'} placement="end">
        <button className={`rail-mini ${reduced ? 'on' : ''}`} aria-pressed={reduced} aria-label="减少动态效果" disabled={systemReduce} onClick={() => setManualReduce(v => !v)}>
          <Glyph name={reduced ? 'calm' : 'wave'} size={18}/>
        </button>
      </Tooltip>
      <Tooltip content="全部为示例数据，不读取本机文件" placement="end"><span className="sample" tabIndex={0}>示例</span></Tooltip>
    </div>
  </nav>;
}

function SourceFilter({value, onChange}) {
  const opts = [{id: 'all', label: '全部来源', icon: 'all'}, ...Object.entries(harness).map(([label, icon]) => ({id: label, label, icon}))];
  const i = opts.findIndex(o => o.id === value);
  return <div className="seg" role="radiogroup" aria-label="来源" style={{'--i': i}}>
    <span className="seg-ind" aria-hidden="true"/>
    {opts.map(o => <Tooltip key={o.id} content={o.label} placement="below">
      <button role="radio" aria-checked={value === o.id} aria-label={o.label} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}><Glyph name={o.icon} size={15} stroke={1.8}/></button>
    </Tooltip>)}
  </div>;
}

/* ---------- 卡片 ---------- */
function ItemCard({asset, added, onAdd, onOpen, index = 0, ghost}) {
  const ref = useRef(null);
  function move(e) {
    const el = ref.current; if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`);
    el.style.setProperty('--rx', `${(0.5 - py) * 5}deg`); el.style.setProperty('--ry', `${(px - 0.5) * 6}deg`);
  }
  function leave() { const el = ref.current; if (!el) return; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
  const state = asset.missing ? '缺少文件' : asset.stale ? '已过期' : null;
  return <div className="cell" style={{'--i': index}}>
    <div ref={ref} className="tilt" data-selected={added} onPointerMove={ghost ? undefined : move} onPointerLeave={ghost ? undefined : leave}>
      <Card padding={0}>
        <article className="item">
          {!ghost && <button className="hit" onClick={onOpen} aria-label={`查看 ${asset.title}`}/>}
          <div className="item-top">
            <Tile asset={asset} data-tile={ghost ? undefined : asset.id}/>
            <Harness source={asset.source}/>
          </div>
          <h3 className="item-name">{asset.title}{state && <Tooltip content={state}><span className="flag" tabIndex={0}><span className="sr-only">{state}</span></span></Tooltip>}</h3>
          <p className="item-brief">{asset.brief}</p>
          <span className="spot" aria-hidden="true"/>
          {!ghost && <AddButton added={added} title={asset.title} id={asset.id} onClick={onAdd}/>}
        </article>
      </Card>
    </div>
  </div>;
}

function AddButton({added, title, id, onClick, size = 'md', withLabel}) {
  const [burst, setBurst] = useState(0);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (added) setBurst(b => b + 1); }, [added]);
  const icon = <span className={`morph ${added ? 'is-on' : ''}`} aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path className="m-v" d="M12 5v14"/><path className="m-h" d="M5 12h14"/><path className="m-c" d="m5 12.5 4.5 4.5L19 7.5" pathLength="1"/>
    </svg>
  </span>;
  return <span className={`add ${added ? 'on' : ''} ${withLabel ? 'wide' : ''}`}>
    {burst > 0 && <span key={burst} className="burst" aria-hidden="true">{Array.from({length: 8}, (_, i) => <i key={i} style={{'--a': `${i * 45}deg`}}/>)}</span>}
    {withLabel
      ? <Button label={added ? '已加入' : '加入'} aria-label={`${added ? '移出' : '加入'} ${title}`} aria-pressed={added} data-add={id} variant={added ? 'secondary' : 'primary'} size={size} icon={icon} onClick={onClick}/>
      : <IconButton label={`${added ? '移出' : '加入'} ${title}`} aria-pressed={added} data-add={id} variant={added ? 'primary' : 'secondary'} size={size} icon={icon} onClick={onClick}/>}
  </span>;
}

/* ---------- 购物车 ---------- */
const Dock = React.forwardRef(function Dock({bagRef, open, setOpen, selected, landDelay, reduced, onHandoff, ...rest}, ref) {
  const stack = usePresence([...selected].reverse().slice(0, 6), reduced ? 0 : 280);
  const extra = Math.max(0, selected.length - 6);
  return <aside ref={ref} className={`dock ${open ? 'open' : ''} ${selected.length ? 'has' : ''}`} aria-label="购物车">
    <button ref={bagRef} className="bag" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`购物车，${selected.length} 项`}>
      <Glyph name="bag" size={22}/>
      <span className="bag-count"><Ticker value={selected.length}/></span>
    </button>
    <div className="dock-slim" aria-hidden={open}>
      <div className="stack">
        {stack.map(({item, leaving}) => {
          const delay = landDelay.current.get(item.id);
          return <button key={item.id} tabIndex={open ? -1 : 0} className={`stack-item ${leaving ? 'leaving' : ''}`} style={delay ? {animationDelay: `${delay}ms`} : undefined} data-stack={leaving ? undefined : item.id} onClick={() => setOpen(true)} aria-label={item.title}>
            <Glyph name={item.icon} size={16}/>
          </button>;
        })}
        {extra > 0 && <span className="stack-more">+{extra}</span>}
        {!selected.length && <span className="stack-slot" aria-hidden="true"/>}
      </div>
      <Tooltip content="预览交接" placement="start">
        <button className="dock-go" disabled={!selected.length} onClick={onHandoff} aria-label="预览交接" tabIndex={open ? -1 : 0}><Glyph name="arrow" size={18}/></button>
      </Tooltip>
    </div>
    <div className="dock-full" aria-hidden={!open} inert={!open}>
      <CartPanel selected={selected} landDelay={landDelay} reduced={reduced} onHandoff={onHandoff} onClose={() => setOpen(false)} docked {...rest}/>
    </div>
  </aside>;
});

function CartPanel({selected, draft, setDraft, landDelay, reduced, onRemove, onOpen, onHandoff, onClear, onClose, docked}) {
  const rows = usePresence(selected, reduced ? 0 : 280);
  return <div className="cart">
    <div className="cart-head">
      <h2>购物车<span className="cart-n"><Ticker value={selected.length}/></span></h2>
      <div className="cart-head-actions">
        {selected.length > 0 && <Button label="清空" variant="ghost" size="sm" onClick={onClear}/>}
        <IconButton label={docked ? '收起' : '关闭'} variant="ghost" size="sm" icon={<Glyph name="close" size={16}/>} onClick={onClose}/>
      </div>
    </div>
    <div className="cart-task">
      <TextInput label="本次任务" value={draft.task} onChange={task => setDraft(d => ({...d, task}))} placeholder="这次想完成什么？"/>
    </div>
    <div className="cart-list">
      {rows.length === 0 && <div className="cart-empty"><span className="empty-orb"><Glyph name="bag" size={24}/></span><p>还是空的</p></div>}
      {rows.map(({item, leaving}) => {
        const delay = landDelay?.current.get(item.id);
        return <div key={item.id} className={`row ${leaving ? 'leaving' : ''}`} style={delay ? {animationDelay: `${delay}ms`} : undefined}>
          <Tile asset={item} size="sm"/>
          <button className="row-name" onClick={() => onOpen(item.id)} tabIndex={leaving ? -1 : 0}>{item.title}{(item.missing || item.stale) && <span className="flag"/>}</button>
          <IconButton label={`移除 ${item.title}`} variant="ghost" size="sm" icon={<Glyph name="close" size={14}/>} onClick={() => onRemove(item.id)} isDisabled={leaving}/>
        </div>;
      })}
    </div>
    <div className="cart-foot">
      <Button label="预览交接" variant="primary" size="lg" width="100%" isDisabled={!selected.length} endContent={<Glyph name="arrow" size={17}/>} onClick={onHandoff}/>
    </div>
  </div>;
}

/* ---------- 详情 ---------- */
function Detail({asset, added, onAdd, onClose}) {
  return <div className="detail">
    <div className="detail-bar"><IconButton label="关闭" variant="ghost" icon={<Glyph name="close" size={18}/>} onClick={onClose} data-autofocus/></div>
    <div className="detail-hero">
      <Tile asset={asset} size="lg"/>
      <div className="chips"><span className="chip">{catOf(asset).label}</span><span className="chip"><Glyph name={harness[asset.source]} size={12} stroke={1.9}/>{asset.source}</span><span className="chip">{asset.scope}</span></div>
    </div>
    <h2>{asset.title}</h2>
    <p className="detail-desc">{asset.description}</p>
    {(asset.missing || asset.stale) && <div className="warn"><span className="flag"/>{asset.missing ? `缺少 ${asset.missing}` : '已过期'}</div>}
    {asset.body && <pre className="detail-body">{asset.body}</pre>}
    <ul className="files">{asset.files.map(f => <li key={f}><Glyph name="file" size={15}/><code>{f}</code>{asset.missing === f && <span className="flag"/>}</li>)}</ul>
    <div className="detail-act"><AddButton added={added} title={asset.title} id={asset.id} onClick={onAdd} size="lg" withLabel/></div>
  </div>;
}

/* ---------- 交接预览 ---------- */
function buildPrompt(draft, selected) {
  return `【界面预览示例，尚未生成真实交接包】
任务：${draft.task || '未填写'}
项目位置：${draft.project || '未填写'}

已选资料：
${selected.map(a => `- ${a.title}（${catOf(a).label}，${a.files.length} 个示例文件${a.missing ? '，文件待补充' : ''}${a.stale ? '，已过期' : ''}）`).join('\n')}

实际使用前需先生成并提供可访问的资料包。此示例不代表资料已导出、安装或验证。`;
}
function Handoff({selected, draft, setDraft, reduced, onRemove, onClose, tell}) {
  const [phase, setPhase] = useState('idle'); // idle | generating | ready
  const [copied, setCopied] = useState(0);
  const prompt = buildPrompt(draft, selected);
  const sig = selected.map(a => a.id).join('|') + draft.task + draft.project;
  const sigRef = useRef(sig);
  const areaRef = useRef(null);
  useEffect(() => { if (sigRef.current !== sig) { sigRef.current = sig; setPhase('idle'); setCopied(0); } }, [sig]);
  const chips = usePresence(selected, reduced ? 0 : 260);
  function generate() {
    if (!selected.length) return;
    if (reduced) { setPhase('ready'); return; }
    setPhase('generating');
    setTimeout(() => setPhase(p => (p === 'generating' ? 'ready' : p)), 720);
  }
  async function copy() {
    let ok = false;
    try { await navigator.clipboard.writeText(prompt); ok = true; } catch {
      try { const t = document.createElement('textarea'); t.value = prompt; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.append(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch { ok = false; }
    }
    if (ok) setCopied(c => c + 1);
    else { tell('未能复制，请手动选择文本'); const el = areaRef.current; if (el) { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); } }
  }
  const lines = prompt.split('\n');
  return <div className={`handoff phase-${phase}`}>
    <div className="ho-head">
      <h2>交接预览</h2>
      <IconButton label="关闭" variant="ghost" icon={<Glyph name="close" size={18}/>} onClick={onClose} data-autofocus/>
    </div>
    <div className="ho-fields">
      <TextInput label="本次任务" value={draft.task} onChange={task => setDraft(d => ({...d, task}))}/>
      <TextInput label="项目位置" placeholder="可选" value={draft.project} onChange={project => setDraft(d => ({...d, project}))}/>
    </div>
    <div className="ho-chips">
      {chips.length === 0 && <p className="ho-empty">购物车是空的</p>}
      {chips.map(({item, leaving}, i) => <span key={item.id} className={`ho-chip ${leaving ? 'leaving' : ''}`} style={{'--i': i}}>
        <Tile asset={item} size="sm"/>{item.title}{(item.missing || item.stale) && <Tooltip content={item.missing ? '缺少文件' : '已过期'}><span className="flag" tabIndex={0}/></Tooltip>}
        <button className="ho-x" aria-label={`移除 ${item.title}`} onClick={() => onRemove(item.id)} disabled={leaving}><Glyph name="close" size={12}/></button>
      </span>)}
    </div>

    <div className="ho-prompt">
      {phase !== 'ready'
        ? <div className={`ho-gen ${phase === 'generating' ? 'busy' : ''}`}>
            <span className="gen-orb" aria-hidden="true"><Glyph name="sparkle" size={22}/></span>
            <Button label={phase === 'generating' ? '生成中…' : '生成提示词'} variant="primary" size="lg" isDisabled={!selected.length || phase === 'generating'} onClick={generate}/>
          </div>
        : <div className="ho-ready">
            <div className="ho-badge"><Glyph name="sparkle" size={14}/>提示词已生成</div>
            <div ref={areaRef} className={`ho-text ${copied ? 'flash' : ''}`} key={`t-${copied}`} tabIndex={0} aria-label="生成的提示词">
              {lines.map((l, i) => <div key={i} className="ln" style={{'--i': i}}>{l || '\u00a0'}</div>)}
            </div>
          </div>}
    </div>

    <div className="ho-actions">
      <Tooltip content="尚未接入"><span><Button label="生成交接包" variant="ghost" isDisabled/></span></Tooltip>
      <span className={`copy ${copied ? 'done' : ''}`}>
        {copied > 0 && <span key={copied} className="burst big" aria-hidden="true">{Array.from({length: 12}, (_, i) => <i key={i} style={{'--a': `${i * 30}deg`}}/>)}</span>}
        <Button label={copied ? '已复制' : '复制提示词'} variant="primary" size="lg" isDisabled={phase !== 'ready' || !selected.length} icon={copied ? <span className="draw-check"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" pathLength="1"/></svg></span> : <Glyph name="copy" size={17}/>} onClick={copy}/>
      </span>
    </div>
    <span className="sr-only" role="status">{copied ? '提示词已复制到剪贴板' : phase === 'ready' ? '提示词已生成' : ''}</span>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
