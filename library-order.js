(() => {
  const panel=document.querySelector('#libraryDialog');
  const type='application/x-paper-library';
  let dragging=null, marker=null;
  const clear=()=>{panel.querySelectorAll('.drop-before,.drop-after,.drop-inside,.dragging').forEach(el=>el.classList.remove('drop-before','drop-after','drop-inside','dragging'));marker=null;};
  const itemFrom=el=>el.closest('[data-drag-type]');
  function move(source,target,place){
    const {library}=noteApp.getState();
    const list=source.type==='folder'?library.folders:library.documents;
    const item=list.find(x=>x.id===source.id);
    if(!item)return false;
    let parent,anchor=null;
    if(target.type==='folder'&&place==='inside')parent=target.id==='all'?'':target.id;
    else if(target.type===source.type){
      anchor=list.find(x=>x.id===target.id);
      if(!anchor||anchor.id===item.id)return false;
      parent=source.type==='folder'?anchor.parentId:anchor.folderId;
      // In the all-documents view, rearranging a row does not change its folder.
      if(source.type==='doc'&&panel.dataset.currentFolder==='all')parent=item.folderId;
    }else return false;
    if(source.type==='folder'){
      if(parent===item.id)return false;
      let cursor=parent;
      const seen=new Set();
      while(cursor){if(cursor===item.id||seen.has(cursor))return false;seen.add(cursor);cursor=library.folders.find(f=>f.id===cursor)?.parentId||'';}
      item.parentId=parent;
    }else item.folderId=parent;
    list.splice(list.indexOf(item),1);
    const at=anchor?list.indexOf(anchor)+(place==='after'?1:0):list.length;
    list.splice(at,0,item);
    noteApp.updateLibrary();
    return true;
  }
  panel.addEventListener('dragstart',e=>{
    const row=itemFrom(e.target);if(!row)return;
    dragging={type:row.dataset.dragType,id:row.dataset.dragId};
    e.dataTransfer.setData(type,JSON.stringify(dragging));e.dataTransfer.effectAllowed='move';row.classList.add('dragging');
  });
  panel.addEventListener('dragover',e=>{
    if(!dragging)return;
    let row=itemFrom(e.target)||e.target.closest('[data-folder]');
    if(!row){const area=e.target.closest('.library-documents');if(area)row=area;else return;}
    let target={type:row.dataset.dragType||'folder',id:row.dataset.dragId??row.dataset.folder??panel.dataset.currentFolder};
    if(target.id==='all'&&dragging.type==='doc'&&row.classList.contains('library-documents'))return;
    const rect=row.getBoundingClientRect(),fraction=(e.clientY-rect.top)/rect.height;
    const place=target.type==='folder'?(row.dataset.dragType?(fraction<.24?'before':fraction>.76?'after':'inside'):'inside'):(fraction<.5?'before':'after');
    if(target.type!==dragging.type&&place!=='inside')return;
    e.preventDefault();e.dataTransfer.dropEffect='move';
    panel.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach(el=>el.classList.remove('drop-before','drop-after','drop-inside'));
    row.classList.add('drop-'+place);marker={target,place};
  });
  panel.addEventListener('drop',e=>{if(!dragging||!marker)return;e.preventDefault();const {target,place}=marker;if(!move(dragging,target,place))noteApp.toast('不能移动到这个位置');clear();dragging=null;});
  panel.addEventListener('dragend',()=>{clear();dragging=null;});
  panel.addEventListener('keydown',e=>{
    if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;
    const row=itemFrom(e.target);if(!row)return;e.preventDefault();
    const source={type:row.dataset.dragType,id:row.dataset.dragId};
    const {library}=noteApp.getState(),list=source.type==='folder'?library.folders:library.documents;
    const item=list.find(x=>x.id===source.id),key=source.type==='folder'?'parentId':'folderId';
    const siblings=list.filter(x=>x[key]===item[key]),at=siblings.indexOf(item),other=siblings[at+(e.key==='ArrowUp'?-1:1)];
    if(other){move(source,{type:source.type,id:other.id},e.key==='ArrowUp'?'before':'after');panel.querySelector('[data-drag-id="'+source.id+'"]')?.focus();}
  });
})();
