import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Card} from '@astryxdesign/core/Card';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Drawer} from '@astryxdesign/core/Drawer';
import {Dialog} from '@astryxdesign/core/Dialog';
import {Tooltip} from '@astryxdesign/core/Tooltip';
import {Glyph, BrandMark} from '../Glyph';
import {categories, assets} from './data';
import {arcFrames, ease, dur} from './motion';

/* ---------- 小工具（沿用 cart-v2） ---------- */
function Ticker({value}) {
  const prev = useRef(value);
  const dir = value >= prev.current ? 'up' : 'down';
  useEffect(() => { prev.current = value; }, [value]);
  return <span className="ticker" aria-hidden="true"><span key={value} className={`tick tick-${dir}`}>{value}</span></span>;
}
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
export function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
}
const byId = id => assets.find(a => a.id === id);
const catOf = a => categories.find(c => c.id === a.type);
function Tile({asset, size = 'md', ...rest}) {
  return <span className={`tile tile-${size}`} {...rest}><Glyph name={asset.icon} size={size === 'lg' ? 26 : size === 'sm' ? 15 : 21}/></span>;
}
function Source({size = 13}) {
  return <Tooltip content="Codex" placement="above"><span className="harness" tabIndex={-1}><Glyph name="codex" size={size} stroke={1.8}/><span className="sr-only">Codex</span></span></Tooltip>;
}

