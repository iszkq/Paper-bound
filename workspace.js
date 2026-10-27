(() => {
  'use strict';
  const $=(s,root=document)=>root.querySelector(s), app=window.noteApp;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=paths=>'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'+paths+'</svg>';
  const folderIcon=icon('<path d="M3 6h7l2 2h9v11H3z"/>'),bookIcon=icon('<path d="M4 3h16v18H4zM8 3v18M12 9h5M14.5 6.5v7"/>');
  let folder='all';
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const download=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};
  const newDialog=(title,html)=>{let d=$('#actionDialog');if(d)d.remove();d=document.createElement('dialog');d.id='actionDialog';d.className='app-dialog';d.innerHTML='<form method="dialog" class="dialog-close-row"><button class="small-icon-btn" aria-label="关闭">×</button></form><h2>'+esc(title)+'</h2>'+html;document.body.append(d);closeOnBackdrop(d);d.showModal();return d;};
  function closeOnBackdrop(dialog){
    let pressedOutside=false;
    const outside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
    dialog.addEventListener('pointerdown',e=>{pressedOutside=outside(e);});
    dialog.addEventListener('click',e=>{if(pressedOutside&&outside(e))dialog.close();pressedOutside=false;});
    dialog.addEventListener('pointercancel',()=>{pressedOutside=false;});
    dialog.addEventListener('close',()=>{pressedOutside=false;});
  }
  closeOnBackdrop($('#libraryDialog'));
  const templateOptions=(templates,selected='')=>templates.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===selected?'selected':'')+'>'+esc(t.name)+(t.id===app.getState().library.defaultTemplateId?'（默认）':'')+'</option>').join('');
  const templateSummary=template=>{
    if(!template)return '保留默认顶部信息，正文和分析从空白开始。';
    const d=template.data;
    return '文档标题：'+(d.title||'未命名笔记')+'；作者：'+(d.author||'未填写')+'；'+d.blocks.length+' 个栏目，'+d.paragraphs.length+' 组文段与分析。';
  };
  app.requestNewDocument=(folderId='')=>{
    const {library}=app.getState();
    if(!library.templates.length){$('[data-view="edit"]').click();app.newDocument(folderId,'');return;}
    const selected=library.defaultTemplateId||'',initial=library.templates.find(t=>t.id===selected);
    const d=newDialog('新建文档','<form id="newFromTemplateForm"><label>选择模板<select id="newTemplatePicker"><option value="">空白文档</option>'+templateOptions(library.templates,selected)+'</select></label><p class="dialog-copy" id="newTemplateSummary">'+esc(templateSummary(initial))+'</p><label>文档标题<input id="newTemplateTitle" maxlength="160" value="'+esc(initial?.data.title||'')+'" placeholder="未命名笔记"></label><div class="dialog-actions"><button type="submit" class="btn btn-primary">创建文档</button><button type="button" class="btn" id="newBlankDocument">直接新建空白</button></div></form>');
    $('#newTemplatePicker').onchange=e=>{const template=app.getState().library.templates.find(t=>t.id===e.target.value);$('#newTemplateSummary').textContent=templateSummary(template);$('#newTemplateTitle').value=template?.data.title||'';};
    $('#newFromTemplateForm').onsubmit=e=>{e.preventDefault();const templateId=$('#newTemplatePicker').value,title=$('#newTemplateTitle').value;d.close();$('[data-view="edit"]').click();app.newDocument(folderId,templateId,title);};
    $('#newBlankDocument').onclick=()=>{d.close();$('[data-view="edit"]').click();app.newDocument(folderId,'');};
  };
  function saveDocumentAsTemplate(sourceId=app.getState().activeDoc.id){
    app.save();const {library}=app.getState(),source=library.documents.find(doc=>doc.id===sourceId);if(!source)return;
    const d=newDialog('将文档存为模板','<form id="saveTemplateForm"><p class="dialog-copy">保存「'+esc(source.title)+'」的标题、顶部信息、栏目、正文、分析和文字格式。以后新建时可以直接复用。</p><label>模板名称<input id="templateName" maxlength="80" required value="'+esc(source.title.slice(0,80))+'" autofocus></label><label class="template-default-option"><input type="checkbox" id="templateMakeDefault" '+(!library.defaultTemplateId?'checked':'')+'>设为新建文档的默认模板</label><div class="dialog-actions"><button class="btn btn-primary" type="submit">保存模板</button></div></form>');
    $('#saveTemplateForm').onsubmit=e=>{e.preventDefault();const template=app.saveTemplate($('#templateName').value,'',sourceId);if(!template)return;if($('#templateMakeDefault').checked)app.setDefaultTemplate(template.id);d.close();app.toast('模板已保存，新建文档时可以选择');};
  }
  function manageTemplates(preferred=''){
    const {library}=app.getState(),templates=library.templates,selected=templates.some(t=>t.id===preferred)?preferred:library.defaultTemplateId||templates[0]?.id||'';
    const d=newDialog('文档模板','<p class="dialog-copy">将常用标题、顶部信息和内容存成模板。新文档是一份独立副本，修改后不会影响模板。</p><button class="btn btn-primary" id="saveCurrentTemplate">将当前文档存为模板</button>'+(templates.length?'<section class="template-manage-section"><label>已有模板<select id="manageTemplatePicker">'+templateOptions(templates,selected)+'</select></label><p class="dialog-copy" id="manageTemplateSummary"></p><p class="dialog-copy" id="defaultTemplateStatus" role="status"></p><div class="dialog-actions"><button class="btn btn-primary" id="useTemplate">用此模板新建</button><button class="btn" id="defaultTemplate"></button><button class="btn" id="renameTemplate">重命名</button><button class="btn" id="overwriteTemplate">用当前文档更新</button><button class="btn danger-button" id="deleteTemplate">删除模板</button></div></section>':'<p class="dialog-copy template-manage-section">还没有模板。先把当前文档调整成常用样式，再保存为模板。</p>'));
    $('#saveCurrentTemplate').onclick=()=>saveDocumentAsTemplate();
    if(!templates.length)return;
    const current=()=>app.getState().library.templates.find(t=>t.id===$('#manageTemplatePicker').value);
    function describe(){const t=current();$('#manageTemplateSummary').textContent=templateSummary(t);const isDefault=library.defaultTemplateId===t?.id;$('#defaultTemplate').textContent=isDefault?'取消默认':'设为默认';const activeDefault=library.templates.find(t=>t.id===library.defaultTemplateId);$('#defaultTemplateStatus').textContent=activeDefault?'默认模板：'+activeDefault.name:'默认从空白文档开始，可在新建时选择模板。';}
    $('#manageTemplatePicker').onchange=describe;describe();
    $('#useTemplate').onclick=()=>{const t=current();if(!t)return;const folderId=app.getState().activeDoc.folderId;d.close();$('[data-view="edit"]').click();app.newDocument(folderId,t.id);};
    $('#defaultTemplate').onclick=()=>{const t=current();if(!t)return;app.setDefaultTemplate(library.defaultTemplateId===t.id?'':t.id);manageTemplates(t.id);};
    $('#renameTemplate').onclick=()=>{const t=current();if(!t)return;const form=newDialog('重命名模板','<form id="renameTemplateForm"><label>模板名称<input id="renameTemplateName" maxlength="80" required value="'+esc(t.name)+'" autofocus></label><button class="btn btn-primary" type="submit">保存名称</button></form>');$('#renameTemplateForm').onsubmit=e=>{e.preventDefault();app.renameTemplate(t.id,$('#renameTemplateName').value);form.close();manageTemplates(t.id);};};
    $('#overwriteTemplate').onclick=()=>{const t=current();if(!t||!confirm('用当前文档更新「'+t.name+'」？已创建的文档不会改变。'))return;app.saveTemplate(t.name,t.id);manageTemplates(t.id);app.toast('模板内容已更新');};
    $('#deleteTemplate').onclick=()=>{const t=current();if(!t||!confirm('删除模板「'+t.name+'」？已经创建的文档会保留。'))return;app.deleteTemplate(t.id);manageTemplates();};
  }
  $('#templateOpen').onclick=()=>manageTemplates();
  function drawLibrary(){
    const {session,library,activeDoc}=app.getState(),user=read('zhijian-users-v1',[]).find(x=>x.id===session);
    const cloud=window.cloudAccount?.user;$('#accountLabel').textContent=cloud?.displayName||cloud?.username||user?.displayName||user?.username||'登录 / 注册';$('#libraryDialog').dataset.currentFolder=folder;
    $('#logoutBtn').hidden=session==='guest';
    if(folder!=='all'&&folder!==''&&!library.folders.some(f=>f.id===folder))folder='all';
    const renderFolders=(parent='',depth=0)=>library.folders.filter(f=>f.parentId===parent).map(f=>'<button class="folder-button '+(folder===f.id?'active':'')+'" data-folder="'+f.id+'" draggable="true" tabindex="0" data-drag-type="folder" data-drag-id="'+f.id+'" title="拖动排序或移入文件夹，Alt+上下键排序" style="padding-left:'+(9+depth*13)+'px">'+folderIcon+esc(f.name)+'<span class="folder-count">'+library.documents.filter(d=>d.folderId===f.id).length+'</span></button>'+renderFolders(f.id,depth+1)).join('');
    $('#folderTree').innerHTML='<button class="folder-button '+(folder==='all'?'active':'')+'" data-folder="all">全部笔记<span class="folder-count">'+library.documents.length+'</span></button><button class="folder-button '+(folder===''?'active':'')+'" data-folder="">未分类</button>'+renderFolders();
    $('#renameFolderBtn').hidden=!folder||folder==='all';
    $('#currentFolderName').textContent=folder==='all'?'全部文档':folder===''?'未分类':library.folders.find(f=>f.id===folder)?.name||'文件夹';
    const q=$('#documentSearch').value.trim().toLowerCase();
    const children=q||folder===''?[]:library.folders.filter(f=>folder==='all'?!f.parentId:f.parentId===folder);
    $('#childFolders').innerHTML=children.map(f=>'<button class="child-folder" data-folder="'+f.id+'" draggable="true" data-drag-type="folder" data-drag-id="'+f.id+'" title="拖动排序或移入其他文件夹">'+folderIcon+'<span>'+esc(f.name)+'</span><span class="folder-count">打开 →</span></button>').join('');
    const docs=library.documents.filter(d=>(q||folder==='all'||d.folderId===folder)&&(!q||d.title.toLowerCase().includes(q)));
    $('#documentList').innerHTML=docs.length?docs.map(d=>'<div class="document-entry '+(activeDoc.id===d.id?'current':'')+'" draggable="true" tabindex="0" data-drag-type="doc" data-drag-id="'+d.id+'" title="拖动排序或移入文件夹，Alt+上下键排序"><button data-doc="'+d.id+'">'+esc(d.title||'未命名笔记')+'<small>'+esc(library.folders.find(f=>f.id===d.folderId)?.name||'未分类')+'</small></button><button class="small-icon-btn" data-doc-menu="'+d.id+'" aria-label="管理 '+esc(d.title)+'" title="管理笔记">⋯</button></div>').join(''):'<p class="empty-library">这里还没有笔记。可以在这个文件夹中新建。</p>';
  }
  document.addEventListener('libraryupdated',drawLibrary);
  function closeLibrary(){$('#libraryDialog').close();}
  function editDocument(id){app.openDocument(id);closeLibrary();$('[data-view="edit"]').click();}
  $('#libraryToggle').setAttribute('aria-haspopup','dialog');
  $('#libraryToggle').onclick=()=>{drawLibrary();$('#libraryDialog').showModal();};
  $('#libraryClose').onclick=closeLibrary;
  $('#documentSearch').oninput=drawLibrary;
  const enterFolder=e=>{const b=e.target.closest('[data-folder]');if(b){folder=b.dataset.folder;$('#documentSearch').value='';drawLibrary();}};
  $('#folderTree').onclick=enterFolder;
  $('#childFolders').onclick=enterFolder;
  $('#newDocumentBtn').onclick=()=>{closeLibrary();$('[data-view="edit"]').click();app.requestNewDocument(folder==='all'?'':folder);};
  $('#openFolderBtn').onclick=()=>{
    const {library}=app.getState();
    if(!library.folders.length){app.toast('还没有文件夹，请先新建一个');return;}
    const path=f=>{const names=[f.name],seen=new Set([f.id]);let parent=library.folders.find(x=>x.id===f.parentId);while(parent&&!seen.has(parent.id)){seen.add(parent.id);names.unshift(parent.name);parent=library.folders.find(x=>x.id===parent.parentId);}return names.join(' / ');};
    const d=newDialog('打开文件夹','<label>选择已有文件夹<select id="folderToOpen">'+library.folders.map(f=>'<option value="'+f.id+'">'+esc(path(f))+'</option>').join('')+'</select></label><div class="dialog-actions"><button class="btn btn-primary" id="confirmOpenFolder">打开文件夹</button></div>');
    if(library.folders.some(f=>f.id===folder))$('#folderToOpen').value=folder;
    $('#confirmOpenFolder').onclick=()=>{folder=$('#folderToOpen').value;$('#documentSearch').value='';drawLibrary();d.close();};
  };
  $('#newFolderBtn').onclick=()=>{
    const parent=folder==='all'?'':folder;
    const d=newDialog('新建文件夹','<form id="newFolderForm"><label>文件夹名称<input id="newFolderName" maxlength="80" required autofocus placeholder="例如：阅读笔记"></label><p class="dialog-copy">'+(parent?'将在当前文件夹内创建。':'将在文件库中创建。')+'</p><button type="submit" class="btn btn-primary">创建文件夹</button></form>');
    $('#newFolderForm').onsubmit=e=>{e.preventDefault();const name=$('#newFolderName').value.trim();if(!name)return;const lib=app.getState().library,id=noteRuntime.uuid();lib.folders.push({id,name,parentId:parent});folder=id;$('#documentSearch').value='';app.updateLibrary();d.close();};
  };
  $('#renameFolderBtn').onclick=()=>{
    const {library}=app.getState(),f=library.folders.find(x=>x.id===folder);if(!f)return;
    const d=newDialog('管理文件夹','<label>名称<input id="folderRename" value="'+esc(f.name)+'" maxlength="80"></label><div class="dialog-actions"><button id="saveFolderName" class="btn btn-primary">保存名称</button><button id="deleteFolder" class="btn danger-button">删除文件夹</button></div>');
    $('#saveFolderName').onclick=()=>{const n=$('#folderRename').value.trim();if(!n)return;f.name=n;app.updateLibrary();d.close();};
    $('#deleteFolder').onclick=()=>{if(!confirm('删除此文件夹及子文件夹？里面的笔记会保留并移到未分类。'))return;const ids=new Set([f.id]);let count;do{count=ids.size;library.folders.forEach(x=>{if(ids.has(x.parentId))ids.add(x.id);});}while(count!==ids.size);library.documents.forEach(x=>{if(ids.has(x.folderId))x.folderId='';});library.folders=library.folders.filter(x=>!ids.has(x.id));folder='';app.updateLibrary();d.close();};
  };
  $('#documentList').onclick=e=>{
    const open=e.target.closest('[data-doc]');if(open){editDocument(open.dataset.doc);return;}
    const menu=e.target.closest('[data-doc-menu]');if(!menu)return;
    const {library}=app.getState(),doc=library.documents.find(x=>x.id===menu.dataset.docMenu);
    const d=newDialog('管理笔记','<label>笔记名称<input id="docRename" value="'+esc(doc.title)+'" maxlength="160"></label><label>所在文件夹<select id="docFolder"><option value="">未分类</option>'+library.folders.map(f=>'<option value="'+f.id+'">'+esc(f.name)+'</option>').join('')+'</select></label><div class="dialog-actions"><button id="docSave" class="btn btn-primary">保存</button><button id="docDuplicate" class="btn">复制笔记</button><button id="docDelete" class="btn danger-button">删除</button></div>');$('#docFolder').value=doc.folderId;
    $('#docSave').onclick=()=>{doc.title=$('#docRename').value.trim()||'未命名笔记';doc.folderId=$('#docFolder').value;doc.data.title=doc.title;if(doc.id===app.getState().activeDoc.id){app.getState().data.title=doc.title;$('#titleInput').value=doc.title;$('#titleInput').dispatchEvent(new Event('input',{bubbles:true}));}app.updateLibrary();d.close();};
    const templateButton=document.createElement('button');templateButton.className='btn';templateButton.id='docSaveTemplate';templateButton.textContent='存为模板';d.querySelector('.dialog-actions').append(templateButton);templateButton.onclick=()=>{d.close();closeLibrary();saveDocumentAsTemplate(doc.id);};
    $('#docDuplicate').onclick=()=>{app.save();const copy=noteRuntime.clone(doc);copy.id=noteRuntime.uuid();copy.title+=' · 副本';copy.data.title=copy.title;library.documents.push(copy);app.openDocument(copy.id);d.close();};
    $('#docDelete').onclick=()=>{if(!confirm('删除这份笔记？此操作无法撤销。'))return;app.save();library.documents=library.documents.filter(x=>x.id!==doc.id);if(!library.documents.length)app.newDocument();else if(app.getState().activeDoc.id===doc.id)app.openDocument(library.documents[0].id);app.updateLibrary();d.close();};
  };
  // Preview sizing and image export use the same canvas and loaded document fonts.
  const toolbar=$('.preview-toolbar');
  const exportButton=document.createElement('button');exportButton.id='imageExportBtn';exportButton.className='btn';exportButton.textContent='导出图片';toolbar.insertBefore(exportButton,$('#printPreviewBtn'));
  const scaleLabel=document.createElement('label');scaleLabel.className='preview-scale-label';scaleLabel.innerHTML='阅读字号 <select id="previewReadingSize" aria-label="预览阅读字号"><option value="17">17</option><option value="19">19</option><option value="22">22</option><option value="24">24</option></select>';toolbar.insertBefore(scaleLabel,exportButton);
  $('#previewReadingSize').onchange=e=>$('#paper').style.setProperty('--preview-reading-size',e.target.value+'px');
  exportButton.onclick=async()=>{
    const button=exportButton;button.disabled=true;button.textContent='正在生成图片…';
    try{if(!window.html2canvas)throw new Error('图片组件未能加载，请刷新重试。');await document.fonts.ready;const el=$('#paper'),rect=el.getBoundingClientRect(),maxSlice=5000;
      const count=Math.ceil(rect.height/maxSlice);for(let i=0;i<count;i++){const h=Math.min(maxSlice,rect.height-i*maxSlice);const canvas=await html2canvas(el,{scale:2,backgroundColor:'#fff',useCORS:true,height:h,y:i*maxSlice,windowWidth:window.innerWidth,logging:false});const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('图片生成失败。');download(blob,(app.getState().data.title||'阅读笔记')+(count>1?'-'+(i+1):'')+'.png');canvas.width=0;canvas.height=0;}
      app.toast(count>1?'已分段导出 '+count+' 张高清图片':'图片已导出');
    }catch(err){app.toast(err.message||'图片导出失败，请重试。');}finally{button.disabled=false;button.textContent='导出图片';}
  };
  // CSV is parsed as data, including quoted fields, commas and embedded newlines.
  let verses=[],books=[],index=new Map(),selected=new Set(),tab='browse',results=[],limit=100,loading=null,queryTimer;
  function parseCSV(text){const rows=[];let row=[],field='',quoted=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}if(field||row.length){row.push(field);rows.push(row);}return rows;}
  const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
  const ref=v=>v.book+' '+v.chapter+':'+v.verse;
  const ordered=(text,token)=>{let at=0;for(const c of token){at=text.indexOf(c,at);if(at<0)return false;at++;}return true;};
  function selectionStatus(){ $('#bibleSelectedCount').textContent='已选 '+selected.size+' 节';$('#bibleCopy').disabled=!selected.size;$('#bibleClearSelection').disabled=!selected.size; }
  function highlight(text){const tokens=$('#bibleQuery').value.trim().split(/\s+/).filter(Boolean);if(tab!=='search'||!tokens.length)return esc(text);const escaped=tokens.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).sort((a,b)=>b.length-a.length);const re=new RegExp('('+escaped.join('|')+')','gi');return text.split(re).map((x,i)=>i%2?'<mark>'+esc(x)+'</mark>':esc(x)).join('');}
  function drawVerses(){const list=results.slice(0,limit);$('#bibleResults').innerHTML=list.length?list.map(v=>'<article class="verse-row" id="verse-'+v.id+'"><input type="checkbox" id="check-'+v.id+'" data-verse="'+v.id+'" '+(selected.has(v.id)?'checked':'')+' aria-label="选择 '+ref(v)+'"><label for="check-'+v.id+'" class="verse-copy"><span class="verse-ref">'+esc(ref(v))+'</span>'+highlight(v.text)+'</label>'+(tab==='search'?'<button class="verse-jump" data-jump="'+v.id+'">跳到原文</button>':'')+'</article>').join('')+(results.length>limit?'<button id="bibleMore" class="btn bible-more">再显示 100 节（共 '+results.length+' 节）</button>':''):'<p class="bible-empty">'+(tab==='search'?'没有匹配经文。可缩短关键词，或用空格分开多个关键词。':'这个章节暂时没有经文。')+'</p>';selectionStatus();}
  function setTab(next){tab=next;document.querySelectorAll('[data-bible-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bibleTab===tab));$('#bibleBrowseControls').hidden=tab!=='browse';$('#bibleSearchControls').hidden=tab!=='search';}
  function fillBooks(preferred=''){
    const group=books.filter(b=>b.testament===$('#bibleTestament').value);
    $('#bibleBook').innerHTML=group.map(b=>'<option value="'+esc(b.name)+'">'+esc(b.name)+'</option>').join('');
    if(group.some(b=>b.name===preferred))$('#bibleBook').value=preferred;
    fillChapters();
  }
  function fillChapters(){const book=index.get($('#bibleBook').value);$('#bibleChapter').innerHTML=[...(book?.chapters.keys()||[])].map(c=>'<option value="'+c+'">第 '+c+' 章</option>').join('');}
  function browse(){clearTimeout(queryTimer);setTab('browse');results=index.get($('#bibleBook').value)?.chapters.get(+$('#bibleChapter').value)||[];limit=1000;$('#bibleStatus').textContent=$('#bibleBook').value+' · 第 '+$('#bibleChapter').value+' 章 · '+results.length+' 节';drawVerses();$('#bibleResults').scrollTop=0;}
  function search(){clearTimeout(queryTimer);setTab('search');const tokens=$('#bibleQuery').value.trim().split(/\s+/).map(normalize).filter(Boolean);limit=100;if(!tokens.length){results=[];$('#bibleStatus').textContent='空格分隔关键词，结果需同时匹配全部关键词';drawVerses();return;}results=verses.filter(v=>tokens.every(t=>v.normal.includes(t)||ordered(v.normal,t)));$('#bibleStatus').textContent='共找到 '+results.length+' 节 · 支持包含匹配和关键词字符顺序匹配';drawVerses();$('#bibleResults').scrollTop=0;}
  async function loadBible(){if(verses.length)return;if(loading)return loading;loading=(async()=>{const response=await fetch('data/Bible1.csv');if(!response.ok)throw new Error('经文数据加载失败');const rows=parseCSV(await response.text()),header=rows.shift();const field=name=>header.indexOf(name),testament=field('约名'),bi=field('卷名'),ci=field('章数'),vi=field('节数'),ti=field('内容');if([testament,bi,ci,vi,ti].some(x=>x<0))throw new Error('经文数据字段不完整');verses=rows.map((r,i)=>({id:i,testament:r[testament],book:r[bi],chapter:+r[ci],verse:+r[vi],text:r[ti]||'',normal:normalize((r[bi]||'')+(r[ti]||''))}));for(const v of verses){if(!index.has(v.book)){const b={name:v.book,testament:v.testament,chapters:new Map()};index.set(v.book,b);books.push(b);}const chapters=index.get(v.book).chapters;if(!chapters.has(v.chapter))chapters.set(v.chapter,[]);chapters.get(v.chapter).push(v);}fillBooks();browse();})();try{await loading;}finally{loading=null;}}
  const toolBible=document.createElement('button');toolBible.className='format-btn';toolBible.id='bibleToolbarOpen';toolBible.title='查找圣经经文';toolBible.setAttribute('aria-label','圣经经文');toolBible.innerHTML=bookIcon+' 经文';$('.rich-toolbar').insertBefore(toolBible,$('#formatHint'));
  const openBible=async()=>{$('#bibleDialog').showModal();try{await loadBible();}catch(err){$('#bibleStatus').textContent=err.message;$('#bibleResults').innerHTML='<p class="bible-empty">加载失败，请关闭后重新打开。</p>';}};
  toolBible.onclick=openBible;$('#bibleClose').onclick=()=>$('#bibleDialog').close();
  document.querySelectorAll('[data-bible-tab]').forEach(b=>b.onclick=()=>{if(!verses.length)return;if(b.dataset.bibleTab==='search')search();else browse();});
  $('#bibleTestament').onchange=()=>{if(!verses.length)return;fillBooks();browse();};$('#bibleBook').onchange=()=>{fillChapters();browse();};$('#bibleChapter').onchange=browse;
  $('#bibleSearchButton').onclick=search;$('#bibleQuery').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(search,220);};$('#bibleQuery').onkeydown=e=>{if(e.key==='Enter'){clearTimeout(queryTimer);search();}};
  $('#bibleResults').onchange=e=>{if(!e.target.matches('[data-verse]'))return;const id=+e.target.dataset.verse;e.target.checked?selected.add(id):selected.delete(id);selectionStatus();};
  $('#bibleResults').onclick=e=>{const jump=e.target.closest('[data-jump]');if(jump){const v=verses[+jump.dataset.jump];$('#bibleTestament').value=v.testament;fillBooks(v.book);$('#bibleChapter').value=v.chapter;browse();const row=$('#verse-'+v.id);row?.classList.add('verse-target');row?.scrollIntoView({block:'center'});return;}if(e.target.id==='bibleMore'){limit+=100;const top=$('#bibleResults').scrollTop;drawVerses();$('#bibleResults').scrollTop=top;}};
  function clearBibleSelection(){selected.clear();$('#bibleResults').querySelectorAll('input:checked').forEach(x=>x.checked=false);selectionStatus();}
  $('#bibleClearSelection').onclick=clearBibleSelection;
  $('#bibleDialog').addEventListener('close',clearBibleSelection);
  closeOnBackdrop($('#bibleDialog'));
  $('#bibleCopy').onclick=async()=>{const text=[...selected].sort((a,b)=>a-b).map(id=>{const v=verses[id];return '【'+ref(v)+'】'+v.text;}).join('\n');try{await navigator.clipboard.writeText(text);app.toast('已复制 '+selected.size+' 节经文');}catch{const area=document.createElement('textarea');area.value=text;$('#bibleDialog').append(area);area.select();const ok=document.execCommand('copy');area.remove();app.toast(ok?'经文已复制':'复制失败，请允许剪贴板访问');}};
  drawLibrary();selectionStatus();
})();
