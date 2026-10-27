(() => {
  const KEY = 'zhijian-reading-note-v1';
  const sample = {
    title:'老街焕新的新答案',author:'林知夏',source:'城市观察',date:'2025 年 3 月 19 日',
    paragraphs:[
      {text:'踏上青石板路，沿着巷道探访，可见斑驳的老墙与新绘的壁画。西门街片区在静谧与热闹的交织中散发活力，给人看“旧”亦能品“新”之感。',note:'以街区的新旧景象对照开篇，点出历史文脉与当代生活的连接。'},
      {text:'守护建筑原貌，引入现代商业，让旧院落“牵手”新业态。在保护原有建筑风貌的基础上，坚持微改造、精雕琢。',note:'以建筑保护与商业更新并举，说明老街焕新的具体路径。'},
      {text:'发挥政府引导作用，激发社会参与热情，变“单向管理”为“共同治理”。',note:'从政府、居民与商户协作的角度展开治理分析。'},
      {text:'留下原住民，也引入新居民，把沉睡资源变成创业资产。',note:'以新居民创业激活街区资源，呈现持续发展的可能。'},
      {text:'做好传承发展，我们的城市将更富内涵、更具魅力、更有生机。',note:'总结全文并升华主题。'}
    ]
  };
  const $ = (s, root=document) => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const textHtml = v => esc(v).replace(/\r?\n/g, '<br>');
  const fontFamilies=new Set(['FangSongGB2312','KaiTiGB2312','XiaozhangReading','XiaozhangReadingLight','XiaozhangReadingBold','HanChanFangKai']);
  function clean(value='') {
    const doc = new DOMParser().parseFromString(String(value), 'text/html');
    const tags = new Set(['B','STRONG','U','EM','I','S','SPAN','BR','P','DIV','H1','H2','H3','H4','H5','H6','UL','OL','LI','SUB','SUP']);
    const color = /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]{1,20})$/i, length = /^(\d+(\.\d+)?(px|pt|em|rem|%))$/;
    const walk = n => {
      if(n.nodeType===Node.TEXT_NODE)return esc(n.nodeValue);
      if(n.nodeType!==Node.ELEMENT_NODE||['SCRIPT','STYLE','IFRAME','OBJECT'].includes(n.tagName))return '';
      const tag=n.tagName, kids=Array.from(n.childNodes).map(walk).join(''); if(tag==='BR')return '<br>'; if(!tags.has(tag))return kids;
      const styles=[], st=n.style;
      for(const prop of ['color','background-color','text-decoration-color']){const v=st.getPropertyValue(prop);if(color.test(v||''))styles.push(prop+':'+v);}
      for(const prop of ['font-size','text-decoration-thickness','text-underline-offset']){const v=st.getPropertyValue(prop);if(length.test(v))styles.push(prop+':'+v);}
      const family=st.fontFamily.replace(/["']/g,'').trim();if(/^(inherit|FangSongGB2312|KaiTiGB2312|XiaozhangReading|XiaozhangReadingLight|XiaozhangReadingBold|HanChanFangKai)$/.test(family))styles.push('font-family:'+family);
      const dec=st.textDecorationLine||st.textDecoration; if(/^(none|underline|line-through|overline)$/.test(dec))styles.push('text-decoration-line:'+dec);
      if(/^(solid|double|dotted|dashed|wavy)$/.test(st.textDecorationStyle))styles.push('text-decoration-style:'+st.textDecorationStyle);
      if(/^(bold|bolder|[1-9]00)$/.test(st.fontWeight))styles.push('font-weight:'+st.fontWeight);
      if(/^(italic|normal)$/.test(st.fontStyle))styles.push('font-style:'+st.fontStyle);
      const task=tag==='UL'&&n.dataset.task==='true'?' data-task="true"':'', checked=tag==='LI'&&n.dataset.checked==='true'?' data-checked="true"':'';
      const defaultSize=tag==='SPAN'&&n.dataset.defaultSize==='true'?' data-default-size="true"':'';
      return '<'+tag.toLowerCase()+task+checked+defaultSize+(styles.length?' style="'+styles.join(';')+'"':'')+'>'+kids+'</'+tag.toLowerCase()+'>';
    };
    return Array.from(doc.body.childNodes).map(walk).join('');
  }
  function normalize(raw={}) {
    const old=raw.blocks|| (raw.summary?[{title:'本文概要',content:raw.summary}]:[]);
    return {title:raw.title||'',author:raw.author||'',source:raw.source||'',date:raw.date||'',dateHeading:raw.dateHeading??'阅读札记',topic:raw.topic??(raw.source?'主题：'+raw.source:''),masthead:raw.masthead??'纸间读写札记',fontFamily:fontFamilies.has(raw.fontFamily)?raw.fontFamily:'',blocks:old.map(b=>({title:b.title??'新栏目',html:clean(b.html??textHtml(b.content||'')),position:b.position==='bottom'?'bottom':'top'})),paragraphs:(raw.paragraphs?.length?raw.paragraphs:[{}]).map(p=>({html:clean(p.html??textHtml(p.text||'')),noteHtml:clean(p.noteHtml??textHtml(p.note||''))}))};
  }
  const USER_KEY='zhijian-users-v1',SESSION_KEY='zhijian-session-v1',GUEST='guest';
  const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  let session=localStorage.getItem(SESSION_KEY)||GUEST;
  if(session!==GUEST&&!session.startsWith('cloud:')&&!readJson(USER_KEY,[]).some(u=>u.id===session))session=GUEST;
  const documentDefaults={author:'林知夏',source:'城市观察',date:'2025 年 3 月 19 日',dateHeading:'阅读札记',topic:'主题：城市观察',masthead:'纸间读写札记'};
  const newNote=()=>normalize({...documentDefaults,paragraphs:[{}]});
  function guideDocument(){return {id:noteRuntime.uuid(),title:'使用说明 · 从这里开始',folderId:'',kind:'guide',data:normalize({...documentDefaults,title:'使用说明 · 从这里开始',blocks:[{title:'欢迎使用纸间',html:'<p>把原文和自己的思考放在一起，慢慢读，也慢慢写。这份说明可以自由修改，或在文件库中删除。</p>'}],paragraphs:[
    {text:'一、打开文件库\n点击顶部「文件库」，可以新建文件夹、打开已有文件夹，也可以直接新建文档。点击文档名称即可打开，编辑中的内容会自动保存在本机。',note:'可以先新建一个文件夹，例如「阅读笔记」或「查经记录」。文档右侧的「⋯」支持重命名、移动、复制和删除。'},
    {text:'二、开始一份新文档\n点击「模板」可把常用标题、作者、来源、日期、刊头、栏目和内容保存为个人模板。新建时可选择模板，默认模板会自动选中，也可新建空白文档。',note:'模板可重命名、更新或删除，随账号同步。每份新文档是独立副本，不会改变模板。左侧写文段，右侧写分析；点击「添加下一段」继续写。'},
    {text:'三、文字标注与栏目\n字体选择会统一修改整篇文档的显示字体，无需选中文字。字号和其他标注仍可用于选中文字；选择「默认字号」可以恢复大小。列表可以从光标位置插入。',note:'文前栏目适合放背景和提纲，文后栏目适合放总结与思考。栏目名称、位置和顺序都可以调整。'},
    {text:'四、查找经文与导出\n「经文」支持按卷章阅读、用空格分隔关键词搜索、跨章节多选和复制。关闭弹窗会清空多选。',note:'「版面预览」可以切换讲义版、表格版和阅读字号，并导出图片或打印为 PDF。还可以导入 TXT、Markdown 和 HTML 文章。'},
    {text:'五、登录与同步\n登录后，文档和文件夹按账号保存在服务端，并自动同步。未登录时只保存在本机。',note:'网络中断时，修改先保存在本机，重新连接后继续同步。遇到多端冲突可保留两个版本。旧的本机文档可在账号设置中导入，仍建议定期下载备份。'}]})};}
  function blankLibrary(){const old=session===GUEST?readJson(KEY,null):null,guide=guideDocument(),docs=[guide];if(old)docs.push({id:noteRuntime.uuid(),title:old.title||'阅读札记',folderId:'',data:normalize(old)});return {folders:[],documents:docs,activeId:old?docs[1].id:guide.id,guideVersion:1};}
  function normalizeTemplates(lib){
    lib.templates=(Array.isArray(lib.templates)?lib.templates:[]).filter(t=>t&&typeof t.id==='string'&&typeof t.name==='string'&&t.data&&typeof t.data==='object').map(t=>({...t,data:normalize(t.data)}));
    lib.defaultTemplateId=lib.templates.some(t=>t.id===lib.defaultTemplateId)?lib.defaultTemplateId:'';
    return lib;
  }
  function readLibrary(){const key='zhijian-library-v1:'+session,stored=readJson(key,null);const lib=normalizeTemplates(stored?.documents?.length?stored:blankLibrary());if(!lib.guideVersion){lib.documents.push(guideDocument());lib.guideVersion=1;}localStorage.setItem(key,JSON.stringify(lib));return lib;}
  let library=readLibrary(), activeDoc=library.documents.find(d=>d.id===library.activeId)||library.documents[0];library.activeId=activeDoc.id;
  let data=normalize(activeDoc.data);
  let active=null, range=null, layout='handout', timer, toastTimer;
  const fields={titleInput:'title',authorInput:'author',sourceInput:'source',dateInput:'date',dateHeadingInput:'dateHeading',topicInput:'topic',mastheadInput:'masthead'};
  function save(now=false){clearTimeout(timer);const write=()=>{try{activeDoc.data=data;activeDoc.title=data.title||activeDoc.title||'未命名笔记';localStorage.setItem('zhijian-library-v1:'+session,JSON.stringify(library));if(session===GUEST)localStorage.setItem(KEY,JSON.stringify(data));$('#saveText').textContent='已保存到本机';renderLibrary();document.dispatchEvent(new CustomEvent('notesaved',{detail:{session}}));}catch{$('#saveText').textContent='保存失败';toast('本机存储空间不足，修改暂未保存');}};if(now)write();else{$('#saveText').textContent='正在保存…';timer=setTimeout(write,250);}}
  function toast(s){clearTimeout(toastTimer);$('#toast').textContent=s;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2200);}
  function renderLibrary(){document.dispatchEvent(new Event('libraryupdated'));}
  function newDocument(folderId='',templateId=library.defaultTemplateId,title=null){
    save(true);
    const template=library.templates.find(t=>t.id===templateId);
    if(templateId&&!template){toast('这个模板已不存在，请重新选择');return;}
    const content=template?normalize(noteRuntime.clone(template.data)):newNote();
    if(title!==null)content.title=String(title).trim().slice(0,160);
    const doc={id:noteRuntime.uuid(),title:content.title||'未命名笔记',folderId,data:content};
    library.documents.push(doc);openDocument(doc.id);save(true);$('#titleInput').focus();return doc;
  }
  function saveTemplate(name,id='',sourceId=activeDoc.id){
    name=String(name).trim().slice(0,80);if(!name){toast('请填写模板名称');return;}
    save(true);const source=library.documents.find(d=>d.id===sourceId);if(!source){toast('原文档已不存在');return;}
    let template=library.templates.find(t=>t.id===id);
    if(id&&!template){toast('这个模板已不存在');return;}
    if(!template){if(library.templates.length>=1000){toast('模板数量已达上限，请先清理不需要的模板');return;}template={id:noteRuntime.uuid(),name};library.templates.push(template);}
    Object.assign(template,{name,data:normalize(noteRuntime.clone(source.data)),updatedAt:Date.now()});
    save(true);return template;
  }
  function renameTemplate(id,name){const template=library.templates.find(t=>t.id===id);name=String(name).trim().slice(0,80);if(!template||!name)return;Object.assign(template,{name,updatedAt:Date.now()});save(true);}
  function deleteTemplate(id){library.templates=library.templates.filter(t=>t.id!==id);if(library.defaultTemplateId===id)library.defaultTemplateId='';save(true);}
  function setDefaultTemplate(id){if(id&&!library.templates.some(t=>t.id===id))return;library.defaultTemplateId=id;save(true);}
  function openDocument(id){const doc=library.documents.find(x=>x.id===id);if(!doc)return;save(true);activeDoc=doc;library.activeId=id;data=normalize(doc.data);render();save(true);}
  function switchUser(id){save(true);session=id;localStorage.setItem(SESSION_KEY,id);library=readLibrary();activeDoc=library.documents.find(d=>d.id===library.activeId)||library.documents[0];library.activeId=activeDoc.id;data=normalize(activeDoc.data);render();save(true);}
  function replaceLibrary(next){clearTimeout(timer);library=normalizeTemplates(noteRuntime.clone(next));library.documents=library.documents.map(d=>({...d,data:normalize(d.data)}));activeDoc=library.documents.find(d=>d.id===library.activeId)||library.documents[0];library.activeId=activeDoc.id;data=normalize(activeDoc.data);render();save(true);}
  window.noteApp={replaceLibrary,getState:()=>({session,library,activeDoc,data}),save:()=>save(true),newDocument,requestNewDocument:newDocument,saveTemplate,renameTemplate,deleteTemplate,setDefaultTemplate,openDocument,switchUser,toast,normalize,updateLibrary:()=>save(true)};
  function drawBlocks(){for(const pos of ['top','bottom']){const group=data.blocks.map((b,i)=>({b,i})).filter(x=>x.b.position===pos);$('#'+pos+'BlockEditors').innerHTML=group.map((x,n)=>'<section class="block-editor" data-block-index="'+x.i+'"><div class="block-editor-head"><input class="block-title-input" data-block-field="title" value="'+esc(x.b.title)+'" aria-label="栏目名称" placeholder="栏目名称"><select class="block-position" data-block-field="position" aria-label="栏目位置"><option value="top" '+(pos==='top'?'selected':'')+'>文前</option><option value="bottom" '+(pos==='bottom'?'selected':'')+'>文后</option></select><button class="small-icon-btn" data-action="up" '+(!n?'disabled':'')+' aria-label="上移栏目">↑</button><button class="small-icon-btn" data-action="down" '+(n===group.length-1?'disabled':'')+' aria-label="下移栏目">↓</button><button class="small-icon-btn" data-action="block-delete" aria-label="删除栏目">×</button></div><div class="rich-editor block-content-input" contenteditable="true" data-block-field="html" data-placeholder="写下'+(pos==='bottom'?'总结、收获或延伸思考':'概要、背景或要点')+'…" role="textbox" aria-multiline="true" aria-label="'+esc(x.b.title)+' 内容">'+x.b.html+'</div></section>').join('');}}
  function paper(){applyDocumentFont();const blocks=pos=>data.blocks.filter(b=>b.position===pos).map(b=>'<section class="paper-custom-block '+(pos==='bottom'?'bottom-block':'')+'"><h2>'+esc(b.title)+'</h2><div>'+b.html+'</div></section>').join('');const rows=data.paragraphs.map(p=>'<section class="content-pair"><div class="content-pair-main"><div class="paper-paragraph">'+p.html+'</div></div><div class="content-pair-note"><div class="paper-note-copy">'+p.noteHtml+'</div></div></section>').join('');let head;if(layout==='table')head='<header class="paper-table-header"><h1 class="paper-table-title">'+esc(data.title||'未命名笔记')+'</h1><div class="paper-table-meta"><span>作者：'+esc(data.author)+'</span><span>来源：'+esc(data.source)+'</span><span>'+esc(data.date)+'</span></div></header>';else head='<header class="paper-header"><div class="paper-date">'+esc(data.date||'日期未填写')+'<strong>'+esc(data.dateHeading)+'</strong>'+esc(data.topic)+'</div><div class="paper-title-wrap"><h1 class="paper-title">'+esc(data.title||'未命名笔记')+'</h1><div class="paper-byline"><span>作者：'+esc(data.author||'未填写')+'</span><span>来源：'+esc(data.source||'未填写')+'</span></div></div><div class="paper-brand">'+esc(data.masthead)+'</div></header>';const bottom=blocks('bottom');$('#paper').classList.toggle('table-layout',layout==='table');$('#paper').innerHTML=head+blocks('top')+'<div class="paper-columns-head"><span>文段</span><span>分析</span></div><div class="paper-content-pairs">'+rows+'</div>'+(bottom?'<section class="paper-endnotes" aria-label="文末总结与补充">'+bottom+'</section>':'');}
  function render(){active=null;range=null;syncToolbar();$('#fontSizePicker').value='';Object.entries(fields).forEach(([id,key])=>$('#'+id).value=data[key]||'');$('#panelCount').textContent='共 '+data.paragraphs.length+' 段';$('#articleList').innerHTML=data.paragraphs.map((p,i)=>'<article class="edit-pair" data-index="'+i+'"><section class="edit-cell"><div class="paragraph-top"><span class="para-number">文段 '+String(i+1).padStart(2,'0')+'</span><button class="delete-para" data-action="delete" aria-label="删除第 '+(i+1)+' 段">×</button></div><div class="rich-editor paragraph-text" contenteditable="true" data-field="html" data-placeholder="写下这一段正文…" role="textbox" aria-multiline="true" aria-label="第 '+(i+1)+' 段正文">'+p.html+'</div></section><section class="edit-cell"><div class="paragraph-top"><span class="para-number">对应分析 '+String(i+1).padStart(2,'0')+'</span></div><div class="rich-editor annotation-text" contenteditable="true" data-field="noteHtml" data-placeholder="写下这一段的分析、思考或批注…" role="textbox" aria-multiline="true" aria-label="第 '+(i+1)+' 段分析">'+p.noteHtml+'</div></section></article>').join('');drawBlocks();paper();}
  function selectionElements(r,editor){
    if(r.collapsed){
      let node=r.startContainer;
      if(node.nodeType===Node.ELEMENT_NODE)node=node.childNodes[r.startOffset]||node.childNodes[r.startOffset-1]||node;
      return [node.nodeType===Node.ELEMENT_NODE?node:node.parentElement];
    }
    const elements=[],walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(!node.length||!r.intersectsNode(node))continue;
      const start=node===r.startContainer?r.startOffset:0,end=node===r.endContainer?r.endOffset:node.length;
      if(start<end)elements.push(node.parentElement);
    }
    return elements.length?elements:[r.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?r.commonAncestorContainer:r.commonAncestorContainer.parentElement];
  }
  function explicitSize(element,editor){
    for(let node=element;node&&node!==editor;node=node.parentElement){
      if(node.dataset.defaultSize==='true')return '';
      if(node.style.fontSize)return String(parseFloat(getComputedStyle(element).fontSize));
    }
    return '';
  }
  function syncToolbar(){
    // Native select controls keep their own focus while an option is being chosen.
    if(document.activeElement?.closest('.rich-toolbar'))return;
    const elements=active?.isConnected&&range?selectionElements(range,active):[];
    const uniform=values=>new Set(values).size===1?values[0]:'mixed';
    const types=elements.map(el=>{const block=el.closest('h1,h2,h3,h4,h5,h6');return block&&active.contains(block)?block.tagName.toLowerCase():'p';});
    $('#textTypePicker').value=elements.length?uniform(types):'p';
    const size=elements.length?uniform(elements.map(el=>explicitSize(el,active))):'',picker=$('#fontSizePicker');
    picker.querySelector('[data-current-size]')?.remove();
    if(size&&size!=='mixed'&&!Array.from(picker.options).some(option=>option.value===size)){
      const option=new Option(size,size);option.dataset.currentSize='true';picker.append(option);
    }
    picker.value=size;
    for(const command of ['bold','italic']){
      const states=elements.map(el=>{const css=getComputedStyle(el);return command==='bold'?(Number(css.fontWeight)>=600||css.fontWeight==='bold'):css.fontStyle!=='normal';});
      $('[data-format="'+command+'"]').setAttribute('aria-pressed',states.length?String(uniform(states)):'false');
    }
    $('#formatHint').textContent=elements.length?'正在编辑：'+active.getAttribute('aria-label'):'选中文字即可标注 · 正文和分析均适用';
  }
  function remember(){const sel=getSelection();if(!sel?.rangeCount)return;const n=sel.anchorNode?.nodeType===1?sel.anchorNode:sel.anchorNode?.parentElement,e=n?.closest('.rich-editor');if(e&&e.contains(sel.focusNode)){active=e;range=sel.getRangeAt(0).cloneRange();syncToolbar();}}
  function preserveBeforeToolbarAction(e){if(!e.target.closest('.rich-toolbar'))return;remember();if(e.type==='mousedown'&&e.target.closest('.rich-toolbar button,.rich-toolbar summary'))e.preventDefault();}
  function restore(){if(!active?.isConnected||!range||!active.contains(range.commonAncestorContainer)){toast('先在正文、分析或栏目中选中文字');return false;}const editor=active,saved=range.cloneRange();editor.focus({preventScroll:true});const sel=getSelection();sel.removeAllRanges();sel.addRange(saved);active=editor;range=saved.cloneRange();return true;}
  function commit(){active?.dispatchEvent(new InputEvent('input',{bubbles:true}));remember();}
  function format(cmd,val=null){if(!restore())return;document.execCommand('styleWithCSS',false,true);document.execCommand(cmd,false,val);commit();}
  function textType(tag){if(!/^(p|h[1-6])$/.test(tag)||!restore())return;document.execCommand('formatBlock',false,tag);commit();}
  function applyDocumentFont(){const root=document.documentElement;root.toggleAttribute('data-document-font',!!data.fontFamily);if(data.fontFamily)root.style.setProperty('--document-font',data.fontFamily+', var(--font-reading)');else root.style.removeProperty('--document-font');$('#fontFamilyPicker').value=data.fontFamily;}
  function selectTextOffsets(editor,start,length){
    const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let offset=0,first,last;
    while(walker.nextNode()){
      const node=walker.currentNode,end=offset+node.length;
      if(!first&&start<end)first=[node,Math.max(0,start-offset)];
      if(start+length<=end){last=[node,start+length-offset];break;}
      offset=end;
    }
    if(first&&last){const selected=document.createRange();selected.setStart(...first);selected.setEnd(...last);const selection=getSelection();selection.removeAllRanges();selection.addRange(selected);}
  }
  function style(css,attributes={}){
    if(!restore())return;
    const sel=getSelection(),r=sel.getRangeAt(0);if(r.collapsed){toast('请先选中要标注的文字');return;}
    const prefix=r.cloneRange();prefix.selectNodeContents(active);prefix.setEnd(r.startContainer,r.startOffset);
    const start=prefix.toString().length,length=r.toString().length;
    const frag=r.cloneContents(),w=document.createTreeWalker(frag,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);
    nodes.forEach(n=>{if(n.textContent){const span=document.createElement('span');Object.assign(span.style,css);Object.entries(attributes).forEach(([k,v])=>span.setAttribute(k,v));n.replaceWith(span);span.append(n);}});
    const box=document.createElement('div');box.append(frag);document.execCommand('insertHTML',false,box.innerHTML);
    if(length)selectTextOffsets(active,start,length);
    commit();
  }
  function decorateLine(color='#b73530',lineStyle='solid'){
    style({textDecorationLine:'underline',textDecorationStyle:lineStyle,textDecorationColor:color,textDecorationThickness:'2px',textUnderlineOffset:'4px'});
  }
  function adjustFontSize(direction){
    if(!restore())return;
    const sizes=Array.from($('#fontSizePicker').options).map(o=>Number(o.value)).filter(n=>n>=10&&n<=72).sort((a,b)=>a-b);
    const element=selectionElements(range,active)[0],current=parseFloat(getComputedStyle(element).fontSize);
    const next=direction>0?sizes.find(n=>n>current)||72:[...sizes].reverse().find(n=>n<current)||10;
    style({fontSize:next+'px'});
  }
  function insertList(kind){
    if(!restore())return;
    const sel=getSelection(),r=sel.getRangeAt(0);
    if(!r.collapsed){document.execCommand(kind==='ordered'?'insertOrderedList':'insertUnorderedList');if(kind==='task'){const ul=sel.anchorNode?.parentElement?.closest('ul');if(ul)ul.dataset.task='true';}commit();return;}
    const startElement=r.startContainer.nodeType===Node.ELEMENT_NODE?r.startContainer:r.startContainer.parentElement;
    const currentItem=startElement?.closest('li');
    if(currentItem&&active.contains(currentItem)){
      const currentList=currentItem.closest('ul,ol');
      if(currentList&&(kind==='ordered')===(currentList.tagName==='OL')){
        const tailRange=r.cloneRange();tailRange.selectNodeContents(currentItem);tailRange.setStart(r.startContainer,r.startOffset);
        const tail=tailRange.extractContents(),nextItem=document.createElement('li');
        if(tail.textContent.trim()||tail.querySelector('*'))nextItem.append(tail);else nextItem.append(document.createElement('br'));
        currentList.insertBefore(nextItem,currentItem.nextSibling);
        const next=document.createRange();next.selectNodeContents(nextItem);next.collapse(true);sel.removeAllRanges();sel.addRange(next);commit();return;
      }
    }
    const list=document.createElement(kind==='ordered'?'ol':'ul');
    if(kind==='task')list.dataset.task='true';
    const item=document.createElement('li');item.append(document.createElement('br'));list.append(item);
    const beforeRange=r.cloneRange();beforeRange.selectNodeContents(active);beforeRange.setEnd(r.startContainer,r.startOffset);
    const afterRange=r.cloneRange();afterRange.selectNodeContents(active);afterRange.setStart(r.startContainer,r.startOffset);
    const before=beforeRange.cloneContents(),after=afterRange.cloneContents();
    const hasContent=frag=>frag.textContent.trim()||frag.querySelector('*');
    active.replaceChildren();
    if(hasContent(before)){const block=document.createElement('div');block.append(before);active.append(block);}
    active.append(list);
    if(hasContent(after)){const block=document.createElement('div');block.append(after);active.append(block);}
    const next=document.createRange();next.selectNodeContents(item);next.collapse(true);sel.removeAllRanges();sel.addRange(next);commit();
  }
  function closeMenus(except=null){document.querySelectorAll('.tool-menu[open]').forEach(m=>{if(m!==except)m.open=false;});}
  document.querySelectorAll('.tool-menu').forEach(menu=>{menu.setAttribute('name','editor-tools');menu.addEventListener('toggle',()=>{if(menu.open)closeMenus(menu);});});
  const colors=['#111827','#374151','#6b7280','#9ca3af','#d1d5db','#e5e7eb','#f3f4f6','#ffffff','#7f1d1d','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5','#fecaca','#fee2e2','#7c2d12','#c2410c','#ea580c','#f97316','#fb923c','#fdba74','#fed7aa','#ffedd5','#713f12','#a16207','#ca8a04','#eab308','#facc15','#fde047','#fef08a','#fef9c3','#14532d','#15803d','#16a34a','#22c55e','#4ade80','#86efac','#bbf7d0','#dcfce7','#1e3a8a','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#581c87','#7e22ce','#9333ea','#a855f7','#c084fc','#d8b4fe','#e9d5ff','#f3e8ff','#831843','#be185d','#db2777','#ec4899','#f472b6','#f9a8d4','#fbcfe8','#fce7f3'];
  for(const menu of document.querySelectorAll('[data-palette]')){const kind=menu.dataset.palette,colors3=['#b73530','#2563eb','#15803d'];$('.tool-popover',menu).innerHTML='<p class="popover-label">'+({text:'文字颜色',highlight:'文字高亮',underline:'下划线颜色 · 加粗实线',wave:'波浪线颜色 · 加粗波浪线'}[kind])+'</p><button class="popover-option" data-clear="'+kind+'">'+(kind==='text'?'恢复默认文字颜色':kind==='highlight'?'移除高亮':'移除下划线 / 波浪线')+'</button>'+(['wave','underline'].includes(kind)?'<div class="preset-lines">'+colors3.map((c,i)=>'<button data-kind="'+kind+'" data-color="'+c+'"><span class="line-preview '+(kind==='wave'?'wavy':'')+'" style="--line-color:'+c+'">'+['红色','蓝色','绿色'][i]+'</span></button>').join('')+'</div>':'')+'<div class="palette-grid">'+colors.map(c=>'<button class="swatch" style="--swatch:'+c+'" data-kind="'+kind+'" data-color="'+c+'" aria-label="'+kind+' '+c+'"></button>').join('')+'</div><div class="custom-color"><label>自选颜色</label><input type="color" value="'+(kind==='highlight'?'#fef08a':'#b73530')+'"><button class="format-btn" data-apply="'+kind+'">应用</button></div>';}
  function addBlock(pos){data.blocks.push({title:pos==='bottom'?'总结与思考':'新栏目',html:'',position:pos});render();save();const input=$('[data-block-index="'+(data.blocks.length-1)+'"] .block-title-input');input?.focus();input?.select();}
  function addParagraph(){data.paragraphs.push({html:'',noteHtml:''});render();save();$('.edit-pair:last-child .paragraph-text').focus();}
  document.addEventListener('input',e=>{const t=e.target;let changed=false;if(fields[t.id]){data[fields[t.id]]=t.value;changed=true;}if(t.matches('[data-field]')){data.paragraphs[+t.closest('[data-index]').dataset.index][t.dataset.field]=clean(t.innerHTML);changed=true;}const wrap=t.closest('[data-block-index]');if(wrap&&t.dataset.blockField&&t.dataset.blockField!=='position'){data.blocks[+wrap.dataset.blockIndex][t.dataset.blockField]=t.isContentEditable?clean(t.innerHTML):t.value;changed=true;}if(changed){paper();save();}});
  document.addEventListener('focusin',e=>{if(e.target.matches('.rich-editor')){active=e.target;remember();}});document.addEventListener('selectionchange',remember);document.addEventListener('pointerdown',preserveBeforeToolbarAction,true);document.addEventListener('mousedown',preserveBeforeToolbarAction,true);
  document.addEventListener('change',e=>{if(e.target.matches('[data-block-field="position"]')){data.blocks[+e.target.closest('[data-block-index]').dataset.blockIndex].position=e.target.value;render();save();}if(e.target.id==='fontSizePicker'){if(e.target.value)style({fontSize:e.target.value+'px'});else style({}, {'data-default-size':'true'});}if(e.target.id==='fontFamilyPicker'){data.fontFamily=fontFamilies.has(e.target.value)?e.target.value:'';applyDocumentFont();save();}if(e.target.id==='textTypePicker')textType(e.target.value);});
  document.addEventListener('click',e=>{const t=e.target,menuSummary=t.closest('.tool-menu > summary');if(menuSummary)closeMenus(menuSummary.parentElement);const fmt=t.closest('[data-format]'),kind=t.closest('[data-kind]'),apply=t.closest('[data-apply]'),clear=t.closest('[data-clear]'),list=t.closest('[data-list]'),add=t.closest('[data-add-block]'),action=t.closest('[data-action]');if(fmt)format(fmt.dataset.format);if(kind){const k=kind.dataset.kind,c=kind.dataset.color;if(k==='text')format('foreColor',c);else if(k==='highlight')format('hiliteColor',c);else decorateLine(c,k==='wave'?'wavy':'solid');closeMenus();}if(apply){const input=$('input[type=color]',apply.parentElement);const k=apply.dataset.apply;if(k==='text')format('foreColor',input.value);else if(k==='highlight')format('hiliteColor',input.value);else decorateLine(input.value,k==='wave'?'wavy':'solid');closeMenus();}if(clear){const k=clear.dataset.clear;if(k==='text')format('foreColor','#30383e');else if(k==='highlight')format('hiliteColor','transparent');else style({textDecorationLine:'none'});closeMenus();}if(list){insertList(list.dataset.list);closeMenus();}if(add)addBlock(add.dataset.addBlock);if(action){const k=action.dataset.action;if(k==='delete'){const i=+action.closest('[data-index]').dataset.index;if(data.paragraphs.length===1){toast('至少保留一个文段');return;}if(!confirm('删除文段和对应分析？'))return;data.paragraphs.splice(i,1);}else{const bi=+action.closest('[data-block-index]').dataset.blockIndex;if(k==='block-delete'){if(!confirm('删除这个栏目？'))return;data.blocks.splice(bi,1);}else{const group=data.blocks.map((b,n)=>b.position===data.blocks[bi].position?n:-1).filter(n=>n>=0),at=group.indexOf(bi),to=group[at+(k==='up'?-1:1)];if(to===undefined)return;[data.blocks[bi],data.blocks[to]]=[data.blocks[to],data.blocks[bi]];}}render();save();}const view=t.closest('[data-view]');if(view){document.body.classList.toggle('preview-mode',view.dataset.view==='preview');document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===view));closeMenus();}const mode=t.closest('[data-layout]');if(mode){layout=mode.dataset.layout;document.querySelectorAll('[data-layout]').forEach(b=>b.classList.toggle('active',b===mode));paper();}if(!t.closest('.tool-menu'))closeMenus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});
  window.noteEditor={remember,format,textType,insertList,adjustFontSize,underline:()=>decorateLine(),wave:()=>decorateLine('#b73530','wavy'),resetSize:()=>style({}, {'data-default-size':'true'})};
  $('#addBtn').addEventListener('click',addParagraph);$('#addBottom').addEventListener('click',addParagraph);$('#printBtn').addEventListener('click',()=>{document.body.classList.add('preview-mode');window.print();});$('#printPreviewBtn').addEventListener('click',()=>window.print());
  $('#newBtn').addEventListener('click',()=>window.noteApp.requestNewDocument(activeDoc.folderId));$('#resetBtn').addEventListener('click',()=>{if(!confirm('恢复示例内容？当前笔记会被替换。'))return;data=normalize(sample);render();save();toast('已恢复示例内容');});
  $('#importBtn').addEventListener('click',()=>$('#importFile').click());$('#importFile').addEventListener('change',async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      const ext=f.name.split('.').pop().toLowerCase(),txt=await f.text();let ps;
      if(['html','htm'].includes(ext)){
        const doc=new DOMParser().parseFromString(txt,'text/html');
        const elements=Array.from(doc.querySelectorAll('p'));
        if(!elements.length)elements.push(...doc.body.children);
        ps=elements.map(p=>({html:clean(p.outerHTML),noteHtml:''})).filter(p=>p.html);
        if(!ps.length&&doc.body.textContent.trim())ps=[{html:textHtml(doc.body.textContent.trim()),noteHtml:''}];
      }else ps=txt.replace(/\r/g,'').split(/\n\s*\n+/).map(x=>({html:textHtml(x.trim()),noteHtml:''})).filter(p=>p.html);
      if(!ps.length){toast('文件中没有可导入正文');return;}
      if(!confirm('导入文章将替换正文和栏目，是否继续？'))return;
      data={...data,title:f.name.replace(/\.[^.]+$/,''),paragraphs:ps,blocks:[]};render();save();toast('已导入 '+ps.length+' 个文段');
    }catch{toast('文件读取失败，请使用 TXT、Markdown 或 HTML 文件');}
    finally{e.target.value='';}
  });
  window.addEventListener('pagehide',()=>save(true));render();
})();
