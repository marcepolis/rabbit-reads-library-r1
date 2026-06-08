/* Rabbit Reads normalized-book reader. The maker changes only book.js. */
const BOOK = window.RABBIT_BOOK;
const STORE_PREFIX = "r1-normalized-book-v11:";
const storeKey = STORE_PREFIX + (BOOK.id || BOOK.title || location.pathname);
const el = id => document.getElementById(id);
let state = loadState();
let pages = [];
let currentPage = 0;
let selectedText = "";
let selectedPage = 0;
let pttTimer = null;
let pttCount = 0;
let lastPttAt = 0;
let pttHoldTimer = null;
let holdSaved = false;
let indexEntries = [];

function loadState(){try{return JSON.parse(localStorage.getItem(storeKey))||{}}catch{return{}}}
function saveState(){localStorage.setItem(storeKey,JSON.stringify(state));updateMenuButtons()}
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));el(id).classList.add('active');if(id==='menu')updateMenuButtons()}
function init(){
  state.theme ||= 'dark'; state.fontSize ||= 16; state.fontFamily ||= 'serif';
  el('bookTitle').textContent=BOOK.title||'Untitled Book';
  el('bookAuthor').textContent=BOOK.author||'Unknown author';
  applyTheme(); buildPages(); buildIndexEntries(); bindControls(); renderPage(state.location?.page||0); updateMenuButtons();
}
function charsPerPage(){const fs=Number(state.fontSize||16); return Math.max(520, Math.round(1180-(fs-14)*95));}
function buildPages(){
  pages=[];
  const max=charsPerPage();
  BOOK.chapters.forEach((chapter,chapterIndex)=>{
    const rawBlocks = chapter.blocks && chapter.blocks.length ? chapter.blocks : [{type:'p',text:chapter.text||''}];
    const blocks=[];
    rawBlocks.forEach(block=>{
      splitLongBlock(block,max).forEach(piece=>blocks.push(piece));
    });
    let chunk=[]; let count=0; let offset=0;
    const title=chapter.title||`Chapter ${chapterIndex+1}`;
    const push=()=>{ if(!chunk.length)return; pages.push({chapterIndex,title,blocks:chunk,offset:offset++}); chunk=[]; count=0; };
    chunk.push({type:'meta',text:title});
    blocks.forEach(block=>{
      const text=String(block.text||'').trim(); if(!text)return;
      const blockWeight=text.length + (block.type==='h1'||block.type==='h2'||block.type==='h3'?80:25);
      if(count+blockWeight>max && chunk.length>1) push();
      chunk.push(block); count+=blockWeight;
      if(count>=max) push();
    });
    push();
  });
  if(!pages.length) pages=[{chapterIndex:0,title:'Book',blocks:[{type:'p',text:'No readable text found.'}],offset:0}];
}
function splitLongBlock(block,max){
  const text=String(block.text||'').replace(/\s+/g,' ').trim();
  if(!text)return [];
  const type=block.type||'p';
  if(type==='h1'||type==='h2'||type==='h3'||text.length<=max)return [{...block,text}];
  const limit=Math.max(360,Math.floor(max*0.82));
  const pieces=[];
  let rest=text;
  while(rest.length>limit){
    let cut=-1;
    const sample=rest.slice(0,limit+120);
    const matches=[...sample.matchAll(/[.!?][”"')\]]?\s+[A-Z0-9“"(]/g)];
    if(matches.length){
      const last=matches[matches.length-1];
      if(last.index>240) cut=last.index+1;
    }
    if(cut<0) cut=Math.max(rest.lastIndexOf(' ',limit),rest.lastIndexOf('; ',limit),rest.lastIndexOf(', ',limit));
    if(cut<240) cut=limit;
    pieces.push({type,text:rest.slice(0,cut).trim()});
    rest=rest.slice(cut).trim();
  }
  if(rest)pieces.push({type,text:rest});
  return pieces;
}
function buildIndexEntries(){
  indexEntries=[];
  const seen=new Set();
  pages.forEach((page,pageIndex)=>{
    page.blocks.forEach(block=>{
      const text=String(block.text||'').trim();
      if(!text)return;
      const isHeading = block.type==='h1' || block.type==='h2' || block.type==='h3' || looksLikeChapterTitle(text);
      if(!isHeading)return;
      const key=text.toLowerCase().replace(/\s+/g,' ');
      if(seen.has(key))return;
      seen.add(key);
      indexEntries.push({title:text,page:pageIndex,chapterIndex:page.chapterIndex});
    });
  });
  // If the EPUB was already split into real chapters but has few headings, still include every normalized chapter.
  BOOK.chapters.forEach((ch,i)=>{
    const title=String(ch.title||`Chapter ${i+1}`).trim();
    const key=title.toLowerCase().replace(/\s+/g,' ');
    if(title && !seen.has(key)){
      const page=pages.findIndex(p=>p.chapterIndex===i);
      if(page>=0){seen.add(key);indexEntries.push({title,page,chapterIndex:i})}
    }
  });
  indexEntries.sort((a,b)=>a.page-b.page || a.title.localeCompare(b.title));
}
function looksLikeChapterTitle(text){return text.length<120 && /^(chapter|part|book|section|epilogue|prologue|etymology|extracts)\b|^chapter\s+[ivxlcdm0-9]+\.?/i.test(text)}
function renderPage(n){
  currentPage=Math.max(0,Math.min(pages.length-1,n||0));
  const page=pages[currentPage];
  const entry=[...indexEntries].reverse().find(e=>e.page<=currentPage);
  el('chapterLabel').textContent=entry?.title || page.title;
  el('pageLabel').textContent=`${currentPage+1}/${pages.length}`;
  const viewer=el('viewer');
  viewer.className = `reader-${state.fontFamily||'serif'}`;
  viewer.style.fontSize=(state.fontSize||16)+'px';
  viewer.innerHTML=page.blocks.map(blockToHtml).join('');
  applyHighlightsOnPage();
  state.location={page:currentPage,chapterIndex:page.chapterIndex,offset:page.offset}; saveState();
}
function blockToHtml(b){
  const text=escapeHtml(b.text||'');
  if(b.type==='meta')return `<div class="chapterStart">${text}</div>`;
  if(b.type==='h1')return `<h1>${text}</h1>`;
  if(b.type==='h2')return `<h2>${text}</h2>`;
  if(b.type==='h3')return `<h3>${text}</h3>`;
  return `<p>${text}</p>`;
}
function applyHighlightsOnPage(){
  const notes=(state.notes||[]).filter(n=>n.page===currentPage && n.text);
  if(!notes.length)return;
  const walker=document.createTreeWalker(el('viewer'),NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
  notes.forEach(note=>{
    const needle=note.text.trim(); if(!needle)return;
    for(const node of nodes){
      const i=node.nodeValue.indexOf(needle);
      if(i>=0){
        const range=document.createRange(); range.setStart(node,i); range.setEnd(node,i+needle.length);
        const span=document.createElement('span'); span.className='r1-highlight';
        try{range.surroundContents(span)}catch{}
        break;
      }
    }
  });
}
function nextPage(){renderPage(currentPage+1)}
function prevPage(){renderPage(currentPage-1)}
function startFromBeginning(){show('reader');renderPage(0)}
function continueReading(){if(state.bookmark&&Number.isFinite(state.bookmark.page)){show('reader');renderPage(state.bookmark.page)}else startFromBeginning()}
function openMenu(){show('menu')}
function updateMenuButtons(){
  const hasBookmark=state.bookmark&&Number.isFinite(state.bookmark.page);
  if(el('continueBtn')) el('continueBtn').style.display=hasBookmark?'block':'none';
  if(el('startReading')) el('startReading').textContent=hasBookmark?'Start from the beginning':'Start Reading';
}
function openPanel(type){
  show('panel'); const title=el('panelTitle'); const content=el('panelContent'); content.innerHTML='';
  if(type==='index'){
    title.textContent='Index';
    const entries=indexEntries.length?indexEntries:[{title:'Start',page:0}];
    entries.forEach(entry=>{const item=document.createElement('div');item.className='listItem';item.innerHTML=`${escapeHtml(entry.title)}<small>Page ${entry.page+1}</small>`;item.onclick=()=>{show('reader');renderPage(entry.page)};content.appendChild(item)})
  } else if(type==='notes'){
    title.textContent='Highlights'; const notes=state.notes||[]; if(!notes.length)content.innerHTML='<p>No highlights yet. Select text, then press PTT once.</p>';
    notes.forEach(n=>{const item=document.createElement('div');item.className='listItem';item.innerHTML=`<b>${escapeHtml(n.text)}</b><small>Page ${n.page+1} · ${escapeHtml(n.date)}</small><p>${escapeHtml(n.note||'No note')}</p>`;item.onclick=()=>{show('reader');renderPage(n.page)};content.appendChild(item)})
  } else if(type==='settings'){
    title.textContent='Settings'; content.innerHTML=`<div class="settingRow"><label>Theme</label><select id="themeSelect"><option value="dark">Dark blue</option><option value="light">Light grey</option></select></div><div class="settingRow"><label>Text size</label><select id="sizeSelect"><option value="14">Small</option><option value="16">Medium</option><option value="18">Large</option><option value="20">Extra large</option></select></div><div class="settingRow"><label>Font family</label><select id="fontSelect"><option value="serif">Serif</option><option value="sans">Sans</option><option value="mono">Mono</option></select></div>`;
    el('themeSelect').value=state.theme||'dark';el('sizeSelect').value=String(state.fontSize||16);el('fontSelect').value=state.fontFamily||'serif';
    el('themeSelect').onchange=e=>{state.theme=e.target.value;saveState();applyTheme()};
    el('sizeSelect').onchange=e=>{state.fontSize=Number(e.target.value);saveState();const oldPage=currentPage;buildPages();buildIndexEntries();renderPage(Math.min(oldPage,pages.length-1))};
    el('fontSelect').onchange=e=>{state.fontFamily=e.target.value;saveState();renderPage(currentPage)};
  }
}
function applyTheme(){const app=el('app');app.classList.toggle('theme-light',state.theme==='light');app.classList.toggle('theme-dark',state.theme!=='light')}
function captureSelection(){
  const sel=window.getSelection(); const text=sel ? sel.toString().trim() : '';
  if(text){selectedText=text;selectedPage=currentPage;}
}
function addHighlightAndNote(){
  captureSelection();
  if(!selectedText){flashMessage('Select text first');return;}
  el('selectedPreview').textContent=selectedText; el('noteText').value=''; el('noteModal').classList.remove('hidden'); setTimeout(()=>el('noteText').focus(),80);
}
function saveNote(){
  const note={id:Date.now(),page:selectedPage,text:selectedText,note:el('noteText').value.trim(),date:new Date().toLocaleString()};
  state.notes=state.notes||[]; state.notes.unshift(note); saveState(); el('noteModal').classList.add('hidden'); renderPage(currentPage); flashMessage('Highlight saved');
}
function addBookmark(){state.bookmark={page:currentPage,chapterIndex:pages[currentPage].chapterIndex,date:new Date().toLocaleString()};saveState();flashMessage(`Bookmarked page ${currentPage+1}`);updateMenuButtons()}
function flashMessage(text){let box=document.getElementById('toast');if(!box){box=document.createElement('div');box.id='toast';box.style.cssText='position:fixed;left:18px;right:18px;bottom:18px;padding:9px;border-radius:10px;background:#ff6a3d;color:white;text-align:center;font-size:12px;z-index:99';document.body.appendChild(box)}box.textContent=text;box.hidden=false;clearTimeout(box._timer);box._timer=setTimeout(()=>box.hidden=true,1000)}
function queuePttPress(e){if(e?.preventDefault)e.preventDefault();const now=Date.now();if(now-lastPttAt<120)return;lastPttAt=now;pttCount++;clearTimeout(pttTimer);pttTimer=setTimeout(()=>{const count=pttCount;pttCount=0;if(count===1)addHighlightAndNote();else if(count>=3)openMenu();},520)}
function isHardwareHoldEvent(e){
  if(!e)return true;
  if(e.touches||e.changedTouches||e.pointerType)return false;
  const t=e.target;
  return !t || t===window || t===document || t===document.body || t===el('app');
}
function startPttHold(e){if(!isHardwareHoldEvent(e))return;if(e?.preventDefault)e.preventDefault();holdSaved=false;clearTimeout(pttTimer);pttCount=0;if(pttHoldTimer)return;flashMessage('Keep holding PTT to bookmark');pttHoldTimer=setTimeout(()=>{holdSaved=true;addBookmark();pttHoldTimer=null},3000)}
function endPttHold(e){if(!isHardwareHoldEvent(e))return;if(e?.preventDefault)e.preventDefault();if(pttHoldTimer){clearTimeout(pttHoldTimer);pttHoldTimer=null;if(!holdSaved)flashMessage('Bookmark cancelled')}}
function bindControls(){
  el('continueBtn').onclick=continueReading;el('startReading').onclick=startFromBeginning;el('menuBtn').onclick=openMenu;el('backToMenu').onclick=openMenu;el('cancelNote').onclick=()=>el('noteModal').classList.add('hidden');el('saveNote').onclick=saveNote;
  document.querySelectorAll('[data-panel]').forEach(btn=>btn.onclick=()=>openPanel(btn.dataset.panel));
  window.addEventListener('scrollDown',nextPage);window.addEventListener('scrollUp',prevPage);
  ['pttClick','pttButton','pushToTalk','sideClick'].forEach(n=>window.addEventListener(n,queuePttPress));
  ['pttPressStart','pttDown','pushToTalkStart','sidePressStart','longPressStart'].forEach(n=>window.addEventListener(n,startPttHold));
  ['pttPressEnd','pttUp','pushToTalkEnd','sidePressEnd','longPressEnd'].forEach(n=>window.addEventListener(n,endPttHold));
  el('viewer').addEventListener('mouseup',captureSelection);el('viewer').addEventListener('touchend',()=>setTimeout(captureSelection,80));
  document.addEventListener('selectionchange',()=>{if(el('reader').classList.contains('active'))captureSelection()});
  document.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowRight')nextPage();if(e.key==='ArrowUp'||e.key==='ArrowLeft')prevPage();if(e.key===' '||e.key.toLowerCase()==='p')queuePttPress(e);if(e.key.toLowerCase()==='b')addBookmark();if(e.key==='Escape')openMenu()});
}
function escapeHtml(str){return String(str??'').replace(/[&<>\"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))}
init();
