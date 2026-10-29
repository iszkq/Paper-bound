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
      if(n.hasAttribute('data-format-boundary'))return '';
      if(tag==='DIV'&&n.hasAttribute('data-format-operation'))return kids;
      const styles=[], st=n.style;
      for(const prop of ['color','background-color','text-decoration-color']){const v=st.getPropertyValue(prop);if(color.test(v||''))styles.push(prop+':'+v);}
      for(const prop of ['font-size','text-decoration-thickness','text-underline-offset']){const v=st.getPropertyValue(prop);if(length.test(v))styles.push(prop+':'+v);}
      const family=st.fontFamily.replace(/["']/g,'').trim();if(/^(inherit|FangSongGB2312|KaiTiGB2312|XiaozhangReading|XiaozhangReadingLight|XiaozhangReadingBold|HanChanFangKai)$/.test(family))styles.push('font-family:'+family);
      const dec=st.textDecorationLine||st.textDecoration; if(/^(none|(?:underline|line-through|overline)(?:\s+(?:underline|line-through|overline)){0,2})$/.test(dec))styles.push('text-decoration-line:'+dec);
      if(/^(solid|double|dotted|dashed|wavy)$/.test(st.textDecorationStyle))styles.push('text-decoration-style:'+st.textDecorationStyle);
      if(/^(bold|bolder|[1-9]00)$/.test(st.fontWeight))styles.push('font-weight:'+st.fontWeight);
      if(/^(italic|normal)$/.test(st.fontStyle))styles.push('font-style:'+st.fontStyle);
      if(/^(baseline|sub|super)$/.test(st.verticalAlign))styles.push('vertical-align:'+st.verticalAlign);
      const task=tag==='UL'&&n.dataset.task==='true'?' data-task="true"':'', checked=tag==='LI'&&n.dataset.checked==='true'?' data-checked="true"':'';
      const defaultSize=tag==='SPAN'&&n.dataset.defaultSize==='true'?' data-default-size="true"':'';
      const firstIndent=/^(P|DIV)$/.test(tag)&&/^(on|off)$/.test(n.dataset.firstIndent||'')?' data-first-indent="'+n.dataset.firstIndent+'"':'';
      const number=tag==='OL'?'start':tag==='LI'?'value':'',rawNumber=number&&n.getAttribute(number);
      const numbering=rawNumber&&/^-?\d{1,9}$/.test(rawNumber)?' '+number+'="'+Number(rawNumber)+'"':'';
      return '<'+tag.toLowerCase()+task+checked+defaultSize+firstIndent+numbering+(styles.length?' style="'+styles.join(';')+'"':'')+'>'+kids+'</'+tag.toLowerCase()+'>';
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
    {text:'二、开始一份新文档\n点击「模板」可把常用标题、作者、来源、日期、刊头、栏目和内容保存为个人模板。新建时可搜索并选择模板，默认模板会自动选中，也可新建空白文档。',note:'模板可重命名、更新或删除，随账号同步。每份新文档是独立副本，不会改变模板。左侧写文段，右侧写分析；点击「添加下一段」继续写。'},
    {text:'三、文字标注与栏目\n字体选择会统一修改整篇文档的显示字体，无需选中文字。字号和其他标注仍可用于选中文字；选择「默认字号」可以恢复大小。光标所在段落可用列表按钮转换；也可在行首输入「1.」后按空格创建有序列表。',note:'列表按 Enter 继续，Tab 增加一级缩进，Shift+Tab 退一级，一级时取消列表，光标在文字中间也可用。Shift+Enter 插入不编号的说明；选择「普通文本」可直接退出列表。正文独立段落在预览中首行缩进两字符，可用工具栏「首行缩进」按段关闭或恢复。选中来源文字后，单击格式刷刷一次，双击连续刷，Esc 退出。文前栏目适合放背景和提纲，文后栏目适合放总结与思考。栏目名称、位置和顺序都可以调整。'},
    {text:'四、查找经文与导出\n「经文」支持按卷章阅读、用空格分隔关键词搜索、跨章节多选和复制。关闭弹窗会清空多选。',note:'「版面预览」可以切换讲义版、表格版和阅读字号，并导出图片或打印为 PDF。长文图片会自动分页，每张重复标题和顶部信息，正文连续排下去。还可以导入 Word（.docx）、TXT、Markdown 和 HTML 文章。'},
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
  let active=null, range=null, painter=null, layout='handout', timer, saveLimit, toastTimer;
  let savePending=false,lastSavedAt=0,saveError='',savedKey='',savedContent='';
  const fields={titleInput:'title',authorInput:'author',sourceInput:'source',dateInput:'date',dateHeadingInput:'dateHeading',topicInput:'topic',mastheadInput:'masthead'};
  function save(now=false){
    clearTimeout(timer);
    const write=()=>{
      clearTimeout(timer);clearTimeout(saveLimit);saveLimit=null;
      try{
        activeDoc.data=data;activeDoc.title=data.title||activeDoc.title||'未命名笔记';
        const key='zhijian-library-v1:'+session,value=JSON.stringify(library);
        if(savedKey===key&&savedContent===value&&!saveError&&localStorage.getItem(key)===value){
          const wasPending=savePending;savePending=false;
          if(wasPending)document.dispatchEvent(new CustomEvent('notesaved',{detail:{session}}));return true;
        }
        localStorage.setItem(key,value);if(session===GUEST)localStorage.setItem(KEY,JSON.stringify(data));
        savedKey=key;savedContent=value;lastSavedAt=Date.now();savePending=false;saveError='';
        renderLibrary();document.dispatchEvent(new CustomEvent('notesaved',{detail:{session}}));return true;
      }catch{
        const message='本机存储空间不足，修改暂未保存。请立即下载备份。';
        if(!saveError)toast(message);saveError=message;savePending=true;
        document.dispatchEvent(new Event('notesaveerror'));return false;
      }
    };
    if(now)return write();
    savePending=true;document.dispatchEvent(new CustomEvent('notesavepending',{detail:{session}}));
    timer=setTimeout(write,800);if(!saveLimit)saveLimit=setTimeout(write,5000);
  }
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
  window.noteApp={replaceLibrary,getState:()=>({session,library,activeDoc,data}),getSaveState:()=>({pending:savePending,lastSavedAt,error:saveError}),save:()=>save(true),newDocument,requestNewDocument:newDocument,saveTemplate,renameTemplate,deleteTemplate,setDefaultTemplate,openDocument,switchUser,toast,normalize,parseArticle,importArticle,updateLibrary:()=>save(true)};
  function drawBlocks(){for(const pos of ['top','bottom']){const group=data.blocks.map((b,i)=>({b,i})).filter(x=>x.b.position===pos);$('#'+pos+'BlockEditors').innerHTML=group.map((x,n)=>'<section class="block-editor" data-block-index="'+x.i+'"><div class="block-editor-head"><input class="block-title-input" data-block-field="title" value="'+esc(x.b.title)+'" aria-label="栏目名称" placeholder="栏目名称"><select class="block-position" data-block-field="position" aria-label="栏目位置"><option value="top" '+(pos==='top'?'selected':'')+'>文前</option><option value="bottom" '+(pos==='bottom'?'selected':'')+'>文后</option></select><button class="small-icon-btn" data-action="up" '+(!n?'disabled':'')+' aria-label="上移栏目">↑</button><button class="small-icon-btn" data-action="down" '+(n===group.length-1?'disabled':'')+' aria-label="下移栏目">↓</button><button class="small-icon-btn" data-action="block-delete" aria-label="删除栏目">×</button></div><div class="rich-editor block-content-input" contenteditable="true" data-block-field="html" data-placeholder="写下'+(pos==='bottom'?'总结、收获或延伸思考':'概要、背景或要点')+'…" role="textbox" aria-multiline="true" aria-label="'+esc(x.b.title)+' 内容">'+x.b.html+'</div></section>').join('');}}
  function previewParagraphs(html){
    const root=document.createElement('div');root.innerHTML=html;
    function paragraphs(container){
      const output=document.createDocumentFragment();let paragraph=null;
      const flush=()=>{if(paragraph){output.append(paragraph);paragraph=null;}};
      for(const node of Array.from(container.childNodes)){
        if(node.nodeType===Node.ELEMENT_NODE&&/^(P|DIV|H[1-6]|OL|UL)$/.test(node.tagName)){
          flush();if(node.tagName==='DIV')paragraphs(node);output.append(node);
        }else if(node.nodeType===Node.ELEMENT_NODE&&node.tagName==='BR'){if(paragraph)flush();else output.append(node);}
        else {if(!paragraph&&node.nodeType===Node.TEXT_NODE&&!node.textContent.trim()){output.append(node);continue;}if(!paragraph)paragraph=document.createElement('p');paragraph.append(node);}
      }
      flush();container.replaceChildren(output);
    }
    paragraphs(root);return root.innerHTML;
  }
  function paper(){applyDocumentFont();const blocks=pos=>data.blocks.filter(b=>b.position===pos).map(b=>'<section class="paper-custom-block '+(pos==='bottom'?'bottom-block':'')+'"><h2>'+esc(b.title)+'</h2><div>'+b.html+'</div></section>').join('');const rows=data.paragraphs.map(p=>'<section class="content-pair"><div class="content-pair-main"><div class="paper-paragraph">'+previewParagraphs(p.html)+'</div></div><div class="content-pair-note"><div class="paper-note-copy">'+p.noteHtml+'</div></div></section>').join('');let head;if(layout==='table')head='<header class="paper-table-header"><h1 class="paper-table-title">'+esc(data.title||'未命名笔记')+'</h1><div class="paper-table-meta"><span>作者：'+esc(data.author)+'</span><span>来源：'+esc(data.source)+'</span><span>'+esc(data.date)+'</span></div></header>';else head='<header class="paper-header"><div class="paper-date">'+esc(data.date||'日期未填写')+'<strong>'+esc(data.dateHeading)+'</strong>'+esc(data.topic)+'</div><div class="paper-title-wrap"><h1 class="paper-title">'+esc(data.title||'未命名笔记')+'</h1><div class="paper-byline"><span>作者：'+esc(data.author||'未填写')+'</span><span>来源：'+esc(data.source||'未填写')+'</span></div></div><div class="paper-brand">'+esc(data.masthead)+'</div></header>';const bottom=blocks('bottom');$('#paper').classList.toggle('table-layout',layout==='table');$('#paper').innerHTML=head+blocks('top')+'<div class="paper-columns-head"><span>文段</span><span>分析</span></div><div class="paper-content-pairs">'+rows+'</div>'+(bottom?'<section class="paper-endnotes" aria-label="文末总结与补充">'+bottom+'</section>':'');}
  function render(){if(painter)stopPainter();active=null;range=null;syncToolbar();$('#fontSizePicker').value='';Object.entries(fields).forEach(([id,key])=>$('#'+id).value=data[key]||'');$('#panelCount').textContent='共 '+data.paragraphs.length+' 段';$('#articleList').innerHTML=data.paragraphs.map((p,i)=>'<article class="edit-pair" data-index="'+i+'"><section class="edit-cell"><div class="paragraph-top"><span class="para-number">文段 '+String(i+1).padStart(2,'0')+'</span><div class="para-controls"><button class="small-icon-btn paragraph-insert" data-add-paragraph-after="'+i+'" title="在此文段下方插入文段" aria-label="在文段 '+(i+1)+' 下方插入文段">＋</button><button class="small-icon-btn paragraph-drag" draggable="true" title="拖动文段和对应分析到指定位置" aria-label="拖动第 '+(i+1)+' 段"><svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></button><button class="small-icon-btn" data-para-move="up" aria-label="上移第 '+(i+1)+' 段" '+(i===0?'disabled':'')+'>↑</button><button class="small-icon-btn" data-para-move="down" aria-label="下移第 '+(i+1)+' 段" '+(i===data.paragraphs.length-1?'disabled':'')+'>↓</button><button class="delete-para" data-action="delete" aria-label="删除第 '+(i+1)+' 段">×</button></div></div><div class="rich-editor paragraph-text" contenteditable="true" data-field="html" data-placeholder="写下这一段正文…" role="textbox" aria-multiline="true" aria-label="第 '+(i+1)+' 段正文">'+p.html+'</div></section><section class="edit-cell"><div class="paragraph-top"><span class="para-number">对应分析 '+String(i+1).padStart(2,'0')+'</span></div><div class="rich-editor annotation-text" contenteditable="true" data-field="noteHtml" data-placeholder="写下这一段的分析、思考或批注…" role="textbox" aria-multiline="true" aria-label="第 '+(i+1)+' 段分析">'+p.noteHtml+'</div></section></article>').join('');drawBlocks();paper();}
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
  function paragraphIndentEnabled(element,editor){
    const setting=element.closest('[data-first-indent]');
    return setting&&editor.contains(setting)?setting.dataset.firstIndent==='on':editor.matches('.paragraph-text');
  }
  function paragraphIndentTargets(editor,selection){
    const targets=[];
    const add=(node,offset=0)=>{
      const element=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
      if(element.closest('li,h1,h2,h3,h4,h5,h6,[data-format-boundary]'))return;
      let block=element;
      while(block!==editor&&(!block.matches('p,div')||block.hasAttribute('data-format-operation')))block=block.parentElement;
      const line=document.createRange();
      if(block!==editor&&!block.querySelector('p,div,ol,ul,h1,h2,h3,h4,h5,h6'))line.selectNodeContents(block);
      else {block=null;const caret=document.createRange();caret.setStart(node,offset);caret.collapse(true);const paragraph=currentParagraphRange(editor,caret);line.setStart(paragraph.startContainer,paragraph.startOffset);line.setEnd(paragraph.endContainer,paragraph.endOffset);}
      if(targets.some(target=>target.line.compareBoundaryPoints(Range.START_TO_START,line)===0&&target.line.compareBoundaryPoints(Range.END_TO_END,line)===0))return;
      targets.push({block,line,enabled:paragraphIndentEnabled(element,editor)});
    };
    if(selection.collapsed)add(selection.startContainer,selection.startOffset);
    else {
      for(const {node,start} of selectionTextSegments(editor,selection))add(node,start);
      // Include empty selected paragraphs, but exclude a paragraph touched only
      // by the end boundary (for example Shift+Down to its first character).
      for(const block of editor.querySelectorAll('p,div')){
        if(block.textContent||block.querySelector('p,div,ol,ul,h1,h2,h3,h4,h5,h6')||block.hasAttribute('data-format-operation'))continue;
        const box=document.createRange();box.selectNode(block);
        if(selection.compareBoundaryPoints(Range.END_TO_START,box)<0&&selection.compareBoundaryPoints(Range.START_TO_END,box)>0)add(block);
      }
    }
    return targets.sort((a,b)=>a.line.compareBoundaryPoints(Range.START_TO_START,b.line));
  }
  function syncToolbar(){
    if(painter){$('#formatHint').textContent=painter.locked?'格式刷已锁定：可连续刷选文字 · Esc 退出':'格式刷：刷选目标文字，单击可刷一个词 · Esc 取消';return;}
    // Native select controls keep their own focus while an option is being chosen.
    if(document.activeElement?.closest('.rich-toolbar'))return;
    const elements=active?.isConnected&&range?selectionElements(range,active):[];
    const indent=$('#paragraphIndent'),targets=elements.length?paragraphIndentTargets(active,range):[],states=new Set(targets.map(target=>target.enabled));
    indent.disabled=!targets.length;
    indent.setAttribute('aria-pressed',states.size>1?'mixed':String(states.has(true)));
    const uniform=values=>new Set(values).size===1?values[0]:'mixed';
    const item=active&&range?currentListItem():null,outdent=$('[data-list-action="outdent"]');
    outdent.disabled=!item;outdent.textContent=item?.parentElement.parentElement.closest('ol,ul')?'退回上一级 · Shift+Tab':item?'取消列表 · Shift+Tab':'退一级 / 取消列表 · Shift+Tab';
    outdent.title='光标放在列表项任意位置即可使用；子列表退一级，一级列表取消编号，保留文字标注';
    const types=elements.map(el=>{const block=el.closest('h1,h2,h3,h4,h5,h6');return block&&active.contains(block)?block.tagName.toLowerCase():el.closest('li')?'list':'p';});
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
  function textType(tag){if(!/^(p|h[1-6])$/.test(tag)||!restore())return;if(tag==='p'&&currentListItem()){unwrapListItem(currentListItem());return;}document.execCommand('formatBlock',false,tag);commit();}
  function toggleParagraphIndent(){
    if(!restore())return;const r=getSelection().getRangeAt(0),targets=paragraphIndentTargets(active,r);if(!targets.length)return;
    // A mixed selection first becomes uniformly indented; the next click clears
    // it uniformly. Never toggle individual paragraphs in opposite directions.
    const enabled=!targets.every(target=>target.enabled),{start,length}=selectionOffsets(active,r),clone=active.cloneNode(true);
    const map=node=>{const path=[];for(let current=node;current!==active;current=current.parentNode)path.unshift(Array.prototype.indexOf.call(current.parentNode.childNodes,current));return path.reduce((parent,index)=>parent.childNodes[index],clone);};
    const mapped=targets.map(target=>{const line=document.createRange();line.setStart(map(target.line.startContainer),target.line.startOffset);line.setEnd(map(target.line.endContainer),target.line.endOffset);return {block:target.block?map(target.block):null,line};});
    let marker=null;
    if(r.collapsed){const at=document.createRange();at.setStart(map(r.startContainer),r.startOffset);at.collapse(true);marker=document.createElement('span');marker.dataset.listCaret='true';at.insertNode(marker);}
    for(const target of mapped.reverse()){
      let block=target.block;
      if(!block){
        const contents=target.line.extractContents();block=document.createElement('p');block.append(contents);target.line.insertNode(block);
        // The paragraph replaces the old line separators. Lift it out of inline
        // annotations, copying those marks inside so the HTML stays valid.
        if(block.previousSibling?.nodeName==='BR')block.previousSibling.remove();
        if(block.nextSibling?.nodeName==='BR')block.nextSibling.remove();
        while(block.parentElement!==clone&&!block.parentElement.matches('p,div,li')){
          const parent=block.parentElement,after=parent.cloneNode(false),mark=parent.cloneNode(false);
          while(block.nextSibling)after.append(block.nextSibling);
          mark.append(...block.childNodes);block.append(mark);parent.after(block);
          if(after.hasChildNodes())block.after(after);if(!parent.hasChildNodes())parent.remove();
        }
      }
      block.dataset.firstIndent=enabled?'on':'off';
    }
    replaceEditorContents(clone,start,length,marker);
  }
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
  function selectionOffsets(editor,r){const prefix=r.cloneRange();prefix.selectNodeContents(editor);prefix.setEnd(r.startContainer,r.startOffset);return {start:prefix.toString().length,length:r.toString().length};}
  function normalizeColor(color){const probe=document.createElement('span');probe.style.color=color;document.body.append(probe);const value=getComputedStyle(probe).color;probe.remove();return value;}
  function selectionTextSegments(editor,r){const segments=[],walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(node.length&&r.intersectsNode(node)){const start=node===r.startContainer?r.startOffset:0,end=node===r.endContainer?r.endOffset:node.length;if(start<end)segments.push({node,start,end});}}return segments;}
  function selectionHasFormat(matches){if(!restore())return null;const r=getSelection().getRangeAt(0);if(r.collapsed){toast('请先选中要标注的文字');return null;}const segments=selectionTextSegments(active,r);return !!segments.length&&segments.every(({node})=>{for(let el=node.parentElement;el&&active.contains(el);el=el.parentElement)if(matches(el))return true;return false;});}
  function style(css,attributes={}){
    if(!restore())return;
    const sel=getSelection(),r=sel.getRangeAt(0);if(r.collapsed){toast('请先选中要标注的文字');return;}
    const {start,length}=selectionOffsets(active,r),clone=active.cloneNode(true),walker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    let offset=0;
    for(const node of nodes){
      const size=node.length,from=Math.max(0,Math.min(size,start-offset)),to=Math.max(from,Math.min(size,start+length-offset));offset+=size;if(from===to)continue;
      const fragment=document.createDocumentFragment();if(from)fragment.append(document.createTextNode(node.data.slice(0,from)));
      const span=document.createElement('span');Object.assign(span.style,css);Object.entries(attributes).forEach(([k,v])=>span.setAttribute(k,v));span.textContent=node.data.slice(from,to);fragment.append(span);if(to<size)fragment.append(document.createTextNode(node.data.slice(to)));node.replaceWith(fragment);
    }
    replaceEditorContents(clone,start,length);
  }
  function decorateLine(color='#b73530',lineStyle='solid',toggle=false){
    const matches=el=>{const css=getComputedStyle(el);return css.textDecorationLine.split(/\s+/).includes('underline')&&css.textDecorationStyle===lineStyle;};
    const toggleOff=selectionHasFormat(matches);if(toggleOff===null)return;
    if(toggle&&toggleOff){clearLineMarks(lineStyle);return true;}
    style({textDecorationLine:'underline',textDecorationStyle:lineStyle,textDecorationColor:color,textDecorationThickness:'2px',textUnderlineOffset:'4px'});return false;
  }
  function toggleHighlight(color='#fef08a'){
    const target=normalizeColor(color),matches=el=>getComputedStyle(el).backgroundColor===target;
    const toggleOff=selectionHasFormat(matches);if(toggleOff===null)return;format('hiliteColor',toggleOff?'transparent':color);
  }
  function clearLineMarks(lineStyle){
    if(!['solid','wavy'].includes(lineStyle))return;
    if(!restore())return;const r=getSelection().getRangeAt(0);if(r.collapsed){toast('请先选中要清除标注的文字');return;}
    const {start,length}=selectionOffsets(active,r),affected=new Map();
    for(const {node} of selectionTextSegments(active,r))for(let el=node.parentElement;el&&el!==active;el=el.parentElement){
      const css=getComputedStyle(el);if(css.textDecorationLine.split(/\s+/).includes('underline')&&css.textDecorationStyle===lineStyle)affected.set(el,{textDecorationLine:css.textDecorationLine,textDecorationStyle:css.textDecorationStyle,textDecorationColor:css.textDecorationColor,textDecorationThickness:css.textDecorationThickness,textUnderlineOffset:css.textUnderlineOffset});
    }
    if(!affected.size)return;
    // Split annotations at selection boundaries. A child with decoration:none
    // cannot cancel a line painted by an ancestor; clear matching ancestors only.
    const clone=active.cloneNode(true),originals=Array.from(active.querySelectorAll('*')),copies=Array.from(clone.querySelectorAll('*'));
    originals.forEach((el,index)=>{if(!affected.has(el))return;const copy=copies[index],css=affected.get(el),remaining=css.textDecorationLine.split(/\s+/).filter(line=>line!=='underline');copy.style.removeProperty('text-decoration');Object.assign(copy.style,css,{textDecorationLine:remaining.join(' ')||'none'});});
    const originalWalker=document.createTreeWalker(active,NodeFilter.SHOW_TEXT),cloneWalker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT),pairs=[];
    while(originalWalker.nextNode()&&cloneWalker.nextNode())pairs.push([originalWalker.currentNode,cloneWalker.currentNode]);
    let offset=0;
    for(const [node,copy] of pairs){
      const annotations=[];for(let el=node.parentElement;el&&el!==active;el=el.parentElement)if(affected.has(el))annotations.push(affected.get(el));
      const size=node.length,from=Math.max(0,Math.min(size,start-offset)),to=Math.max(from,Math.min(size,start+length-offset));offset+=size;if(!annotations.length||!size)continue;
      const fragment=document.createDocumentFragment();
      for(const [a,b,selected] of [[0,from,false],[from,to,true],[to,size,false]]){if(a===b)continue;let content=document.createTextNode(node.data.slice(a,b));if(!selected)for(const css of annotations){const span=document.createElement('span');Object.assign(span.style,css,{textDecorationLine:'underline'});span.append(content);content=span;}fragment.append(content);}
      copy.replaceWith(fragment);
    }
    replaceEditorContents(clone,start,length);
  }
  function replaceEditorContents(clone,start,length,caretMarker=null){
    clone.querySelectorAll('[data-format-operation]').forEach(el=>el.replaceWith(...el.childNodes));
    clone.querySelectorAll('[data-format-boundary]').forEach(el=>el.remove());
    // Start outside any list. Chromium otherwise keeps its first LI around the
    // replacement; removing that shell by hand breaks the native undo history.
    const boundary=document.createElement('p');boundary.dataset.formatBoundary='true';boundary.append(document.createElement('br'));active.prepend(boundary);
    const selection=getSelection(),whole=document.createRange();whole.selectNodeContents(active);selection.removeAllRanges();selection.addRange(whole);
    // Chromium normalizes nested decorations during insertHTML. Insert an undoable
    // container first, then populate it to preserve untouched annotations exactly.
    document.execCommand('insertHTML',false,'<div data-format-operation="true">&#8203;</div>');
    const operation=active.querySelector('[data-format-operation]');
    if(operation){
      operation.replaceChildren(...clone.childNodes);
    }
    if(caretMarker?.isConnected){
      const caret=document.createRange();caret.setStartBefore(caretMarker);caret.collapse(true);caretMarker.remove();selection.removeAllRanges();selection.addRange(caret);
    }else if(length)selectTextOffsets(active,start,length);else setTextCaret(active,start);
    commit();
  }
  function characterFormat(element,editor){
    const css=getComputedStyle(element),lines=[];let background='',size='',vertical='',defaultSize=false;
    for(let el=element;el&&el!==editor;el=el.parentElement){
      const st=getComputedStyle(el);
      if(!background&&st.backgroundColor!=='transparent'&&st.backgroundColor!=='rgba(0, 0, 0, 0)')background=st.backgroundColor;
      if(!size&&!defaultSize){if(el.dataset.defaultSize==='true')defaultSize=true;else if(el.style.fontSize)size=css.fontSize;}
      if(!vertical&&['sub','super'].includes(st.verticalAlign)){vertical=st.verticalAlign;if(!size&&!defaultSize)size=css.fontSize;}
      if(st.textDecorationLine!=='none')lines.push({textDecorationLine:st.textDecorationLine,textDecorationStyle:st.textDecorationStyle,textDecorationColor:st.textDecorationColor,textDecorationThickness:st.textDecorationThickness,textUnderlineOffset:st.textUnderlineOffset});
    }
    return {css:{color:css.color,fontWeight:css.fontWeight,fontStyle:css.fontStyle,...(size?{fontSize:size}:{}),...(background?{backgroundColor:background}:{}),...(vertical?{verticalAlign:vertical}:{})},lines,defaultSize};
  }
  function setPainter(locked=false){
    if(!restore())return;
    const element=selectionElements(range,active)[0],snapshot=characterFormat(element,active);
    // A heading's size is part of its visible character formatting.
    if(!snapshot.css.fontSize&&!snapshot.defaultSize&&element.closest('h1,h2,h3,h4,h5,h6'))snapshot.css.fontSize=getComputedStyle(element).fontSize;
    if(!snapshot.css.fontSize)snapshot.defaultSize=true;
    painter={snapshot,locked};document.body.classList.add('format-painter-active');
    $('#formatPainter').setAttribute('aria-pressed','true');$('#formatPainter').dataset.locked=String(locked);syncToolbar();
    toast(locked?'连续格式刷已开启，按 Esc 退出':'已复制文字格式，请刷选目标文字');
  }
  function stopPainter(){
    painter=null;document.body.classList.remove('format-painter-active');
    $('#formatPainter').setAttribute('aria-pressed','false');delete $('#formatPainter').dataset.locked;syncToolbar();
  }
  function applyPainter(expandWord=false){
    if(!painter||!restore())return;
    const r=getSelection().getRangeAt(0);
    if(r.collapsed&&expandWord){
      let node=r.startContainer,at=r.startOffset;
      if(node.nodeType!==Node.TEXT_NODE){node=node.childNodes[at]||node.childNodes[at-1];if(node?.nodeType!==Node.TEXT_NODE)return;at=0;}
      const words=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter('zh',{granularity:'word'}).segment(node.data)):Array.from(node.data.matchAll(/[\p{L}\p{N}]+/gu),match=>({segment:match[0],index:match.index,isWordLike:true})),word=words.find(part=>part.isWordLike&&at>=part.index&&at<part.index+part.segment.length);
      if(!word)return;r.setStart(node,word.index);r.setEnd(node,word.index+word.segment.length);
    }
    if(r.collapsed)return;
    const {start,length}=selectionOffsets(active,r),clone=active.cloneNode(true),originalWalker=document.createTreeWalker(active,NodeFilter.SHOW_TEXT),copyWalker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT),pairs=[];
    while(originalWalker.nextNode()&&copyWalker.nextNode())pairs.push({node:originalWalker.currentNode,copy:copyWalker.currentNode,format:characterFormat(originalWalker.currentNode.parentElement,active)});
    // Decorations on an ancestor cannot be cancelled by a child. Normalize the
    // inline tree, then restore each untouched run and replace the selected runs.
    for(const el of Array.from(clone.querySelectorAll('*')).reverse()){
      if(/^(B|STRONG|U|EM|I|S|SPAN|SUB|SUP)$/.test(el.tagName))el.replaceWith(...el.childNodes);
      else el.removeAttribute('style');
    }
    function formatted(text,snapshot){
      const span=document.createElement('span');Object.assign(span.style,snapshot.css);if(snapshot.defaultSize)span.dataset.defaultSize='true';span.textContent=text;
      let content=span;for(const line of snapshot.lines){const wrapper=document.createElement('span');Object.assign(wrapper.style,line);wrapper.append(content);content=wrapper;}return content;
    }
    let offset=0;
    for(const {node,copy,format} of pairs){
      const end=offset+node.length,from=Math.max(0,Math.min(node.length,start-offset)),to=Math.max(from,Math.min(node.length,start+length-offset)),fragment=document.createDocumentFragment();
      for(const [a,b,selected] of [[0,from,false],[from,to,true],[to,node.length,false]])if(a<b)fragment.append(formatted(node.data.slice(a,b),selected?painter.snapshot:format));
      copy.replaceWith(fragment);offset=end;
    }
    const locked=painter.locked;replaceEditorContents(clone,start,length);if(!locked)stopPainter();
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
    // List commands operate on the current paragraph (or selected paragraphs),
    // never on an empty item inserted between the two halves of a sentence.
    const sel=getSelection(),r=sel.getRangeAt(0),before=currentListItem(),previous=before?.parentElement;
    if(before){
      if((kind==='ordered'&&previous.tagName==='OL')||(kind==='unordered'&&previous.tagName==='UL'&&!previous.dataset.task)||(kind==='task'&&previous.tagName==='UL'&&previous.dataset.task==='true'))unwrapListItem(before);
      else replaceListKind(previous,kind);
      commit();return;
    }else{
      if(r.collapsed&&!before){convertCurrentParagraph(kind);commit();return;}
      document.execCommand(kind==='ordered'?'insertOrderedList':'insertUnorderedList');
      const list=currentListItem()?.parentElement;
      if(kind==='task'&&list?.tagName==='UL')list.dataset.task='true';
    }
    commit();
  }
  function setTextCaret(editor,offset){
    const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let node,last,remaining=Math.max(0,offset);
    while(walker.nextNode()){
      node=walker.currentNode;last=node;
      if(remaining<=node.length){const r=document.createRange();r.setStart(node,remaining);r.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);return;}
      remaining-=node.length;
    }
    const r=document.createRange();if(last)r.setStart(last,last.length);else r.selectNodeContents(editor);r.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);
  }
  function replaceListKind(previous,kind){
    const list=document.createElement(kind==='ordered'?'ol':'ul');
    if(kind==='ordered'&&previous.tagName==='OL'&&previous.hasAttribute('start'))list.start=previous.start;
    if(kind==='task')list.dataset.task='true';
    while(previous.firstChild)list.append(previous.firstChild);
    previous.replaceWith(list);
  }
  function unwrapListItem(item){
    const r=getSelection().getRangeAt(0),{start,length}=selectionOffsets(active,r),clone=active.cloneNode(true);
    const originalList=item.parentElement,index=Array.from(originalList.children).indexOf(item),copy=clone.querySelectorAll('li')[Array.from(active.querySelectorAll('li')).indexOf(item)],list=copy.parentElement;
    let marker=null;
    if(r.collapsed){
      const path=[];for(let node=r.startContainer;node!==active;node=node.parentNode)path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes,node));
      const node=path.reduce((parent,index)=>parent.childNodes[index],clone),caret=document.createRange();caret.setStart(node,r.startOffset);caret.collapse(true);marker=document.createElement('span');marker.dataset.listCaret='true';caret.insertNode(marker);
    }
    normalizeNestedLists(clone);
    let nextNumber=originalList.tagName==='OL'?originalList.start:1;
    for(const sibling of Array.from(originalList.children).slice(0,index+1)){if(sibling.hasAttribute('value'))nextNumber=sibling.value;nextNumber++;}
    const tail=list.cloneNode(false);while(copy.nextSibling)tail.append(copy.nextSibling);
    if(tail.tagName==='OL')tail.start=nextNumber;
    const content=document.createDocumentFragment();let paragraph=document.createElement('p');
    const flush=()=>{if(paragraph.hasChildNodes()){content.append(paragraph);paragraph=document.createElement('p');}};
    for(const child of Array.from(copy.childNodes)){
      if(child.nodeType===Node.ELEMENT_NODE&&/^(OL|UL)$/.test(child.tagName)){flush();content.append(child);}
      else if(child.nodeType===Node.ELEMENT_NODE&&/^(P|DIV|H[1-6])$/.test(child.tagName)){flush();const p=document.createElement('p');p.append(...child.childNodes);content.append(p);}
      else paragraph.append(child);
    }
    flush();if(!content.hasChildNodes()){paragraph.append(document.createElement('br'));content.append(paragraph);}
    if(tail.hasChildNodes())content.append(tail);
    const first=content.firstChild,last=content.lastChild;
    list.after(content);copy.remove();if(!list.children.length)list.remove();
    // Ordinary text must leave every LI ancestor, even when it started in a
    // third-level item. Keep preceding content and following numbers in order.
    let firstBlock=first,lastBlock=last;
    while(firstBlock.parentElement.closest('li')){
      const parentItem=firstBlock.parentElement.closest('li'),parentList=parentItem.parentElement,following=parentList.cloneNode(false);
      let number=parentList.tagName==='OL'?parentList.start:1;
      for(const sibling of Array.from(parentList.children)){if(sibling.hasAttribute('value'))number=sibling.value;number++;if(sibling===parentItem)break;}
      if(following.tagName==='OL')following.start=number;
      while(parentItem.nextSibling)following.append(parentItem.nextSibling);
      const after=document.createRange();after.selectNodeContents(parentItem);after.setStartAfter(lastBlock);const rest=after.extractContents(),lifted=document.createDocumentFragment();
      let node=firstBlock;while(node){const next=node.nextSibling;lifted.append(node);if(node===lastBlock)break;node=next;}
      // Any ordinary trailing text of the parent becomes an ordinary paragraph.
      let p=null;
      for(const child of Array.from(rest.childNodes)){
        if(child.nodeType===Node.ELEMENT_NODE&&/^(P|DIV|H[1-6]|OL|UL)$/.test(child.tagName)){p=null;lifted.append(child);}
        else {if(!p){p=document.createElement('p');lifted.append(p);}p.append(child);}
      }
      if(following.hasChildNodes())lifted.append(following);
      lastBlock=lifted.lastChild;parentList.after(lifted);
      if(!parentItem.textContent&&!parentItem.querySelector('li'))parentItem.remove();
      if(!parentList.children.length)parentList.remove();
    }
    replaceEditorContents(clone,start,length,marker);
  }
  function currentParagraphRange(editor,caret){
    const element=caret.startContainer.nodeType===Node.ELEMENT_NODE?caret.startContainer:caret.startContainer.parentElement;
    let scope=element;
    while(scope!==editor&&(!scope.matches('p,div,h1,h2,h3,h4,h5,h6,li')||scope.hasAttribute('data-format-operation')))scope=scope.parentElement;
    const line=document.createRange();line.selectNodeContents(scope);
    let previous=null,next=null;
    for(const boundary of scope.querySelectorAll('br,p,div,h1,h2,h3,h4,h5,h6,ol,ul')){
      if(boundary.hasAttribute('data-format-operation'))continue;
      const candidate=document.createRange();candidate.selectNode(boundary);
      const position=candidate.comparePoint(caret.startContainer,caret.startOffset);
      if(position===1&&(!previous||candidate.compareBoundaryPoints(Range.END_TO_END,previous)>0))previous=candidate;
      if(position===-1&&(!next||candidate.compareBoundaryPoints(Range.START_TO_START,next)<0))next=candidate;
    }
    if(previous)line.setStart(previous.endContainer,previous.endOffset);
    if(next)line.setEnd(next.startContainer,next.startOffset);
    return line;
  }
  function convertCurrentParagraph(kind,start=1,removeMarker=null){
    const sel=getSelection(),r=sel.getRangeAt(0),{start:caretOffset}=selectionOffsets(active,r),node=r.startContainer,clone=active.cloneNode(true);
    const pathTo=target=>{const path=[];for(let current=target;current!==active;current=current.parentNode)path.unshift(Array.prototype.indexOf.call(current.parentNode.childNodes,current));return path;};
    const followPath=(root,path)=>path.reduce((parent,index)=>parent.childNodes[index],root),mappedNode=followPath(clone,pathTo(node)),mappedRange=document.createRange();
    mappedRange.setStart(mappedNode,Math.min(r.startOffset,mappedNode.nodeType===Node.TEXT_NODE?mappedNode.length:mappedNode.childNodes.length));mappedRange.collapse(true);
    if(removeMarker){
      const remove=document.createRange();remove.setStart(followPath(clone,pathTo(removeMarker.startContainer)),removeMarker.startOffset);remove.setEnd(followPath(clone,pathTo(removeMarker.endContainer)),removeMarker.endOffset);
      remove.deleteContents();mappedRange.setStart(remove.startContainer,remove.startOffset);mappedRange.collapse(true);
    }
    // A DOM marker preserves an empty item's position, which has no text offset.
    const caretMarker=document.createElement('span');caretMarker.dataset.listCaret='true';mappedRange.insertNode(caretMarker);
    const element=caretMarker.parentElement,block=element?.closest('p,h1,h2,h3,h4,h5,h6');
    const candidate=block&&clone.contains(block)?block:null;
    let list, item;
    if(candidate){
      list=document.createElement(kind==='ordered'?'ol':'ul');item=document.createElement('li');
      while(candidate.firstChild)item.append(candidate.firstChild);
      if(!item.textContent&&!item.querySelector('br'))item.append(document.createElement('br'));
      list.append(item);candidate.replaceWith(list);
    }else{
      const markerRange=document.createRange();markerRange.setStartBefore(caretMarker);markerRange.collapse(true);
      const line=currentParagraphRange(clone,markerRange);
      const contents=line.extractContents();list=document.createElement(kind==='ordered'?'ol':'ul');item=document.createElement('li');
      item.append(contents);if(!item.textContent&&!item.querySelector('br'))item.append(document.createElement('br'));
      list.append(item);line.insertNode(list);
    }
    if(kind==='ordered'&&start!==1)list.start=start;
    if(kind==='task')list.dataset.task='true';
    replaceEditorContents(clone,caretOffset,0,caretMarker);
  }
  function currentListItem(){
    const selection=getSelection();if(!selection?.rangeCount)return null;
    const node=selection.anchorNode,element=node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement,item=element?.closest('li');
    return item&&active?.contains(item)?item:null;
  }
  function changeListDepth(outdent=false){
    if(!restore())return;const item=currentListItem();if(!item)return;
    if(outdent&&!item.parentElement.parentElement.closest('ol,ul')){unwrapListItem(item);return;}
    if(outdent||item.previousElementSibling?.matches('li')){
      const r=getSelection().getRangeAt(0),{start,length}=selectionOffsets(active,r),clone=active.cloneNode(true),copy=clone.querySelectorAll('li')[Array.from(active.querySelectorAll('li')).indexOf(item)];
      let marker=null;
      if(r.collapsed){
        const path=[];for(let node=r.startContainer;node!==active;node=node.parentNode)path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes,node));
        const at=document.createRange();at.setStart(path.reduce((parent,index)=>parent.childNodes[index],clone),r.startOffset);at.collapse(true);marker=document.createElement('span');marker.dataset.listCaret='true';at.insertNode(marker);
      }
      normalizeNestedLists(clone);
      if(!outdent){
        const previous=copy.previousElementSibling,list=copy.parentElement;
        let nested=previous.lastElementChild;
        if(!nested||nested.tagName!==list.tagName||nested.dataset.task!==list.dataset.task){nested=list.cloneNode(false);nested.removeAttribute('start');previous.append(nested);}
        nested.append(copy);replaceEditorContents(clone,start,length,marker);return;
      }
      const inner=copy.parentElement,parent=inner.parentElement.closest('li'),outer=parent.parentElement,tail=inner.cloneNode(false);
      let nextNumber=inner.tagName==='OL'?inner.start:1;
      for(const sibling of Array.from(inner.children)){if(sibling.hasAttribute('value'))nextNumber=sibling.value;nextNumber++;if(sibling===copy)break;}
      if(tail.tagName==='OL')tail.start=nextNumber;
      while(copy.nextSibling)tail.append(copy.nextSibling);
      if(tail.hasChildNodes())copy.append(tail);
      // Following text belongs after the promoted item, rather than moving
      // ahead of it as Chromium's native outdent sometimes does.
      while(inner.nextSibling)copy.append(inner.nextSibling);
      outer.insertBefore(copy,parent.nextSibling);if(!inner.children.length)inner.remove();
      if(!parent.textContent&&!parent.querySelector('li'))parent.remove();
      replaceEditorContents(clone,start,length,marker);return;
    }
  }
  function normalizeNestedLists(editor){
    for(const list of editor.querySelectorAll('ol,ul'))if(list.parentElement.matches('ol,ul')&&list.previousElementSibling?.matches('li'))list.previousElementSibling.append(list);
  }
  function listLineBreak(){if(restore()){document.execCommand('insertLineBreak');commit();}}
  function autoOrderedList(event){
    if(event.defaultPrevented||event.isComposing||event.inputType!=='insertText'||event.data!==' '||!event.target.matches('.rich-editor'))return;
    const editor=event.target,selection=getSelection();if(!selection?.rangeCount||!selection.isCollapsed)return;
    const r=selection.getRangeAt(0);if(!editor.contains(r.commonAncestorContainer))return;
    const element=r.startContainer.nodeType===Node.ELEMENT_NODE?r.startContainer:r.startContainer.parentElement;
    const line=currentParagraphRange(editor,r);line.setEnd(r.startContainer,r.startOffset);
    // A legacy paragraph can contain BR-separated lines, so match only the
    // current logical line and refuse markers typed in the middle of prose.
    const fragment=line.cloneContents();fragment.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));
    const prefix=fragment.textContent,marker=prefix.split('\n').pop();if(!/^[1-9]\d{0,8}\.$/.test(marker))return;
    if(element.closest('li')&&prefix!==marker)return;
    event.preventDefault();active=editor;remember();
    const start=Number(marker.slice(0,-1));
    const item=currentListItem();
    // Select just the typed marker, preserving the remainder of this paragraph.
    const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    let node=r.startContainer,offset=r.startOffset,remaining=marker.length;
    if(node.nodeType!==Node.TEXT_NODE){node=node.childNodes[offset-1];while(node?.lastChild)node=node.lastChild;offset=node?.textContent.length||0;}
    let index=nodes.indexOf(node);if(index<0)return;
    while(remaining>offset&&index>0){remaining-=offset;node=nodes[--index];offset=node.length;}
    const remove=r.cloneRange();remove.setStart(node,offset-remaining);
    if(item?.isConnected&&item.parentElement.tagName==='OL'){
      selection.removeAllRanges();selection.addRange(remove);document.execCommand('delete');item.value=start;
    }else convertCurrentParagraph('ordered',start,remove);
    commit();
  }
  document.addEventListener('beforeinput',autoOrderedList);
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-list-action]');if(!button)return;
    if(button.dataset.listAction==='paragraph')textType('p');else if(button.dataset.listAction==='linebreak')listLineBreak();else changeListDepth(button.dataset.listAction==='outdent');
    closeMenus();
  });
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey||!event.target.matches('.rich-editor')||document.body.classList.contains('preview-mode'))return;
    active=event.target;remember();if(!currentListItem())return;
    if(event.key==='Tab'){event.preventDefault();changeListDepth(event.shiftKey);}
    else if(event.key==='Enter'&&event.shiftKey){event.preventDefault();listLineBreak();}
  });
  function closeMenus(except=null){document.querySelectorAll('.tool-menu[open]').forEach(m=>{if(m!==except)m.open=false;});}
  document.querySelectorAll('.tool-menu').forEach(menu=>{menu.setAttribute('name','editor-tools');menu.addEventListener('toggle',()=>{if(menu.open)closeMenus(menu);});});
  const colors=['#111827','#374151','#6b7280','#9ca3af','#d1d5db','#e5e7eb','#f3f4f6','#ffffff','#7f1d1d','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5','#fecaca','#fee2e2','#7c2d12','#c2410c','#ea580c','#f97316','#fb923c','#fdba74','#fed7aa','#ffedd5','#713f12','#a16207','#ca8a04','#eab308','#facc15','#fde047','#fef08a','#fef9c3','#14532d','#15803d','#16a34a','#22c55e','#4ade80','#86efac','#bbf7d0','#dcfce7','#1e3a8a','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#581c87','#7e22ce','#9333ea','#a855f7','#c084fc','#d8b4fe','#e9d5ff','#f3e8ff','#831843','#be185d','#db2777','#ec4899','#f472b6','#f9a8d4','#fbcfe8','#fce7f3'];
  for(const menu of document.querySelectorAll('[data-palette]')){const kind=menu.dataset.palette,colors3=['#b73530','#2563eb','#15803d'];$('.tool-popover',menu).innerHTML='<p class="popover-label">'+({text:'文字颜色',highlight:'文字高亮',underline:'下划线颜色 · 加粗实线',wave:'波浪线颜色 · 加粗波浪线'}[kind])+'</p><button class="popover-option" data-clear="'+kind+'">'+(kind==='text'?'恢复默认文字颜色':kind==='highlight'?'移除高亮':kind==='wave'?'移除波浪线':'移除下划线')+'</button>'+(['wave','underline'].includes(kind)?'<div class="preset-lines">'+colors3.map((c,i)=>'<button data-kind="'+kind+'" data-color="'+c+'"><span class="line-preview '+(kind==='wave'?'wavy':'')+'" style="--line-color:'+c+'">'+['红色','蓝色','绿色'][i]+'</span></button>').join('')+'</div>':'')+'<div class="palette-grid">'+colors.map(c=>'<button class="swatch" style="--swatch:'+c+'" data-kind="'+kind+'" data-color="'+c+'" aria-label="'+kind+' '+c+'"></button>').join('')+'</div><div class="custom-color"><label>自选颜色</label><input type="color" value="'+(kind==='highlight'?'#fef08a':'#b73530')+'"><button class="format-btn" data-apply="'+kind+'">应用</button></div>';}
  function addBlock(pos){data.blocks.push({title:pos==='bottom'?'总结与思考':'新栏目',html:'',position:pos});render();save();const input=$('[data-block-index="'+(data.blocks.length-1)+'"] .block-title-input');input?.focus();input?.select();}
  function addParagraph(afterIndex=data.paragraphs.length-1){const index=Math.max(0,Math.min(data.paragraphs.length,afterIndex+1));data.paragraphs.splice(index,0,{html:'',noteHtml:''});render();save();$('.edit-pair[data-index="'+index+'"] .paragraph-text').focus();}
  function moveParagraph(from,to){
    if(from===to||from<0||to<0||from>=data.paragraphs.length||to>=data.paragraphs.length)return;
    const [paragraph]=data.paragraphs.splice(from,1);data.paragraphs.splice(to,0,paragraph);
    render();save(true);
    const target=$('.edit-pair[data-index="'+to+'"]');target.querySelector('.paragraph-drag').focus({preventScroll:true});target.scrollIntoView({block:'nearest'});
  }
  const articleList=$('#articleList');let draggedParagraph=null;
  const clearParagraphDrop=()=>articleList.querySelectorAll('[data-drop-position]').forEach(el=>delete el.dataset.dropPosition);
  articleList.addEventListener('click',e=>{const insert=e.target.closest('[data-add-paragraph-after]');if(insert){addParagraph(+insert.dataset.addParagraphAfter);return;}const button=e.target.closest('[data-para-move]');if(!button)return;const from=+button.closest('[data-index]').dataset.index;moveParagraph(from,from+(button.dataset.paraMove==='up'?-1:1));});
  articleList.addEventListener('dragstart',e=>{
    const handle=e.target.closest('.paragraph-drag');if(!handle)return;
    draggedParagraph=+handle.closest('[data-index]').dataset.index;
    e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-paper-bound-paragraph',String(draggedParagraph));
  });
  articleList.addEventListener('dragover',e=>{
    if(draggedParagraph===null)return;const target=e.target.closest('.edit-pair');if(!target)return;
    e.preventDefault();e.dataTransfer.dropEffect='move';clearParagraphDrop();
    const box=target.getBoundingClientRect();target.dataset.dropPosition=e.clientY<box.top+box.height/2?'before':'after';
  });
  articleList.addEventListener('drop',e=>{
    if(draggedParagraph===null)return;e.preventDefault();const target=e.target.closest('.edit-pair'),from=draggedParagraph;draggedParagraph=null;
    if(target){let to=+target.dataset.index+(target.dataset.dropPosition==='after'?1:0);if(from<to)to--;clearParagraphDrop();moveParagraph(from,to);}else clearParagraphDrop();
  });
  articleList.addEventListener('dragend',()=>{draggedParagraph=null;clearParagraphDrop();});
  document.addEventListener('input',e=>{const t=e.target;let changed=false;if(fields[t.id]){data[fields[t.id]]=t.value;changed=true;}if(t.matches('[data-field]')){data.paragraphs[+t.closest('[data-index]').dataset.index][t.dataset.field]=clean(t.innerHTML);changed=true;}const wrap=t.closest('[data-block-index]');if(wrap&&t.dataset.blockField&&t.dataset.blockField!=='position'){data.blocks[+wrap.dataset.blockIndex][t.dataset.blockField]=t.isContentEditable?clean(t.innerHTML):t.value;changed=true;}if(changed){paper();save();}});
  document.addEventListener('focusin',e=>{if(e.target.matches('.rich-editor')){active=e.target;remember();}});document.addEventListener('selectionchange',remember);document.addEventListener('pointerdown',preserveBeforeToolbarAction,true);document.addEventListener('mousedown',preserveBeforeToolbarAction,true);
  $('#formatPainter').addEventListener('click',e=>{if(e.detail>1)return;if(painter)stopPainter();else setPainter();});
  $('#paragraphIndent').addEventListener('click',toggleParagraphIndent);
  $('#formatPainter').addEventListener('dblclick',()=>{if(painter){painter.locked=true;$('#formatPainter').dataset.locked='true';syncToolbar();}else setPainter(true);});
  let painterTarget=null;
  document.addEventListener('pointerdown',e=>{painterTarget=painter&&e.button===0?e.target.closest('.rich-editor'):null;if(painter&&e.target.closest('.rich-toolbar')&&!e.target.closest('#formatPainter'))stopPainter();});
  document.addEventListener('pointerup',e=>{const target=painterTarget;painterTarget=null;if(!target||!painter||!target.contains(e.target))return;setTimeout(()=>{if(!painter)return;remember();if(active===target)applyPainter(true);},0);});
  document.addEventListener('beforeinput',e=>{if(painter&&e.target.closest('.rich-editor')&&!/^history/.test(e.inputType))stopPainter();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&painter){e.preventDefault();stopPainter();}});
  document.addEventListener('change',e=>{if(e.target.matches('[data-block-field="position"]')){data.blocks[+e.target.closest('[data-block-index]').dataset.blockIndex].position=e.target.value;render();save();}if(e.target.id==='fontSizePicker'){if(e.target.value)style({fontSize:e.target.value+'px'});else style({}, {'data-default-size':'true'});}if(e.target.id==='fontFamilyPicker'){data.fontFamily=fontFamilies.has(e.target.value)?e.target.value:'';applyDocumentFont();save();}if(e.target.id==='textTypePicker')textType(e.target.value);});
  document.addEventListener('click',e=>{const t=e.target,menuSummary=t.closest('.tool-menu > summary');if(menuSummary)closeMenus(menuSummary.parentElement);const fmt=t.closest('[data-format]'),kind=t.closest('[data-kind]'),apply=t.closest('[data-apply]'),clear=t.closest('[data-clear]'),list=t.closest('[data-list]'),add=t.closest('[data-add-block]'),action=t.closest('[data-action]');if(fmt)format(fmt.dataset.format);if(kind){const k=kind.dataset.kind,c=kind.dataset.color;if(k==='text')format('foreColor',c);else if(k==='highlight')format('hiliteColor',c);else decorateLine(c,k==='wave'?'wavy':'solid');closeMenus();}if(apply){const input=$('input[type=color]',apply.parentElement);const k=apply.dataset.apply;if(k==='text')format('foreColor',input.value);else if(k==='highlight')format('hiliteColor',input.value);else decorateLine(input.value,k==='wave'?'wavy':'solid');closeMenus();}if(clear){const k=clear.dataset.clear;if(k==='text')format('foreColor','#30383e');else if(k==='highlight')format('hiliteColor','transparent');else clearLineMarks(k==='wave'?'wavy':'solid');closeMenus();}if(list){insertList(list.dataset.list);closeMenus();}if(add)addBlock(add.dataset.addBlock);if(action){const k=action.dataset.action;if(k==='delete'){const i=+action.closest('[data-index]').dataset.index;if(data.paragraphs.length===1){toast('至少保留一个文段');return;}if(!confirm('删除文段和对应分析？'))return;data.paragraphs.splice(i,1);}else{const bi=+action.closest('[data-block-index]').dataset.blockIndex;if(k==='block-delete'){if(!confirm('删除这个栏目？'))return;data.blocks.splice(bi,1);}else{const group=data.blocks.map((b,n)=>b.position===data.blocks[bi].position?n:-1).filter(n=>n>=0),at=group.indexOf(bi),to=group[at+(k==='up'?-1:1)];if(to===undefined)return;[data.blocks[bi],data.blocks[to]]=[data.blocks[to],data.blocks[bi]];}}render();save();}const view=t.closest('[data-view]');if(view){if(painter)stopPainter();document.body.classList.toggle('preview-mode',view.dataset.view==='preview');document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===view));closeMenus();}const mode=t.closest('[data-layout]');if(mode){layout=mode.dataset.layout;document.querySelectorAll('[data-layout]').forEach(b=>b.classList.toggle('active',b===mode));paper();}if(!t.closest('.tool-menu'))closeMenus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});
  window.noteEditor={remember,format,copyFormat:()=>setPainter(true),pasteFormat:()=>applyPainter(false),textType,insertList,changeListDepth,listLineBreak,adjustFontSize,underline:()=>decorateLine('#b73530','solid',true),wave:()=>decorateLine('#b73530','wavy',true),toggleHighlight,resetSize:()=>style({}, {'data-default-size':'true'})};
  $('#addBtn').addEventListener('click',addParagraph);$('#addBottom').addEventListener('click',addParagraph);$('#printBtn').addEventListener('click',()=>{document.body.classList.add('preview-mode');window.print();});$('#printPreviewBtn').addEventListener('click',()=>window.print());
  $('#newBtn').addEventListener('click',()=>window.noteApp.requestNewDocument(activeDoc.folderId));$('#resetBtn').addEventListener('click',()=>{if(!confirm('恢复示例内容？当前笔记会被替换。'))return;data=normalize(sample);render();save();toast('已恢复示例内容');});
  function parseArticle(txt,ext='txt'){
      let ps;
      if(ext==='docx'){
        const doc=new DOMParser().parseFromString(txt,'text/html'),blocks=[];
        const collect=node=>{
          if(node.nodeType===Node.TEXT_NODE){if(node.textContent.trim())blocks.push('<p>'+esc(node.textContent.trim())+'</p>');return;}
          if(node.nodeType!==Node.ELEMENT_NODE)return;
          if(/^(SCRIPT|STYLE|IFRAME|OBJECT|IMG)$/.test(node.tagName))return;
          if(/^(P|H[1-6]|UL|OL)$/.test(node.tagName)){if(node.textContent.trim())blocks.push(node.outerHTML);return;}
          if(node.tagName==='TR'){
            if(node.textContent.trim())blocks.push('<p>'+Array.from(node.children,cell=>esc(cell.textContent.trim())).join(' · ')+'</p>');return;
          }
          for(const child of node.childNodes)collect(child);
        };
        for(const child of doc.body.childNodes)collect(child);
        ps=blocks.map(html=>({html:clean(html),noteHtml:''})).filter(p=>p.html);
      }else if(['html','htm'].includes(ext)){
        const doc=new DOMParser().parseFromString(txt,'text/html');
        const elements=Array.from(doc.querySelectorAll('p'));
        if(!elements.length)elements.push(...doc.body.children);
        ps=elements.map(p=>({html:clean(p.outerHTML),noteHtml:''})).filter(p=>p.html);
        if(!ps.length&&doc.body.textContent.trim())ps=[{html:textHtml(doc.body.textContent.trim()),noteHtml:''}];
      }else ps=txt.replace(/\r/g,'').split(/\n\s*\n+/).map(x=>({html:textHtml(x.trim()),noteHtml:''})).filter(p=>p.html);
      return ps;
  }
  function importArticle(paragraphs,title='',createNew=true,templateId=''){
    if(!paragraphs.length){toast('没有可导入的正文');return false;}
    const template=templateId?library.templates.find(t=>t.id===templateId):null;
    if(templateId&&!template){toast('这个模板已不存在，请重新选择');return false;}
    if(!createNew&&!confirm(template?'将套用所选模板的标题和顶部信息，并用导入内容替换模板正文与栏目，是否继续？':'导入文章将替换当前文档的正文和栏目，是否继续？'))return false;
    if(createNew){const doc=newDocument(activeDoc.folderId,templateId,title||(!template?'导入的文章':null));if(!doc)return false;}
    if(template)data=normalize(noteRuntime.clone(template.data));
    data={...data,title:title.trim().slice(0,160)||data.title,paragraphs,blocks:[]};
    render();save(true);$('[data-view="edit"]').click();toast('已导入 '+paragraphs.length+' 个文段');return true;
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save(true);});
  window.addEventListener('pagehide',()=>save(true));render();
})();
