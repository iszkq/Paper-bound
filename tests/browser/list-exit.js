async page => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:1050}}),test=await context.newPage(),errors=[];
 const check=(value,message)=>{if(!value)throw Error(message);};test.on('pageerror',e=>errors.push(e.message));
 try{
  await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  const editor=test.locator('.paragraph-text').first(),outdent=test.locator('[data-list-action="outdent"]');
  const marked='<strong><span style="background-color:#fef08a;color:#15803d">目标文字</span></strong>';
  async function seed(html){await editor.evaluate((e,h)=>{e.innerHTML=h;e.dispatchEvent(new InputEvent('input',{bubbles:true}));},html);}
  async function place(selectAll=false){await editor.evaluate((e,selectAll)=>{const span=Array.from(e.querySelectorAll('span')).find(n=>n.textContent==='目标文字'),r=document.createRange();if(selectAll)r.selectNodeContents(span);else{r.setStart(span.firstChild,2);r.collapse(true);}e.focus();getSelection().removeAllRanges();getSelection().addRange(r);noteEditor.remember();},selectAll);}
  async function level(){return editor.evaluate(e=>{const node=getSelection().anchorNode,el=node.nodeType===1?node:node.parentElement;let depth=0;for(let p=el;p&&p!==e;p=p.parentElement)if(p.matches('ol,ul'))depth++;return depth;});}
  async function action(menu){if(menu){await test.locator('summary[aria-label="列表"]').click();await outdent.click();}else await editor.press('Shift+Tab');}
  for(const type of ['ol','ul','task'])for(const menu of [false,true]){
   const tag=type==='ol'?'ol':'ul',attrs=type==='ol'?' start="5"':type==='task'?' data-task="true"':'';
   await seed('<'+tag+attrs+'><li>前项</li><li>'+marked+'</li><li>后项</li></'+tag+'>');await place();
   check(await test.locator('#textTypePicker').inputValue()==='list','List incorrectly shown as ordinary text');check((await outdent.textContent()).includes('取消列表'),'Root action does not explain cancellation');
   await action(menu);check(await level()===0,'Shift+Tab did not exit root list: '+type);check(await editor.textContent()==='前项目标文字后项','Exit changed order');check(await editor.locator('p strong span').textContent()==='目标文字','Exit lost text formatting');
   check(await editor.locator('li').count()===2,'Exit changed other items');if(type==='ol')check(await editor.locator('ol').last().getAttribute('start')==='7','Exit changed following numbering');
   await editor.press('ControlOrMeta+Z');check(await editor.locator('li').count()===3,'Exit cannot be undone');await editor.press('ControlOrMeta+Shift+Z');check(await editor.locator('li').count()===2,'Exit cannot be redone');
   await seed('<'+tag+attrs+'><li>前项</li><li>'+marked+'</li><li>后项</li></'+tag+'>');await place();await action(menu);await test.keyboard.insertText('光标');check(await editor.locator('p strong span').textContent()==='目标光标文字','Exit lost middle caret: '+await editor.innerHTML());
  }
  const nested='<ol start="3"><li>一级前文<ol start="4"><li>二级前文<ol start="6"><li>三级前项</li><li>'+marked+'</li><li>三级后项</li></ol>二级后文</li><li>二级后项</li></ol>一级后文</li><li>一级后项</li></ol>';
  for(const menu of [false,true]){
   await seed(nested);await place();check(await level()===3,'Seed did not create third-level item');
   for(const expected of [2,1,0]){check((await outdent.textContent()).includes(expected?'退回上一级':'取消列表'),'Action label does not reflect nesting');await action(menu);check(await level()===expected,'Unified action changed wrong number of levels: '+JSON.stringify({menu,expected,actual:await level(),html:await editor.innerHTML()}));}
   check(await editor.locator('p strong span').textContent()==='目标文字','Repeated unified action did not produce ordinary text');
  }
  // Selecting ordinary text in the type picker must really leave all list levels.
  for(const method of ['picker','shortcut']){
   await seed(nested);const original=await editor.textContent();await place(method==='picker');
   if(method==='picker')await test.locator('#textTypePicker').selectOption('p');else await editor.press('ControlOrMeta+Shift+0');
   check(await level()===0,'Ordinary-text command left an outer list ancestor');check(await editor.textContent()===original,'Direct exit reordered nested content');check(await editor.locator('li p strong span').count()===0,'Ordinary paragraph still belongs to a list item');
   await editor.press('ControlOrMeta+Z');check(await editor.textContent()===original&&await editor.locator('ol ol ol li').count()===3,'Direct nested exit undo failed');await editor.press('ControlOrMeta+Shift+Z');check(await editor.locator('p strong span').textContent()==='目标文字','Direct nested exit redo failed');
  }
  await test.evaluate(()=>noteApp.save());await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);check(await editor.locator('li p strong span').count()===0,'Reload nested exit restored list membership');
  check(await test.locator('[data-list-action="paragraph"]').count()===0,'Duplicate exit command remains');await place();check(await outdent.isDisabled(),'Ordinary prose still offers list outdent');
  await test.locator('summary[aria-label="列表"]').click();await test.screenshot({path:'output/playwright/unified-list-exit.png'});await test.setViewportSize({width:390,height:844});check(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'List menu overflows mobile');
  check(!errors.length,'Browser errors: '+errors.join(';'));
  return {passed:true,unifiedAction:true,rootTypes:true,middleCaret:true,nestedLevels:true,directNormalText:true,undoRedo:true,formatting:true,reload:true,mobile:true,errors};
 }finally{await context.close();}
}
