import React, {useEffect, useId, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {Glyph, BrandMark} from './Glyph';
import Demo, {useMedia} from './demo/Demo';
import {installSpringVars, arcFrames} from './demo/motion';
import LAUNCH_PROMPT from './launch-prompt.txt?raw';
import './demo/demo.css';
import './site.css';

installSpringVars();
export const REPO_URL = 'https://github.com/brin666/skillbridge-gui';

/* ---------- 复制启动指令 ---------- */
function CopyLaunch() {
  const [state, setState] = useState('idle'); // idle | copying | copied | failed
  const [open, setOpen] = useState(false);
  const fullId = useId();
  const areaRef = useRef(null);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    setState('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
      await navigator.clipboard.writeText(LAUNCH_PROMPT);
      setState('copied');
      timer.current = setTimeout(() => setState(s => (s === 'copied' ? 'idle' : s)), 2600);
    } catch {
      setState('failed');
    }
  }
  useEffect(() => {
    if (state !== 'failed') return;
    const el = areaRef.current;
    if (el) { el.focus({preventScroll: true}); el.select(); }
  }, [state]);
  const copied = state === 'copied';
  return <div className="launch">
    <div className="launch-row">
      <button className={`cta ${copied ? 'done' : ''}`} onClick={copy} disabled={state === 'copying'} data-copy-launch>
        {copied && <span key="b" className="burst big" aria-hidden="true">{Array.from({length: 12}, (_, i) => <i key={i} style={{'--a': `${i * 30}deg`}}/>)}</span>}
        <span className="cta-icon" aria-hidden="true">{copied
          ? <span className="draw-check"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" pathLength="1"/></svg></span>
          : <Glyph name="copy" size={19}/>}</span>
        <span className="cta-label">{copied ? '已复制' : '复制启动指令'}</span>
      </button>
      <p className="launch-hint">复制后，发给你正在使用的本机 Agent。</p>
    </div>
    <span className="sr-only" role="status" aria-live="polite">{copied ? '启动指令已复制到剪贴板' : state === 'failed' ? '没能自动复制，请手动复制下方文本' : ''}</span>

    {state === 'failed' && <div className="manual" role="alert">
      <p><strong>没能自动复制。</strong>文本已选中，按 Ctrl+C（Mac 上按 ⌘C）复制。</p>
      <textarea ref={areaRef} readOnly value={LAUNCH_PROMPT} rows={10} aria-label="启动指令全文" data-manual-copy onFocus={e => e.target.select()}/>
      <div className="manual-act">
        <button className="ghost-btn" onClick={() => { areaRef.current?.focus(); areaRef.current?.select(); }}>全选</button>
        <button className="ghost-btn" onClick={copy}>再试一次</button>
      </div>
    </div>}

    <button className="peek" aria-expanded={open} aria-controls={fullId} onClick={() => setOpen(o => !o)}>
      <span>{open ? '收起指令' : '查看完整指令'}</span><Glyph name="chevron" size={16}/>
    </button>
    <div id={fullId} className={`full ${open ? 'open' : ''}`} inert={!open}>
      <div className="full-inner"><pre className="full-text" tabIndex={open ? 0 : -1}>{LAUNCH_PROMPT}</pre></div>
    </div>
  </div>;
}

