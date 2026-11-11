import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {TextInput} from '@astryxdesign/core/TextInput';
import {SideNav, SideNavItem} from '@astryxdesign/core/SideNav';
import {Drawer} from '@astryxdesign/core/Drawer';
import {categories, assets} from './data';
import './styles.css';

const paths = {
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>,
  memory: <><path d="M9 5a3 3 0 0 0-5 2 3 3 0 0 0-1 5 4 4 0 0 0 2 7 3 3 0 0 0 5 1V4a3 3 0 0 0-5 1M15 5a3 3 0 0 1 5 2 3 3 0 0 1 1 5 4 4 0 0 1-2 7 3 3 0 0 1-5 1V4a3 3 0 0 1 5 1M6 11l4 2M14 13l4-2"/></>,
  plug: <><path d="M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v3"/></>,
  chart: <><path d="M4 3v17h17M8 15v-4M13 15V7M18 15v-6"/></>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  pen: <><path d="m15 4 5 5M5 19l1-6L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L11 18l-6 1ZM4 22h16"/></>,
  motion: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 4l-4 16"/></>,
  text: <><path d="M4 5h16M12 5v16M8 21h8M4 5v4M20 5v4"/></>,
  folder: <><path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></>,
  bag: <><path d="M5 8h14l1 12H4L5 8ZM8 8V6a4 4 0 0 1 8 0v2"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>, down: <path d="m6 9 6 6 6-6"/>, search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  list: <><path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/></>,
  star: <path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1 3-6Z"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  warning: <><path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.01"/></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
};
function Glyph({name, size = 20}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>; }
function AssetIcon({asset, small = false}) { return <span className={`asset-icon tone-${asset.tone} ${small ? 'small' : ''}`}><Glyph name={asset.icon} size={small ? 17 : 23}/></span>; }
const STORE = 'skillbridge.cart-preview.v1';
function loadDraft() { try { const d = JSON.parse(localStorage.getItem(STORE) || '{}'); return {ids: Array.isArray(d.ids) ? [...new Set(d.ids)].filter(id => assets.some(a => a.id === id)) : [], task: typeof d.task === 'string' ? d.task : '设计 SkillBridge 新版界面', project: typeof d.project === 'string' ? d.project : 'D:\\skillbridge'}; } catch {return {ids: [], task: '设计 SkillBridge 新版界面', project: 'D:\\skillbridge'};} }

