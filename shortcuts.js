(() => {
  'use strict';
  const $=selector=>document.querySelector(selector),editor=window.noteEditor;
  const panel=$('#shortcutsPanel'),toggle=$('#shortcutsToggle'),search=$('#shortcutsSearch');
  const primary=/Mac|iPhone|iPad/.test(navigator.platform)?'⌘':'Ctrl';
  let previousFocus=null;
  function showPanel(open=panel.hidden){
    // The panel is nonmodal: editing and reading the reference remain independent.
    if(open){previousFocus=document.activeElement;panel.hidden=false;document.body.classList.add('shortcuts-open');search.focus({preventScroll:true});}
    else {const restoreFocus=panel.contains(document.activeElement);panel.hidden=true;document.body.classList.remove('shortcuts-open');if(restoreFocus)(previousFocus?.isConnected?previousFocus:toggle).focus({preventScroll:true});}
    toggle.setAttribute('aria-expanded',String(open));
  }
  const command=(name,value)=>()=>{editor.remember();editor[name](value);};
  const shortcuts=[
    {group:'常规',name:'打开 / 关闭快捷键帮助',keys:[['Mod','Alt','/']],codes:['Slash'],alt:true,shift:null,run:()=>showPanel(panel.hidden)},
    {group:'常规',name:'保存并同步文档',keys:[['Mod','S']],codes:['KeyS'],run:()=>{noteApp.save();if(window.noteCloud?.getState().user)noteCloud.sync();else noteApp.toast('已保存到本机');}},
    {group:'常规',name:'打开文件库',keys:[['Mod','Alt','O']],codes:['KeyO'],alt:true,run:()=>$('#libraryToggle').click()},
    {group:'常规',name:'新建空白文档',keys:[['Mod','Alt','N']],codes:['KeyN'],alt:true,run:()=>$('#newBtn').click()},
    {group:'常规',name:'切换编辑 / 预览',keys:[['Mod','Alt','P']],codes:['KeyP'],alt:true,run:()=>$('[data-view="'+(document.body.classList.contains('preview-mode')?'edit':'preview')+'"]').click()},
    {group:'常规',name:'查找圣经经文',keys:[['Mod','Alt','B']],codes:['KeyB'],alt:true,run:()=>$('#bibleOpen').click()},
    {group:'常规',name:'撤销',keys:[['Mod','Z']],codes:['KeyZ'],editing:true,run:command('format','undo')},
    {group:'常规',name:'重做',keys:[['Mod','Shift','Z'],['Mod','Y']],codes:['KeyZ'],shift:true,editing:true,run:command('format','redo'),alternate:{codes:['KeyY']}},
    {group:'常规',name:'复制',keys:[['Mod','C']]},
    {group:'常规',name:'剪切',keys:[['Mod','X']]},
    {group:'常规',name:'粘贴',keys:[['Mod','V']]},
    {group:'常规',name:'粘贴为纯文本',keys:[['Mod','Shift','V']]},
    {group:'常规',name:'全选当前编辑区',keys:[['Mod','A']]},
    {group:'常规',name:'查找页面文字',keys:[['Mod','F']]},
    {group:'文本格式',name:'加粗',keys:[['Mod','B']],codes:['KeyB'],editing:true,run:command('format','bold')},
    {group:'文本格式',name:'斜体',keys:[['Mod','I']],codes:['KeyI'],editing:true,run:command('format','italic')},
    {group:'文本格式',name:'下划线',keys:[['Mod','U']],codes:['KeyU'],editing:true,run:command('format','underline')},
    {group:'文本格式',name:'删除线',keys:[['Mod','Shift','X']],codes:['KeyX'],shift:true,editing:true,run:command('format','strikeThrough')},
    {group:'文本格式',name:'黄色高亮',keys:[['Mod','Shift','H']],codes:['KeyH'],shift:true,editing:true,run:()=>{editor.remember();editor.format('hiliteColor','#fef08a');}},
    {group:'文本格式',name:'增大字号（最大 72）',keys:[['Mod','Alt','+']],codes:['Equal','NumpadAdd'],alt:true,shift:null,editing:true,run:command('adjustFontSize',1)},
    {group:'文本格式',name:'减小字号',keys:[['Mod','Alt','−']],codes:['Minus','NumpadSubtract'],alt:true,shift:null,editing:true,run:command('adjustFontSize',-1)},
    {group:'文本格式',name:'恢复默认字号',keys:[['Mod','Alt','0']],codes:['Digit0'],alt:true,editing:true,run:command('resetSize')},
    {group:'文本格式',name:'清除文字标注',keys:[['Mod','\\']],codes:['Backslash'],editing:true,run:command('format','removeFormat')},
    ...['一','二','三','四','五','六'].map((label,index)=>({group:'标题与列表',name:label+'级标题',keys:[['Mod','Alt',String(index+1)]],codes:['Digit'+(index+1)],alt:true,editing:true,run:command('textType','h'+(index+1))})),
    {group:'标题与列表',name:'普通文本',keys:[['Mod','Shift','0']],codes:['Digit0'],shift:true,editing:true,run:command('textType','p')},
    {group:'标题与列表',name:'插入有序列表',keys:[['Mod','Shift','7']],codes:['Digit7'],shift:true,editing:true,run:command('insertList','ordered')},
    {group:'标题与列表',name:'插入无序列表',keys:[['Mod','Shift','8']],codes:['Digit8'],shift:true,editing:true,run:command('insertList','unordered')},
    {group:'标题与列表',name:'插入任务列表',keys:[['Mod','Shift','9']],codes:['Digit9'],shift:true,editing:true,run:command('insertList','task')},
    {group:'文件库',name:'向上 / 向下排序选中项',keys:[['Alt','↑'],['Alt','↓']]},
    {group:'面板',name:'关闭弹窗或快捷键面板',keys:[['Esc']]}
  ];
  function draw(){
    const query=search.value.trim().toLowerCase().replace(/[\s+]/g,'');
    const filtered=shortcuts.filter(item=>(item.name+item.keys.flat().map(key=>key==='Mod'?primary:key).join('')).toLowerCase().replace(/[\s+]/g,'').includes(query));
    const list=$('#shortcutsList');list.replaceChildren();
    for(const group of new Set(filtered.map(item=>item.group))){
      const section=document.createElement('section'),title=document.createElement('h3');title.textContent=group;section.append(title);
      for(const item of filtered.filter(item=>item.group===group)){
        const row=document.createElement('div'),label=document.createElement('span'),keys=document.createElement('span');row.className='shortcut-row';keys.className='shortcut-keys';label.textContent=item.name;
        item.keys.forEach((combo,index)=>{if(index){const or=document.createElement('span');or.className='shortcut-or';or.textContent='或';keys.append(or);}const chord=document.createElement('span');chord.className='shortcut-chord';for(const key of combo){const cap=document.createElement('kbd');cap.textContent=key==='Mod'?primary:key;chord.append(cap);}keys.append(chord);});
        row.append(label,keys);section.append(row);
      }
      list.append(section);
    }
    if(!filtered.length){const empty=document.createElement('p');empty.className='shortcuts-empty';empty.textContent='没有匹配的快捷键，试试“标题”“列表”或“Ctrl”。';list.append(empty);}
  }
  function matches(event,spec){return spec.codes?.includes(event.code)&&event.altKey===!!spec.alt&&(spec.shift===null||event.shiftKey===!!spec.shift);}
  toggle.addEventListener('click',()=>showPanel(panel.hidden));
  $('#shortcutsClose').addEventListener('click',()=>showPanel(false));
  search.addEventListener('input',draw);
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.getModifierState('AltGraph')||document.querySelector('dialog[open]'))return;
    if(event.key==='Escape'&&!panel.hidden){event.preventDefault();showPanel(false);return;}
    if(!(event.ctrlKey||event.metaKey)||event.ctrlKey&&event.metaKey)return;
    const inEditor=!!event.target.closest('.rich-editor')&&!document.body.classList.contains('preview-mode');
    const item=shortcuts.find(item=>item.run&&(!item.editing||inEditor)&&(matches(event,item)||item.alternate&&matches(event,item.alternate)));
    if(!item)return;
    event.preventDefault();item.run();
  });
  draw();
})();