/* ---------- 首屏主视觉：一张缩小的产品界面，资料飞进交接包 ---------- */
const heroCards = [
  {id: 'a', icon: 'layers', title: '发布说明撰写', sub: 'release-notes-writer'},
  {id: 'b', icon: 'memory', title: '把周报模板改成表格版', sub: 'Codex 会话名称'},
  {id: 'c', icon: 'file', title: '全局 AGENTS.md', sub: '规则文件'},
  {id: 'd', icon: 'plug', title: 'filesystem', sub: '配置已发现 · 未测试连接'},
];
function HeroVisual({reduced}) {
  const root = useRef(null);
  const bag = useRef(null);
  const [added, setAdded] = useState(reduced ? ['a', 'b'] : []);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), {threshold: 0.2});
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduced) { setAdded(['a', 'b']); setOpen(false); return; }
    if (!live) return;
    let timers = [], anims = [];
    const flyTo = id => {
      const box = root.current, from = box?.querySelector(`[data-hero-add="${id}"]`), to = bag.current;
      if (!box || !from || !to) { setAdded(a => [...a, id]); return; }
      const b = box.getBoundingClientRect(), f = from.getBoundingClientRect(), t = to.getBoundingClientRect();
      const s = 34, sx = f.left - b.left + f.width / 2 - s / 2, sy = f.top - b.top + f.height / 2 - s / 2;
      const ex = t.left - b.left + t.width / 2 - s / 2, ey = t.top - b.top + t.height / 2 - s / 2;
      const tok = document.createElement('div');
      tok.className = 'hero-token'; tok.setAttribute('aria-hidden', 'true');
      tok.innerHTML = box.querySelector(`[data-hero-tile="${id}"]`)?.innerHTML || '';
      tok.style.left = `${sx}px`; tok.style.top = `${sy}px`;
      box.append(tok);
      const anim = tok.animate(arcFrames(sx, sy, ex, ey, {lift: 90, spin: -10, endScale: .5}), {duration: 760, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards'});
      anims.push(anim);
      setAdded(a => a.includes(id) ? a : [...a, id]);
      anim.finished.then(() => to.animate([{transform: 'scale(1)'}, {transform: 'scale(.82) rotate(-6deg)', offset: .2}, {transform: 'scale(1)'}], {duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)'})).catch(() => {}).finally(() => tok.remove());
    };
    const run = () => {
      setAdded([]); setOpen(false);
      timers.push(setTimeout(() => flyTo('a'), 900));
      timers.push(setTimeout(() => flyTo('b'), 2200));
      timers.push(setTimeout(() => flyTo('d'), 3500));
      timers.push(setTimeout(() => setOpen(true), 4900));
      timers.push(setTimeout(() => setOpen(false), 7600));
      timers.push(setTimeout(run, 8600));
    };
    run();
    return () => { timers.forEach(clearTimeout); anims.forEach(a => a.cancel()); root.current?.querySelectorAll('.hero-token').forEach(n => n.remove()); };
  }, [reduced, live]);
  const picked = heroCards.filter(c => added.includes(c.id));
  return <div className="hero-visual" ref={root} aria-hidden="true">
    <div className="hv-bubble"><Glyph name="copy" size={14}/><span>请帮我安装并运行 SkillBridge…</span></div>
    <div className="hv-window">
      <div className="hv-rail">
        <span className="hv-brand"><BrandMark size={15}/></span>
        {['layers', 'file', 'memory', 'plug', 'chart'].map((g, i) => <span key={g} className={`hv-tab ${i === 0 ? 'on' : ''}`}><Glyph name={g} size={14}/></span>)}
      </div>
      <div className="hv-grid">
        {heroCards.map((c, i) => <div key={c.id} className={`hv-card ${added.includes(c.id) ? 'sel' : ''}`} style={{'--i': i}}>
          <span className="hv-tile" data-hero-tile={c.id}><Glyph name={c.icon} size={15}/></span>
          <b>{c.title}</b><small>{c.sub}</small>
          <span className={`hv-add ${added.includes(c.id) ? 'on' : ''}`} data-hero-add={c.id}>
            <span className={`morph ${added.includes(c.id) ? 'is-on' : ''}`}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path className="m-v" d="M12 5v14"/><path className="m-h" d="M5 12h14"/><path className="m-c" d="m5 12.5 4.5 4.5L19 7.5" pathLength="1"/></svg></span>
          </span>
        </div>)}
      </div>
      <div className={`hv-dock ${open ? 'open' : ''} ${picked.length ? 'has' : ''}`}>
        <span className="hv-bag" ref={bag}><Glyph name="bag" size={16}/><i key={picked.length}>{picked.length}</i></span>
        <div className="hv-stack">{picked.map(c => <span key={c.id}><Glyph name={c.icon} size={12}/></span>)}</div>
        <div className="hv-list"><b>交接包</b>{picked.map(c => <span key={c.id}><Glyph name={c.icon} size={12}/>{c.title}</span>)}</div>
      </div>
    </div>
    <span className="hv-note">示例数据</span>
  </div>;
}

/* ---------- 页面 ---------- */
function App() {
  const systemReduce = useMedia('(prefers-reduced-motion: reduce)');
  const [manualReduce, setManualReduce] = useState(false);
  const reduced = systemReduce || manualReduce;
  return <Theme theme={neutralTheme} mode="light">
    <div className={`site ${reduced ? 'rm' : ''}`}>
      <a href="#demo" className="skip">跳到界面演示</a>
      <header className="nav">
        <a className="nav-brand" href="#top" aria-label="SkillBridge 首页"><span className="brand"><BrandMark size={18}/></span><span>SkillBridge</span></a>
        <nav className="nav-links" aria-label="页面">
          <a href="#demo">体验界面</a>
          <a href="#scope">能力范围</a>
          <a className="nav-gh" href={REPO_URL} target="_blank" rel="noreferrer"><Glyph name="github" size={17}/><span>GitHub</span></a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="badge"><i/>已验证入口：Windows + Codex</span>
          <h1>看清你的 Agent，<br/>都带着什么。</h1>
          <p className="lead">让 Agent 整理 Skills、记忆、规则和 MCP，在一个本机界面中查看、选择和交接。</p>
          <CopyLaunch/>
          <div className="secondary">
            <a className="sec-btn" href="#demo"><Glyph name="play" size={15}/>体验界面</a>
            <a className="sec-btn" href={REPO_URL} target="_blank" rel="noreferrer"><Glyph name="github" size={16}/>查看 GitHub</a>
          </div>
        </div>
        <HeroVisual reduced={reduced}/>
      </section>

      <section className="steps" aria-label="使用步骤">
        {[
          {g: 'copy', t: '复制一句话', d: '官网只给你一段启动指令'},
          {g: 'terminal', t: '交给本机 Agent', d: '它下载项目、检查依赖、整理资料'},
          {g: 'window', t: '打开本机界面', d: '在自己电脑上查看、选择和交接'},
        ].map((s, i) => <div className="step" key={s.t} style={{'--i': i}}>
          <span className="step-n">{i + 1}</span><span className="step-g"><Glyph name={s.g} size={20}/></span>
          <b>{s.t}</b><small>{s.d}</small>
        </div>)}
      </section>

      <section className="demo-sec" id="demo" aria-labelledby="demo-title">
        <div className="sec-head">
          <h2 id="demo-title">先在这里试一试</h2>
          <p className="hint-wide">切换分类、搜索、把资料加入交接包，点右侧栏空白处展开。</p>
          <p className="hint-narrow">切换分类、搜索、把资料加入交接包，点底部按钮查看。</p>
          <span className="sample-tag big">示例数据 · 不读取你的电脑</span>
        </div>
        <div className="demo-window">
          <Demo reduced={reduced} manualReduce={manualReduce} systemReduce={systemReduce} setManualReduce={setManualReduce}/>
        </div>
      </section>

      <section className="scope" id="scope" aria-labelledby="scope-title">
        <div className="sec-head"><h2 id="scope-title">说清楚能做什么</h2></div>
        <div className="who">
          <div className="who-card"><span className="who-k">谁来执行启动</span><b>有本机文件和终端权限的 Agent</b><small>首版已验证：Windows 上的 Codex</small></div>
          <span className="who-arrow" aria-hidden="true"><Glyph name="arrow" size={20}/></span>
          <div className="who-card"><span className="who-k">整理谁的资料</span><b>本机 Codex</b><small>Skills · 记忆 · 规则 · MCP 配置</small></div>
        </div>
        <div className="scope-cols">
          <div className="col yes">
            <h3>现在能做</h3>
            <ul>
              <li>按项目文档在 Windows 上启动本机界面</li>
              <li>整理本机 Codex 的 Skills、记忆、规则和 MCP 配置，保留来源</li>
              <li>Skill 显示中文用途和原名，记忆显示会话名称</li>
              <li>整理账本列出读取、解析和登记失败的项目</li>
              <li>选择资料，生成含真实文件、清单和提示词的交接包</li>
            </ul>
          </div>
          <div className="col no">
            <h3>不会做，或还没做</h3>
            <ul>
              <li>不执行 Skill，不启动或测试 MCP；配置被发现不代表能连接</li>
              <li>还不能自动整理 Claude、Cursor 等其他 Agent 的记忆、规则和 MCP</li>
              <li>没有健康分、使用频率或兼容性评分</li>
              <li>交接包生成后，不代表接收方已读取、安装或调用成功</li>
              <li>不上传资料，没有账号、注册或云端同步</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="final">
        <h2>复制一句话，然后看到自己的资料。</h2>
        <CopyLaunch/>
      </section>

      <footer className="foot">
        <span>SkillBridge · MIT 许可</span>
        <span>本站是静态页面，不收集任何信息。</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </div>
  </Theme>;
}

createRoot(document.getElementById('root')).render(<App/>);