/* ---------- 演示 ---------- */
export default function Demo({reduced, manualReduce, systemReduce, setManualReduce}) {
  const [ids, setIds] = useState([]);
  const [task, setTask] = useState('整理下个版本的发布说明');
  const [category, setCategory] = useState('skills');
  const [prevCategory, setPrevCategory] = useState(null);
  const [dir, setDir] = useState(1);
  const [query, setQuery] = useState('');
  const [dockOpen, setDockOpen] = useState(false);
  const [overlay, setOverlay] = useState(null); // 'detail' | 'cart' | 'handoff'
  const [detailId, setDetailId] = useState(null);
  const [notice, setNotice] = useState(null);
  const narrow = useMedia('(max-width: 900px)');

  const idsRef = useRef(new Set());
  const lockRef = useRef(new Map());
  const flights = useRef(new Map());
  const landDelay = useRef(new Map());
  const bagRef = useRef(null);
  const pillRef = useRef(null);
  const dockRef = useRef(null);
  const mainRef = useRef(null);
  const toastTimer = useRef();

  const selected = ids.map(byId).filter(Boolean);
  const current = categories.find(c => c.id === category);
  const detail = detailId ? byId(detailId) : null;
  const list = cat => {
    const q = query.trim().toLowerCase();
    return assets
      .filter(a => a.type === cat && `${a.title} ${a.subtitle || ''} ${a.description}`.toLowerCase().includes(q))
      .sort((a, b) => (b.frequent ? 1 : 0) - (a.frequent ? 1 : 0));
  };
  const visible = list(category);

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
  useEffect(() => { if (!prevCategory) return; const t = setTimeout(() => setPrevCategory(null), 240); return () => clearTimeout(t); }, [prevCategory, category]);

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
    const opts = removing ? {lift: 80, startScale: 0.5, peakScale: 0.9, endScale: 1, spin: 8, fadeEnd: true} : {lift: 150, spin: -12};
    document.body.append(token);
    anims.push(token.animate(arcFrames(sx, sy, ex, ey, opts), {duration, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards'}));
    if (!removing) {
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
    if (!force && now - (lockRef.current.get(id) || 0) < 320) return;
    lockRef.current.set(id, now);
    const asset = byId(id);
    const removing = idsRef.current.has(id);
    if (removing) idsRef.current.delete(id); else idsRef.current.add(id);
    const flight = fly(asset, removing);
    if (removing || !flight) landDelay.current.delete(id); else landDelay.current.set(id, Math.round(flight * 0.86));
    setIds([...idsRef.current]);
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
    setIds([]); bump('out');
    tell(`已清空 ${before.length} 项`, {restore: before});
  }
  function restore(list) { list.forEach(i => idsRef.current.add(i)); setIds([...idsRef.current]); setNotice(null); bump('in'); }
  function switchCategory(id) {
    if (id === category) return;
    const a = categories.findIndex(c => c.id === category), b = categories.findIndex(c => c.id === id);
    setDir(b > a ? 1 : -1);
    setPrevCategory(reduced ? null : category);
    setCategory(id); setQuery('');
    mainRef.current?.scrollTo?.({top: 0});
  }
  function openDetail(id) { setDetailId(id); setOverlay('detail'); }
  function openHandoff() { if (!selected.length) return; setDockOpen(false); setOverlay('handoff'); }

  return <div className={`app ${reduced ? 'rm' : ''} ${dockOpen ? 'dock-open' : ''}`} data-demo>
    <Rail category={category} onPick={switchCategory} reduced={reduced} manualReduce={manualReduce} systemReduce={systemReduce} setManualReduce={setManualReduce}/>

    <main className="main" ref={mainRef} aria-label="界面演示">
      <header className="head">
        <h3 className="title" aria-live="polite">
          <span key={category} className={`title-text dir-${dir}`}>{current.label}</span>
          <span key={`n-${category}`} className="title-count">{visible.length}</span>
        </h3>
        <div className="tools">
          <div className="search">
            <TextInput label={`搜索${current.label}`} isLabelHidden value={query} onChange={setQuery} placeholder="搜索名称或用途" startIcon={<Glyph name="search" size={16}/>} hasClear/>
          </div>
        </div>
      </header>
      <div className="stage">
        {prevCategory && <div className="grid grid-out" aria-hidden="true">{list(prevCategory).map(a => <ItemCard key={a.id} asset={a} added={ids.includes(a.id)} ghost/>)}</div>}
        {visible.length === 0
          ? <div className="empty-search"><span className="empty-orb"><Glyph name="search" size={26}/></span><p>没有匹配的{current.label}</p><Button label="清除搜索" variant="secondary" onClick={() => setQuery('')}/></div>
          : <div key={category} className={`grid grid-in dir-${dir}`} role="list">
              {visible.map((a, i) => <ItemCard key={a.id} index={i} asset={a} added={ids.includes(a.id)} onAdd={() => toggle(a.id)} onOpen={() => openDetail(a.id)}/>)}
            </div>}
      </div>
    </main>

    {!narrow && <Dock ref={dockRef} bagRef={bagRef} open={dockOpen} setOpen={setDockOpen} selected={selected} task={task} setTask={setTask} landDelay={landDelay} reduced={reduced} onRemove={id => toggle(id, {force: true})} onOpen={openDetail} onHandoff={openHandoff} onClear={clearCart}/>}

    {narrow && <button ref={pillRef} className={`pill ${selected.length ? 'has' : ''}`} onClick={() => setOverlay('cart')} aria-label={`交接包，${selected.length} 项`}>
      <Glyph name="bag" size={20}/><span>交接包</span><span className="pill-count"><Ticker value={selected.length}/></span>
    </button>}

    <div className="toast-region" role="status" aria-live="polite">
      {notice && <div key={notice.key} className="toast"><Glyph name="check" size={15}/><span>{notice.text}</span>
        {notice.undo && <button onClick={() => (notice.undo.restore ? restore(notice.undo.restore) : undo(notice.undo))}>撤回</button>}
      </div>}
    </div>

    <Drawer isOpen={overlay === 'detail' && !!detail} onOpenChange={o => { if (!o) setOverlay(null); }} label={detail?.title || '详情'} width={460} padding={0} experimental={{isFullWidthOnMobile: true}}>
      {detail && <Detail asset={detail} added={ids.includes(detail.id)} onAdd={() => toggle(detail.id)} onClose={() => setOverlay(null)}/>}
    </Drawer>
    <Drawer isOpen={overlay === 'cart'} onOpenChange={o => { if (!o) setOverlay(null); }} label="交接包" width={420} padding={0} experimental={{isFullWidthOnMobile: true}}>
      <div className="sheet">
        <CartPanel selected={selected} task={task} setTask={setTask} reduced={reduced} onRemove={id => toggle(id, {force: true})} onOpen={openDetail} onHandoff={openHandoff} onClear={clearCart} onClose={() => setOverlay(null)}/>
      </div>
    </Drawer>
    <Dialog isOpen={overlay === 'handoff'} onOpenChange={o => { if (!o) setOverlay(null); }} width={720} padding={0} aria-label="交接预览">
      {overlay === 'handoff' && <Handoff selected={selected} task={task} setTask={setTask} reduced={reduced} onRemove={id => toggle(id, {force: true})} onClose={() => setOverlay(null)}/>}
    </Dialog>
  </div>;
}

/* ---------- 左侧图标导航 ---------- */
function Rail({category, onPick, reduced, systemReduce, setManualReduce}) {
  const idx = categories.findIndex(c => c.id === category);
  const tabs = useRef([]);
  const [ind, setInd] = useState(null);
  useLayoutEffect(() => {
    const measure = () => { const el = tabs.current[idx]; if (el) setInd({x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight}); };
    measure(); addEventListener('resize', measure); return () => removeEventListener('resize', measure);
  }, [idx]);
  return <nav className="rail" aria-label="资料分类">
    <div className="brand" aria-label="SkillBridge"><BrandMark/></div>
    <div className="rail-tabs" role="tablist">
      {ind && <span className="rail-ind" style={{transform: `translate(${ind.x}px, ${ind.y}px)`, width: ind.w, height: ind.h}} aria-hidden="true"/>}
      {categories.map((c, i) => <Tooltip key={c.id} content={c.label} placement="end">
        <button ref={el => (tabs.current[i] = el)} role="tab" aria-selected={category === c.id} aria-label={c.label} data-category={c.id} className={`rail-tab ${category === c.id ? 'on' : ''}`} onClick={() => onPick(c.id)}
          onKeyDown={e => { const o = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0; if (o) { e.preventDefault(); const n = (i + o + categories.length) % categories.length; onPick(categories[n].id); tabs.current[n]?.focus(); } }}>
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
      <Tooltip content="全部为虚构的示例数据，不读取你的电脑" placement="end"><span className="sample" tabIndex={0}>示例</span></Tooltip>
    </div>
  </nav>;
}

/* ---------- 卡片（正式界面的可读卡片：中文用途 + 原名） ---------- */
function ItemCard({asset, added, onAdd, onOpen, index = 0, ghost}) {
  const ref = useRef(null);
  function move(e) {
    const el = ref.current; if (!el || e.pointerType === 'touch' || el.closest('.rm')) return;
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`);
    el.style.setProperty('--rx', `${(0.5 - py) * 5}deg`); el.style.setProperty('--ry', `${(px - 0.5) * 6}deg`);
  }
  function leave() { const el = ref.current; if (!el) return; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
  return <div className="cell" style={{'--i': Math.min(index, 11)}} role={ghost ? undefined : 'listitem'}>
    <div ref={ref} className="tilt readable-card" data-asset={ghost ? undefined : asset.id} data-selected={added} onPointerMove={ghost ? undefined : move} onPointerLeave={ghost ? undefined : leave}>
      <Card padding={0}>
        <article className="item">
          {!ghost && <button className="hit" onClick={onOpen} aria-label={`查看 ${asset.title}`}/>}
          <div className="item-top">
            <Tile asset={asset} data-tile={ghost ? undefined : asset.id}/>
            <Source/>
          </div>
          <h4 className="item-name">{asset.title}{asset.state && <Tooltip content={asset.state}><span className="flag" tabIndex={ghost ? -1 : 0}><span className="sr-only">{asset.state}</span></span></Tooltip>}</h4>
          {asset.subtitle && <p className="item-original" title={asset.subtitle}>{asset.subtitle}</p>}
          <p className="item-description">{asset.description}</p>
          <p className="item-brief">{asset.footer}</p>
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

/* ---------- 右侧交接包栏：点击空白处展开 ---------- */
const Dock = React.forwardRef(function Dock({bagRef, open, setOpen, selected, landDelay, reduced, onHandoff, ...rest}, ref) {
  const stack = usePresence([...selected].reverse().slice(0, 6), reduced ? 0 : 280);
  const extra = Math.max(0, selected.length - 6);
  return <aside ref={ref} className={`dock ${open ? 'open' : ''} ${selected.length ? 'has' : ''}`} aria-label="交接包"
    onClick={e => { if (!open && !e.target.closest('button, input, textarea, select, a, [role="button"]')) setOpen(true); }}>
    <button ref={bagRef} className="bag" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`交接包，${selected.length} 项`}>
      <Glyph name="bag" size={22}/>
      <span className="bag-count"><Ticker value={selected.length}/></span>
    </button>
    <div className="dock-slim" aria-hidden={open} inert={open}>
      <div className="stack">
        {stack.map(({item, leaving}) => {
          const delay = landDelay.current.get(item.id);
          return <button key={item.id} tabIndex={open || leaving ? -1 : 0} disabled={leaving} className={`stack-item ${leaving ? 'leaving' : ''}`} style={delay ? {animationDelay: `${delay}ms`} : undefined} data-stack={leaving ? undefined : item.id} onClick={() => setOpen(true)} aria-label={item.title}>
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

function CartPanel({selected, task, setTask, landDelay, reduced, onRemove, onOpen, onHandoff, onClear, onClose, docked}) {
  const rows = usePresence(selected, reduced ? 0 : 280);
  return <div className="cart">
    <div className="cart-head">
      <h4>交接包<span className="cart-n"><Ticker value={selected.length}/></span></h4>
      <div className="cart-head-actions">
        {selected.length > 0 && <Button label="清空" variant="ghost" size="sm" onClick={onClear}/>}
        <IconButton label={docked ? '收起' : '关闭'} variant="ghost" size="sm" icon={<Glyph name="close" size={16}/>} onClick={onClose}/>
      </div>
    </div>
    <div className="cart-task"><TextInput label="本次任务" value={task} onChange={setTask} placeholder="这次想完成什么？"/></div>
    <div className="cart-list">
      {rows.length === 0 && <div className="cart-empty"><span className="empty-orb"><Glyph name="bag" size={24}/></span><p>还是空的</p></div>}
      {rows.map(({item, leaving}) => {
        const delay = landDelay?.current.get(item.id);
        return <div key={item.id} className={`row ${leaving ? 'leaving' : ''}`} style={delay ? {animationDelay: `${delay}ms`} : undefined}>
          <Tile asset={item} size="sm"/>
          <button className="row-name" onClick={() => onOpen(item.id)} tabIndex={leaving ? -1 : 0}>{item.title}{item.state && <span className="flag"/>}</button>
          <IconButton label={`移除 ${item.title}`} variant="ghost" size="sm" icon={<Glyph name="close" size={14}/>} onClick={() => onRemove(item.id)} isDisabled={leaving}/>
        </div>;
      })}
    </div>
    <div className="cart-foot">
      <Button label="预览交接" variant="primary" size="lg" width="100%" isDisabled={!selected.length} endContent={<Glyph name="arrow" size={17}/>} onClick={onHandoff}/>
    </div>
  </div>;
}

function Detail({asset, added, onAdd, onClose}) {
  return <div className="detail">
    <div className="detail-bar"><span className="sample-tag">示例数据</span><IconButton label="关闭" variant="ghost" icon={<Glyph name="close" size={18}/>} onClick={onClose} data-autofocus/></div>
    <div className="detail-hero">
      <Tile asset={asset} size="lg"/>
      <div className="chips"><span className="chip">{catOf(asset).label}</span><span className="chip"><Glyph name="codex" size={12} stroke={1.9}/>Codex</span></div>
    </div>
    <h2>{asset.title}</h2>
    {asset.subtitle && <p className="detail-original">{asset.subtitle}</p>}
    <p className="detail-desc">{asset.description}</p>
    {asset.state && <div className="warn"><span className="flag"/>{asset.state}</div>}
    {asset.body && <pre className="detail-body">{asset.body}</pre>}
    <ul className="files">{asset.files.map(f => <li key={f}><Glyph name="file" size={15}/><code>{f}</code></li>)}</ul>
    <div className="detail-act"><AddButton added={added} title={asset.title} id={asset.id} onClick={onAdd} size="lg" withLabel/></div>
  </div>;
}

/* ---------- 交接预览（样式演示，不生成真实交接包） ---------- */
function buildPrompt(task, project, selected) {
  return `【示例数据 · 官网演示，未生成真实交接包】
任务：${task || '未填写'}
项目位置：${project || '未填写'}

已选资料：
${selected.map(a => `- ${a.title}（${catOf(a).label}${a.state ? `，${a.state}` : ''}）`).join('\n')}

在你的电脑上运行 SkillBridge 后，交接包会包含真实文件、清单和可复制的提示词。生成交接包不代表接收方已读取、安装或成功调用。`;
}
function Handoff({selected, task, setTask, reduced, onRemove, onClose}) {
  const [phase, setPhase] = useState('idle');
  const [project, setProject] = useState('示例项目 demo-notes');
  const prompt = buildPrompt(task, project, selected);
  const sig = selected.map(a => a.id).join('|') + task + project;
  const sigRef = useRef(sig);
  useEffect(() => { if (sigRef.current !== sig) { sigRef.current = sig; setPhase('idle'); } }, [sig]);
  const chips = usePresence(selected, reduced ? 0 : 260);
  function generate() {
    if (!selected.length) return;
    if (reduced) { setPhase('ready'); return; }
    setPhase('generating');
    setTimeout(() => setPhase(p => (p === 'generating' ? 'ready' : p)), 720);
  }
  const lines = prompt.split('\n');
  return <div className={`handoff phase-${phase}`}>
    <div className="ho-head">
      <h2>交接预览<span className="sample-tag">示例数据</span></h2>
      <IconButton label="关闭" variant="ghost" icon={<Glyph name="close" size={18}/>} onClick={onClose} data-autofocus/>
    </div>
    <div className="ho-fields">
      <TextInput label="本次任务" value={task} onChange={setTask}/>
      <TextInput label="项目位置" placeholder="可选" value={project} onChange={setProject}/>
    </div>
    <div className="ho-chips">
      {chips.length === 0 && <p className="ho-empty">交接包是空的</p>}
      {chips.map(({item, leaving}, i) => <span key={item.id} className={`ho-chip ${leaving ? 'leaving' : ''}`} style={{'--i': i}}>
        <Tile asset={item} size="sm"/>{item.title}{item.state && <Tooltip content={item.state}><span className="flag" tabIndex={0}/></Tooltip>}
        <button className="ho-x" aria-label={`移除 ${item.title}`} onClick={() => onRemove(item.id)} disabled={leaving}><Glyph name="close" size={12}/></button>
      </span>)}
    </div>
    <div className="ho-prompt">
      {phase !== 'ready'
        ? <div className={`ho-gen ${phase === 'generating' ? 'busy' : ''}`}>
            <span className="gen-orb" aria-hidden="true"><Glyph name="sparkle" size={22}/></span>
            <Button label={phase === 'generating' ? '生成中…' : '生成示例提示词'} variant="primary" size="lg" isDisabled={!selected.length || phase === 'generating'} onClick={generate}/>
          </div>
        : <div className="ho-ready">
            <div className="ho-badge"><Glyph name="sparkle" size={14}/>示例提示词</div>
            <div className="ho-text" tabIndex={0} aria-label="示例提示词">
              {lines.map((l, i) => <div key={i} className="ln" style={{'--i': i}}>{l || '\u00a0'}</div>)}
            </div>
          </div>}
    </div>
    <div className="ho-actions">
      <Tooltip content="真实交接包需在你的电脑上运行 SkillBridge 生成"><span><Button label="生成交接包" variant="ghost" isDisabled/></span></Tooltip>
    </div>
    <span className="sr-only" role="status">{phase === 'ready' ? '示例提示词已生成' : ''}</span>
  </div>;
}