function App() {
  const [draft, setDraft] = useState(loadDraft);
  const [category, setCategory] = useState('skills');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [source, setSource] = useState('all');
  const [view, setView] = useState('grid');
  const [drawer, setDrawer] = useState(null);
  const [detailId, setDetailId] = useState('frontend');
  const [notice, setNotice] = useState(null);
  const [reduce, setReduce] = useState(false);
  const [systemReduce, setSystemReduce] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [saveError, setSaveError] = useState(false);
  const [copied, setCopied] = useState(false);
  const idsRef = useRef(new Set(draft.ids));
  const flights = useRef(new Map());
  const timer = useRef();
  const cartAnchor = useRef();
  const mobileAnchor = useRef();
  const selected = draft.ids.map(id => assets.find(a => a.id === id)).filter(Boolean);
  const current = categories.find(c => c.id === category);
  const detail = assets.find(a => a.id === detailId);
  const reduced = reduce || systemReduce;
  const filtered = assets.filter(a => a.type === category && (source === 'all' || a.source === source) && (filter !== 'frequent' || a.frequent) && (filter !== 'selected' || draft.ids.includes(a.id)) && `${a.title} ${a.description} ${a.tags.join(' ')} ${a.source}`.toLowerCase().includes(query.toLowerCase()));
  const groups = category === 'skills' && filter === 'all' && !query ? [{label: '已确认常用', items: filtered.filter(a => a.frequent)}, {label: '其他技能', items: filtered.filter(a => !a.frequent)}] : [{label: '', items: filtered}];

  useEffect(() => { try {localStorage.setItem(STORE, JSON.stringify(draft)); setSaveError(false);} catch {setSaveError(true);} }, [draft]);
  useEffect(() => { const mq = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setSystemReduce(mq.matches); mq.addEventListener('change', change); return () => mq.removeEventListener('change', change); }, []);
  function cancelFlights() { flights.current.forEach(({el, animation}) => {animation.cancel(); el.remove();}); flights.current.clear(); }
  useEffect(() => { if (reduced) cancelFlights(); }, [reduced]);
  useEffect(() => { const stop = () => cancelFlights(); window.addEventListener('resize', stop); return () => {window.removeEventListener('resize', stop); cancelFlights(); clearTimeout(timer.current);}; }, []);
  useEffect(() => { setCopied(false); }, [draft]);
  function tell(text, undo) { clearTimeout(timer.current); setNotice({text, undo}); timer.current = setTimeout(() => setNotice(null), 5500); }
  function fly(asset, origin, removing) {
    const previous = flights.current.get(asset.id);
    let start = previous?.el.getBoundingClientRect() || origin;
    if (previous) { previous.animation.cancel(); previous.el.remove(); flights.current.delete(asset.id); }
    if (reduced || !start) return;
    const cart = innerWidth <= 1100 ? mobileAnchor.current : cartAnchor.current;
    const button = document.querySelector(`[data-add="${asset.id}"]`);
    const finish = removing ? button?.getBoundingClientRect() : cart?.getBoundingClientRect();
    if (!finish || finish.width === 0) return;
    const el = document.createElement('div'); el.className = 'flying-token'; el.textContent = asset.title; el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    const sx = start.x + start.width / 2 - 60, sy = start.y + start.height / 2 - 18;
    const ex = finish.x + finish.width / 2 - 60, ey = finish.y + finish.height / 2 - 18;
    el.style.left = `${sx}px`; el.style.top = `${sy}px`;
    const animation = el.animate([{transform: 'translate(0,0) scale(1)', opacity: .95}, {transform: `translate(${(ex-sx)*.54}px,${Math.min(ey-sy,0)-45}px) scale(.86) rotate(-4deg)`, opacity: .95, offset: .48}, {transform: `translate(${ex-sx}px,${ey-sy}px) scale(.3)`, opacity: 0}], {duration: 480, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'forwards'});
    flights.current.set(asset.id, {el, animation});
    animation.finished.then(() => {el.remove(); if (flights.current.get(asset.id)?.el === el) flights.current.delete(asset.id);}).catch(() => {});
  }
  function toggle(id, event) {
    const asset = assets.find(a => a.id === id); const removing = idsRef.current.has(id);
    const origin = event?.currentTarget?.getBoundingClientRect();
    if (removing) idsRef.current.delete(id); else idsRef.current.add(id);
    setDraft(d => ({...d, ids: [...idsRef.current]}));
    fly(asset, origin, removing);
    tell(`${removing ? '已移出' : '已加入'} ${asset.title}`, {id, removing});
  }
  function clearCart() { idsRef.current.clear(); setDraft(d => ({...d, ids: []})); cancelFlights(); tell('购物车已清空，源资料不受影响'); }
  function switchCategory(id) { setCategory(id); setQuery(''); if (filter === 'frequent') setFilter('all'); cancelFlights(); window.scrollTo({top:0,behavior:'instant'}); }
  function openDetail(id) {setDetailId(id); setDrawer('detail'); cancelFlights();}
  function addButton(asset, large = false) { const added = draft.ids.includes(asset.id); return <span className={`add-wrap ${added ? 'is-added' : ''}`}><Button label={added ? '已加入' : '加入'} aria-label={`${added ? '移出' : '加入'} ${asset.title}`} variant={added ? 'secondary' : 'ghost'} size={large ? 'lg' : 'md'} icon={<Glyph name={added ? 'check' : 'plus'} size={17}/>} data-add={asset.id} aria-pressed={added} onClick={event => toggle(asset.id, event)}/></span>; }
  function cartBody(inDrawer = false) { return <div className="cart-body">
    <div className="cart-title"><div ref={inDrawer ? undefined : cartAnchor} className="cart-target"><Glyph name="bag" size={21}/><h2>本次购物车</h2><span className="count-bubble" data-cart-count={selected.length}>{selected.length}</span></div>{selected.length > 0 && <Button label="清空" variant="ghost" size="sm" onClick={clearCart}/>}</div>
    <p className="cart-subtitle">为下一位 Agent 准备资料</p>
    <div className="task-fields"><TextInput label="本次任务" value={draft.task} onChange={task => setDraft(d => ({...d, task}))} placeholder="这次想完成什么？"/><div className="project-field"><Glyph name="folder" size={15}/><label className="sr-only" htmlFor={inDrawer ? 'project-mobile' : 'project-desktop'}>项目位置</label><input id={inDrawer ? 'project-mobile' : 'project-desktop'} value={draft.project} onChange={e => setDraft(d => ({...d, project: e.target.value}))} placeholder="项目位置（可选）"/></div></div>
    <div className="cart-items">{selected.length === 0 ? <div className="cart-empty"><span className="empty-bag"><Glyph name="bag" size={38}/><span className="empty-plus"><Glyph name="plus" size={14}/></span></span><h3>把需要的资料放进来</h3><p>从 Skills 开始，也可以搭配<br/>规则、记忆和工具配置。</p><span className="empty-hint">点击条目旁的「加入」</span></div> : categories.map(c => {const items = selected.filter(a => a.type === c.id); return items.length ? <section className="cart-group" key={c.id}><h3>{c.label}<span>{items.length}</span></h3>{items.map(a => <div className="cart-item" key={a.id}><AssetIcon asset={a} small/><div className="cart-item-copy"><button onClick={() => openDetail(a.id)}>{a.title}</button><span className={a.missing ? 'warning-text' : ''}>{a.missing ? '缺少 1 个文件' : `${a.source} · ${a.files.length} 个文件`}</span></div><button className="icon-button remove" aria-label={`移除 ${a.title}`} onClick={e => toggle(a.id, e)}><Glyph name="close" size={16}/></button></div>)}</section> : null;})}</div>
    <div className="cart-footer">{selected.some(a => a.missing) && <p className="cart-warning"><Glyph name="warning" size={15}/>有资料缺少文件，可在预览中查看</p>}<div className="cart-summary"><span>{selected.length ? `已选 ${selected.length} 项 · ${selected.reduce((n,a)=>n+a.files.length,0)} 个文件` : '还没有选择资料'}</span><span>{selected.length ? `${new Set(selected.map(a=>a.type)).size} 类资料` : ''}</span></div><span className="primary-action"><Button label="预览交接内容" variant="primary" isDisabled={!selected.length} endContent={<Glyph name="arrow" size={17}/>} onClick={() => setDrawer('handoff')}/></span><p className={`save-note ${saveError ? 'warning-text' : ''}`}><Glyph name={saveError ? 'warning' : 'check'} size={13}/>{saveError ? '浏览器未能保存草稿，请保留当前页面' : '预览草稿保存在此浏览器'}</p></div>
  </div>; }
  const prompt = `【界面预览示例，尚未生成真实交接包】\n任务：${draft.task || '未填写'}\n项目位置：${draft.project || '未填写'}\n已选资料：\n${selected.map(a=>`- ${a.title}（${categories.find(c=>c.id===a.type).label}，${a.files.length} 个示例文件${a.missing ? '，文件待补充' : ''}）`).join('\n')}\n\n实际使用前需先生成并提供可访问的资料包。此示例不代表资料已导出、安装或验证。`;
  async function copyPrompt() {try {await navigator.clipboard.writeText(prompt); setCopied(true);} catch {tell('未能复制，请在下方文本框中手动选择并复制');} }

  return <Theme theme={neutralTheme} mode="light"><div className={`workbench ${reduced ? 'reduce-motion' : ''}`}>
    <a href="#main" className="skip-link">跳到资料列表</a>
    <header className="topbar"><a className="brand" href="#" onClick={e=>{e.preventDefault();switchCategory('skills');}} aria-label="SkillBridge 首页"><span className="brand-mark"><svg width="27" height="27" viewBox="0 0 28 28" aria-hidden="true"><path d="M5 21V10a9 9 0 0 1 18 0v11M5 15h18M10 15v6M18 15v6" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/></svg></span><strong>SkillBridge</strong></a><span className="top-divider"/><span className="workspace-name">个人工作台</span><div className="top-actions"><span className="preview-badge"><span/>交互预览 · 示例资料</span><button className="icon-button info-button" aria-label="预览说明与参考" onClick={()=>setDrawer('info')}><Glyph name="info" size={19}/></button><span className="user-avatar" aria-label="本地个人档案">BL</span></div></header>
    <div className="workspace-layout"><aside className="sidebar"><div className="workspace-picker"><span className="workspace-symbol"><Glyph name="folder" size={18}/></span><div><strong>我的资料</strong><span>个人与项目</span></div></div><div className="sidebar-section-label">资料分类</div><div className="category-nav"><SideNav aria-label="资料分类">{categories.map(c=><SideNavItem key={c.id} label={c.label} icon={<Glyph name={c.icon}/>} isSelected={category===c.id} onClick={()=>switchCategory(c.id)} data-category={c.id} endContent={<span className="nav-count">{assets.filter(a=>a.type===c.id).length}</span>}/>)}</SideNav></div><div className="sidebar-bottom"><button className="sidebar-info" onClick={()=>setDrawer('info')}><Glyph name="info" size={17}/>预览说明与参考</button><div className="local-note"><span className="local-dot"/>本地优先<span>草稿仅存此浏览器</span></div></div></aside>
    <main id="main" tabIndex={-1} className="main-content"><div className="page-heading"><div><h1>{current.label}<span className="heading-count">{assets.filter(a=>a.type===category).length}</span></h1><p>{current.subtitle}</p></div><div className="view-control" role="group" aria-label="显示方式"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="卡片视图" aria-pressed={view==='grid'}><Glyph name="grid" size={18}/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="列表视图" aria-pressed={view==='list'}><Glyph name="list" size={19}/></button></div></div>
    <div className="search-row"><div className="search-input"><Glyph name="search" size={18}/><TextInput label={`搜索${current.label}`} isLabelHidden value={query} onChange={setQuery} placeholder={`搜索${category==='skills'?'技能名称、用途':current.label+'名称、内容'}…`}/></div><label className="source-filter"><span className="sr-only">来源应用</span><select aria-label="来源应用" value={source} onChange={e=>setSource(e.target.value)}><option value="all">全部来源</option><option>Codex</option><option>Claude Code</option><option>Cursor</option></select><Glyph name="down" size={14}/></label></div>
    <div className="filter-row"><div className="filter-tabs" role="group" aria-label="资料筛选">{[{id:'all',label:'全部'},...(category==='skills'?[{id:'frequent',label:'常用'}]:[]),{id:'selected',label:'已加入'}].map(f=><button key={f.id} aria-pressed={filter===f.id} className={filter===f.id?'active':''} onClick={()=>setFilter(f.id)}>{f.id==='frequent'&&<Glyph name="star" size={14}/>} {f.label}{f.id==='selected'&&<span>{selected.filter(a=>a.type===category).length}</span>}</button>)}</div><span className="result-count">{filtered.length} {current.unit}</span></div>
    <div className={`asset-collection view-${view}`}>{filtered.length===0 ? <div className="search-empty"><Glyph name={filter==='selected'?'bag':'search'} size={35}/><h2>{filter==='selected'?'这个分类还没有已选资料':'没有找到匹配资料'}</h2><p>{filter==='selected'?'浏览全部资料，选择本次需要的内容。':'试试其他关键词，或清除筛选条件。'}</p><Button label="查看全部" onClick={()=>{setQuery('');setSource('all');setFilter('all');}}/></div> : groups.filter(g=>g.items.length).map(g=><section className="asset-section" key={g.label||'items'}>{g.label&&<div className="group-heading"><h2>{g.label}</h2>{g.label==='已确认常用'&&<span>优先展示，本次自由选择</span>}</div>}<div className="asset-grid">{g.items.map(a=><Card padding={0} key={a.id} data-asset={a.id} data-selected={draft.ids.includes(a.id)}><article className="asset-card"><div className="asset-top"><AssetIcon asset={a}/><span className={`asset-status ${a.missing ? 'warning-text' : ''}`}>{a.missing ? <><Glyph name="warning" size={13}/>缺少文件</> : a.frequent ? <><Glyph name="star" size={13}/>常用</> : a.stale ? '已过期' : a.scope+'资料'}</span></div><button className="asset-title" onClick={()=>openDetail(a.id)} aria-label={`查看 ${a.title} 详情`}><h3>{a.title}</h3><Glyph name="arrow" size={15}/></button><p className="asset-description">{(a.missing || a.stale) && <span className="list-state">{a.missing ? "缺少文件" : "已过期"}</span>}{a.description}</p><div className="asset-tags">{a.tags.map(t=><span key={t}>{t}</span>)}</div><div className="asset-bottom"><div className="asset-meta"><span className="source-name"><span className={`source-dot source-${a.source.split(' ')[0].toLowerCase()}`}/>{a.source}</span><span>{a.files.length} 个文件</span></div>{addButton(a)}</div></article></Card>)}</div></section>)}</div><div className="collection-footer"><Glyph name="check" size={14}/>只交接你选中的资料<span>示例清单 · 不操作源文件</span></div>
    </main><aside className="cart-panel" aria-label="购物车">{cartBody()}</aside></div>
    <div className="mobile-cart-bar"><button ref={mobileAnchor} className="mobile-cart-open" onClick={()=>setDrawer('cart')}><Glyph name="bag" size={22}/><span><strong>购物车 <span className="count-bubble">{selected.length}</span></strong><small>{selected.length ? `${new Set(selected.map(a=>a.type)).size} 类资料，选择已保留` : '选择本次需要的资料'}</small></span></button><Button label="查看购物车" variant="primary" onClick={()=>setDrawer('cart')}/></div>
    <div className="notification-region" role="status" aria-live="polite">{notice&&<div className="toast"><Glyph name="check" size={17}/><span>{notice.text}</span>{notice.undo&&<button onClick={()=>{toggle(notice.undo.id);setNotice(null);}}>撤回</button>}</div>}</div>
    <Drawer isOpen={drawer!==null} onOpenChange={open=>{if(!open)setDrawer(null);}} label={drawer==='detail'?detail.title:drawer==='handoff'?'交接内容预览':drawer==='info'?'预览说明与参考':'购物车'} width={drawer==='handoff'?690:drawer==='info'?620:470} padding={0}>
      <div className="drawer-header"><span>{drawer==='detail'?'资料详情':drawer==='handoff'?'交接内容预览':drawer==='info'?'预览说明与参考':'本次购物车'}</span><div className="drawer-header-actions">{drawer === "cart" && selected.length > 0 && <Button label="清空" variant="ghost" size="sm" onClick={clearCart}/>}<button className="icon-button" aria-label="关闭面板" data-autofocus onClick={()=>setDrawer(null)}><Glyph name="close"/></button></div></div>
      {drawer==='cart'&&<div className="drawer-cart">{cartBody(true)}</div>}
      {drawer==='detail'&&<div className="detail-content"><AssetIcon asset={detail}/><h2>{detail.title}</h2><p className="detail-description">{detail.description}</p><dl className="detail-meta"><div><dt>分类</dt><dd>{categories.find(c=>c.id===detail.type).label}</dd></div><div><dt>来源</dt><dd>{detail.source} · 示例</dd></div><div><dt>范围</dt><dd>{detail.scope}</dd></div><div><dt>修订</dt><dd>预览样本 v1</dd></div></dl>{detail.body&&<section className="detail-section"><h3>{detail.type==='mcp'?'配置与接入说明':'内容摘要'}</h3><pre>{detail.body}</pre></section>}<section className="detail-section"><h3>包含的文件 <span>{detail.files.length}</span></h3><ul className="file-list">{detail.files.map(f=><li key={f}><Glyph name="file" size={16}/><code>{f}</code>{detail.missing===f?<span className="warning-text">缺失</span>:<span>示例</span>}</li>)}</ul></section>{detail.missing&&<p className="warning-box"><Glyph name="warning"/>配套脚本缺失。可先保留选择，补齐文件后再生成资料包。</p>}<div className="detail-actions">{addButton(detail,true)}<span>只改变本次选择</span></div></div>}
      {drawer==='handoff'&&<div className="handoff-content"><div className="handoff-heading"><span className="handoff-icon"><Glyph name="bag" size={25}/></span><div><h2>{draft.task||'本次交接'}</h2><p>{draft.project||'未指定项目'} · {selected.length} 项资料</p></div></div><div className="preview-callout"><Glyph name="info" size={18}/><span>内容预览 · 示例资料，尚未生成真实文件包</span></div><section className="detail-section"><h3>已选内容</h3>{selected.length?selected.map(a=><div className="review-row" key={a.id}><AssetIcon asset={a} small/><div><strong>{a.title}</strong><span>{categories.find(c=>c.id===a.type).label} · {a.files.length} 个文件</span></div><span className={a.missing?'review-status warning-text':'review-status'}>{a.missing?'缺少文件':a.stale?'已过期':a.type==='mcp'?'配置待补充':'示例文件齐全'}</span><button className="icon-button" aria-label={`预览中移除 ${a.title}`} onClick={e=>toggle(a.id,e)}><Glyph name="close" size={16}/></button></div>):<p className="empty-review">购物车为空。返回分类浏览，选择需要的资料。</p>}</section>{selected.some(a=>a.missing)&&<div className="warning-box"><Glyph name="warning"/><div><strong>有文件需要补充</strong><p>{selected.filter(a=>a.missing).map(a=>`${a.title} / ${a.missing}`).join('；')}</p></div></div>}<section className="detail-section"><h3>示例提示词</h3><textarea className="prompt-preview" aria-label="示例提示词" value={prompt} readOnly rows={9}/></section><div className="handoff-actions"><span className="primary-action"><Button label={copied?'已复制示例':'复制示例提示词'} icon={<Glyph name={copied?'check':'copy'} size={17}/>} variant="primary" isDisabled={!selected.length} onClick={copyPrompt}/></span><Button label="生成交接包" isDisabled/></div><p className="handoff-note">资料包导出尚未接入。复制示例不表示目标已安装或已接收。</p></div>}
      {drawer==='info'&&<div className="info-content"><h2>资料购物车 · 方案 01</h2><p>使用 Astryx 0.7.13 的真实组件与 Neutral 主题。预览中的条目、来源和文件状态均为示例。</p><section className="detail-section"><h3>这次可以体验</h3><ol><li>切换五种分类，搜索或筛选资料。</li><li>点击「加入」，观察条目落入购物车。</li><li>连续加入、撤回或跨分类选择。</li><li>查看详情、交接内容，刷新恢复预览草稿。</li></ol></section><label className="motion-setting"><span><strong>减少动态效果</strong><small>{systemReduce?'系统已启用，自动减少位移':'使用选中状态和数量变化代替飞入动效'}</small></span><input type="checkbox" checked={reduced} disabled={systemReduce} onChange={e=>setReduce(e.target.checked)} role="switch" aria-label="减少动态效果"/></label><section className="detail-section"><h3>参考与组件</h3><a href="https://astryx.atmeta.com/templates?preview=library" target="_blank" rel="noreferrer">Card Grid · 搜索、分类和卡片 <Glyph name="arrow" size={16}/></a><a href="https://astryx.atmeta.com/components" target="_blank" rel="noreferrer">SideNav / Button / TextInput / Card / Drawer <Glyph name="arrow" size={16}/></a><a href="https://astryx.atmeta.com/themes?theme=neutral" target="_blank" rel="noreferrer">Neutral · 基础色彩与控件 <Glyph name="arrow" size={16}/></a></section><p>分组购物车、加入轨迹和交接预览是本次设计。浅色工作区突出资料与选择状态；正式配色和布局待评审。</p><div className="preview-callout"><Glyph name="info"/><span>不扫描本机资料，不修改源文件，不连接真实 Agent。草稿仅保存在预览浏览器。</span></div></div>}
    </Drawer>
  </div></Theme>;
}
createRoot(document.getElementById('root')).render(<App/>);
