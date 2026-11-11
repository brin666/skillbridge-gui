const paths = {
 skill:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
 rule:'<path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/>',
 memory:'<path d="M8 4a3 3 0 0 0-4 3 4 4 0 0 0-1 7 3 3 0 0 0 4 4c0 3 5 3 5 0V5c0-3-4-3-4-1Zm8 0a3 3 0 0 1 4 3 4 4 0 0 1 1 7 3 3 0 0 1-4 4c0 3-5 3-5 0V5c0-3 4-3 4-1Z"/>',
 mcp:'<path d="M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-6 6v4M7 8V6m10 2V6"/>',
 ledger:'<path d="M4 3v18h17M8 16v-4m5 4V7m5 9v-6"/>',
 cart:'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 9V5a3 3 0 0 1 6 0v4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>'
};
const kinds=[['skill','Skills'],['rule','规则'],['memory','记忆'],['mcp','MCP'],['ledger','账本']];
const $=s=>document.querySelector(s);
function icon(kind){const span=document.createElement('span');span.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.rule}</svg>`;return span.firstChild;}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
let all=[],filtered=[],byId=new Map(),category='skill',mode='after',frame=0,noticeTimer;
const selected=new Set(),nodes=new Map();
const grid=$('#grid'),search=$('#search'),detail=$('#detail'),detailBody=$('#detail-body');
let columns=1,width=0,rowHeight=262;
window.previewStats={filterSamples:[],renderedCards:0,total:0};
for(const [id,label] of kinds){const b=el('button');b.dataset.category=id;b.role='tab';b.title=label;b.setAttribute('aria-label',label);b.append(icon(id));b.onclick=()=>{if(category===id)return;category=id;search.value='';window.scrollTo(0,0);filter();};$('#tabs').append(b);}
$('#open-selection').append(icon('cart'));
function dateText(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'short',day:'numeric'}).format(d);}
function projectText(path){return path.replace(/\\/g,'/').replace(/\/$/,'').split('/').pop();}
function nameOf(a){return mode==='before'?a.beforeTitle:a.title;}
function toggle(id){selected.has(id)?selected.delete(id):selected.add(id);const card=nodes.get(id);if(card)updateSelection(card,id);renderDock();notice(selected.has(id)?'已加入试选清单':'已移出试选清单');}
function updateSelection(card,id){const chosen=selected.has(id);card.querySelector('.card').dataset.selected=chosen;const button=card.querySelector('.add');button.setAttribute('aria-pressed',chosen);button.setAttribute('aria-label',(chosen?'移出 ':'加入 ')+nameOf(byId.get(id)));button.replaceChildren(icon(chosen?'check':'plus'));}
function card(a){const cell=el('div','cell '+a.kind);cell.role='listitem';cell.dataset.id=a.id;const article=el('article','card');
 const open=el('button','card-open');open.setAttribute('aria-label','查看 '+nameOf(a));open.onclick=()=>showDetail(a);article.append(open);
 const top=el('div','card-top'),tile=el('span','tile');tile.append(icon(a.kind));top.append(tile,el('span','origin',a.locationLabel||a.source));article.append(top,el('h2','',nameOf(a)));
 if(a.kind==='skill')article.append(el('p','original',a.originalName));
 if(a.kind==='memory')article.append(el('p','original',a.titleSource));
 const summary=mode==='before'?(a.project?'项目 · 待确认':'个人'):(a.kind==='memory'?(a.project?'项目：'+projectText(a.project):a.summary||'个人记忆'):a.summary);
 article.append(el('p','description',summary));
 const bottom=el('div','card-bottom');bottom.append(el('span','',a.source));if(a.kind==='memory')bottom.append(el('span','',dateText(a.date)));else if(mode!=='before'&&a.kind==='skill')bottom.append(el('span','',a.translation));
 article.append(bottom);const add=el('button','add');add.onclick=()=>toggle(a.id);article.append(add);cell.append(article);updateSelection(cell,a.id);return cell;}
function filter(){const started=performance.now(),q=search.value.trim().toLocaleLowerCase();filtered=all.filter(a=>a.kind===category&&(!q||a.searchText.includes(q)));if(category==='memory')filtered.sort((a,b)=>Number(!!b.threadId)-Number(!!a.threadId)||b.date.localeCompare(a.date));
 $('#heading').textContent=kinds.find(x=>x[0]===category)[1];$('#count').textContent=filtered.length;$('#empty').hidden=!!filtered.length;
 document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-selected',b.dataset.category===category));
 nodes.clear();grid.replaceChildren();renderWindow();window.previewStats.filterSamples.push(performance.now()-started);if(window.previewStats.filterSamples.length>100)window.previewStats.filterSamples.shift();}
function renderWindow(){frame=0;const gap=20;columns=Math.max(1,Math.floor((grid.clientWidth+gap)/(262+gap)));width=(grid.clientWidth-gap*(columns-1))/columns;rowHeight=mode==='before'?216:262;const height=rowHeight-gap;grid.style.height=Math.ceil(filtered.length/columns)*rowHeight+'px';
 const offset=grid.getBoundingClientRect().top+scrollY,top=Math.max(0,scrollY-offset);const start=Math.max(0,Math.floor(top/rowHeight)-2)*columns,end=Math.min(filtered.length,(Math.ceil((top+innerHeight)/rowHeight)+2)*columns);const wanted=new Set();
 for(let i=start;i<end;i++){const a=filtered[i];wanted.add(a.id);let n=nodes.get(a.id);if(!n){n=card(a);nodes.set(a.id,n);grid.append(n);}n.style.width=width+'px';n.style.height=height+'px';n.style.transform=`translate(${(i%columns)*(width+gap)}px,${Math.floor(i/columns)*rowHeight}px)`;n.setAttribute('aria-posinset',i+1);n.setAttribute('aria-setsize',filtered.length);}
 for(const [id,n]of nodes){if(!wanted.has(id)&&!n.contains(document.activeElement)){n.remove();nodes.delete(id);}}
 window.previewStats.renderedCards=nodes.size;window.previewStats.total=filtered.length;}
function schedule(){if(!frame)frame=requestAnimationFrame(renderWindow);}
search.addEventListener('input',filter);addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.body.classList.toggle('before',mode==='before');document.querySelectorAll('[data-mode]').forEach(n=>n.setAttribute('aria-pressed',n===b));filter();});
function renderDock(){$('#selected-count').textContent=selected.size;const box=$('#selected-icons');box.replaceChildren();for(const id of [...selected].slice(0,6)){const tile=el('span','tile');tile.append(icon(byId.get(id).kind));box.append(tile);}}
function notice(text){clearTimeout(noticeTimer);$('#notice').textContent=text;$('#notice').classList.add('show');noticeTimer=setTimeout(()=>$('#notice').classList.remove('show'),1500);}
function showDetail(a){detailBody.replaceChildren();const tile=el('span','tile');tile.append(icon(a.kind));detailBody.append(tile,el('h2','',a.title));if(a.originalName)detailBody.append(el('p','original',a.originalName));
 if(a.kind==='skill'){detailBody.append(el('h3','','中文简介'),el('p','',a.summary));const original=el('details');original.append(el('summary','','原文说明'),el('pre','',a.originalDescription));detailBody.append(original);}else{detailBody.append(el('h3','',a.titleSource),el('p','',a.summary||'暂无文档摘要'));}
 if(a.project)detailBody.append(el('h3','','关联项目'),el('p','path',a.project));detailBody.append(el('h3','','来源位置'),el('p','path',a.path));
 if(a.threadId)detailBody.append(el('h3','','会话标识'),el('p','path',a.threadId));const action=el('button','primary',selected.has(a.id)?'移出试选清单':'加入试选清单');action.onclick=()=>{toggle(a.id);action.textContent=selected.has(a.id)?'移出试选清单':'加入试选清单';};detailBody.append(action);detail.showModal();}
function showSelection(){detailBody.replaceChildren(el('h2','','试选清单'),el('p','','仅用于预览，不修改当前交接包。'));for(const id of selected){const a=byId.get(id),row=el('div','selection-row');row.append(icon(a.kind),el('span','',a.title));const remove=el('button','','移除');remove.onclick=()=>{toggle(id);showSelection();};row.append(remove);detailBody.append(row);}if(!selected.size)detailBody.append(el('p','','从卡片右下角选择资料。'));if(!detail.open)detail.showModal();}
$('#open-selection').onclick=showSelection;$('#selection-bottom').onclick=showSelection;$('#close-detail').onclick=()=>detail.close();detail.addEventListener('click',event=>{if(event.target===detail&&event.offsetX<0)detail.close();});
try{const response=await fetch('/data.json');if(!response.ok)throw Error();const data=await response.json();all=data.items;for(const a of all){a.searchText=[a.title,a.originalName,a.summary,a.beforeTitle,a.project,a.path].join(' ').toLocaleLowerCase();byId.set(a.id,a);}filter();}catch{$('#error').hidden=false;$('#error').textContent='预览资料加载失败，请刷新页面重试。';$('#count').textContent='—';}
