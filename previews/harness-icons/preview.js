const svg=(body,box='0 0 24 24',extra='')=>`<svg class="icon" viewBox="${box}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
const icons={
 all:svg('<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'),
 search:svg('<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>'),
 folder:svg('<path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>'),
 codex:svg('<path d="M12 3.2 19.6 7.6v8.8L12 20.8l-7.6-4.4V7.6Z"/><path d="m9 10 2.5 2L9 14M13 14.5h2.5"/>'),
 claude:svg('<g stroke-width="2.1"><path d="m12.3 2-.6 20M2.1 11.3l19.8 1.4M4.3 4.2l15.4 15.6M5.2 19.9 18.8 4.1M8.4 3.3l7.2 17.4M3 16.1l18-8.2M2.5 7.1l19 9.8M8.2 21.2l7.6-18.4"/></g>'),
 hermes:'<img class="icon hermes" src="assets/hermes-favicon.svg" alt="" aria-hidden="true">',
 pi:'<svg class="icon pi" viewBox="130 130 540 540" aria-hidden="true"><path fill-rule="evenodd" d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"/><path d="M517.36 400H634.72V634.72H517.36Z"/></svg>',
 bridge:svg('<path d="M5 21V10a9 9 0 0 1 18 0v11M5 15h18"/>','0 0 28 28','style="stroke-width:2.6"'),
};
const names={all:'全部来源',codex:'Codex',claude:'Claude Code',hermes:'Hermes',pi:'Pi',bridge:'SkillBridge'};
document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icons[e.dataset.icon]);
for(const group of document.querySelectorAll('[data-group]')){
 const keys=group.dataset.group==='full'?['all','codex','claude','hermes','pi','bridge']:['all','codex','hermes','bridge'];
 let current=keys.indexOf('hermes');
 group.style.setProperty('--i',current);
 group.innerHTML='<span class="seg-ind" aria-hidden="true"></span>'+keys.map((key,i)=>`<button role="radio" aria-checked="${i===current}" aria-label="${names[key]}" title="${names[key]}" tabindex="${i===current?0:-1}" class="${i===current?'on':''}">${icons[group.dataset.group==='old'&&['hermes','bridge'].includes(key)?'folder':key]}</button>`).join('');
 const buttons=[...group.querySelectorAll('button')];
 const pick=i=>{current=i;group.style.setProperty('--i',i);buttons.forEach((b,j)=>{b.classList.toggle('on',i===j);b.setAttribute('aria-checked',String(i===j));b.tabIndex=i===j?0:-1});document.querySelector('#state').textContent=names[keys[i]]};
 buttons.forEach((b,i)=>{b.onclick=()=>pick(i);b.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(current+1)%keys.length;else if(e.key==='ArrowLeft')next=(current+keys.length-1)%keys.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=keys.length-1;if(next!==undefined){e.preventDefault();pick(next);buttons[next].focus()}}});
}
const captions={codex:'沿用现有图形',claude:'星芒轮廓',hermes:'官方头像',pi:'官方像素字形',bridge:'已有拱桥标识'};
document.querySelector('#legend').innerHTML=['codex','claude','hermes','pi','bridge'].map(k=>`<figure><div class="mark">${icons[k]}</div><figcaption>${names[k]}<small>${captions[k]}</small></figcaption></figure>`).join('');
