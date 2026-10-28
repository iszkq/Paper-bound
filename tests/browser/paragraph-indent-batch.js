async page => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}}),test=await context.newPage(),errors=[];
 const check=(value,message)=>{if(!value)throw Error(message);};test.on('pageerror',e=>errors.push(e.message));
 try{
  await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  const editor=test.locator('.paragraph-text').first(),button=test.locator('#paragraphIndent');
  async function seed(html){await editor.evaluate((e,h)=>{e.innerHTML=h;e.dispatchEvent(new InputEvent('input',{bubbles:true}));},html);}
  async function select(start,end,reverse=false){await editor.evaluate((e,{start,end,reverse})=>{const points=[],w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let pos=0;while(w.nextNode()){const n=w.currentNode;if(n.length)points.push({n,start:pos,end:pos+n.length});pos+=n.length;}const point=offset=>{const p=points.find(p=>offset>=p.start&&offset<p.end)||points.at(-1);return [p.n,offset-p.start];};const a=point(start),b=point(end),s=getSelection();e.focus();s.removeAllRanges();s.setBaseAndExtent(...(reverse?b:a),...(reverse?a:b));noteEditor.remember();},{start,end,reverse});}
  async function flags(){return editor.evaluate(e=>Array.from(e.querySelectorAll('[data-first-indent]'),p=>({text:p.textContent,indent:p.dataset.firstIndent})));}
  const p=text=>'<p><strong><span style="background-color:#fef08a;color:#15803d">'+text+'</span></strong></p>';
  for(const structure of ['paragraphs','divs','bare','wrapped-inline']){
   const body=structure==='paragraphs'?p('甲乙')+p('丙丁')+p('戊己'):structure==='divs'?'<div>'+p('甲乙')+'<div>丙丁</div>'+p('戊己')+'</div>':structure==='bare'?'甲乙<br><span style="background-color:#fef08a">丙丁</span><br>戊己':'<span style="background-color:#fef08a">甲乙<br>丙丁<br>戊己</span>';
   await seed(body+p('庚辛'));await select(1,5,structure==='divs');const selected=await test.evaluate(()=>getSelection().getRangeAt(0).toString());
   await button.click();const result=await flags();check(result.length===3&&result.every(p=>p.indent==='off'),'Batch did not disable all three paragraphs: '+structure+' '+JSON.stringify(result));check(await test.evaluate(()=>getSelection().getRangeAt(0).toString())===selected,'Batch lost selected characters: '+structure);
   check(await editor.locator('span p,span div').count()===0,'Batch created a paragraph inside an inline annotation');
   check(await editor.textContent()==='甲乙丙丁戊己庚辛','Batch changed text: '+structure);
   check(await editor.locator('p').last().getAttribute('data-first-indent')===null,'Batch changed unselected paragraph: '+structure);
   await editor.press('ControlOrMeta+Z');check((await flags()).length===0,'Batch undo did not restore all paragraphs: '+structure);await editor.press('ControlOrMeta+Shift+Z');check(JSON.stringify(await flags())===JSON.stringify(result),'Batch redo differs: '+structure);
   await select(1,5);await button.click();check((await flags()).every(p=>p.indent==='on'),'Batch did not restore every paragraph: '+structure);
  }
  await seed('<p data-first-indent="off">甲乙</p><p>丙丁</p><p data-first-indent="off">戊己</p>'+p('庚辛'));
  await select(0,6);check(await button.getAttribute('aria-pressed')==='mixed','Mixed selection not shown');await button.click();check((await flags()).every(p=>p.indent==='on'),'Mixed selection toggled paragraphs in opposite directions');await button.click();check((await flags()).every(p=>p.indent==='off'),'Second click did not clear mixed selection uniformly');
  // End exactly at the next paragraph start should not change that paragraph.
  await seed(p('甲乙')+p('丙丁')+p('戊己'));await select(0,4);await button.click();check((await flags()).length===2,'Selected end at next paragraph start modified it');
  // A selection that starts in a list can still act on selected prose.
  await seed('<ol start="5"><li>列表</li></ol><h2>标题</h2>'+p('甲乙')+'<p><br></p>'+p('丙丁')+p('戊己'));
  await select(0,8);check(!await button.isDisabled(),'List at selection start disabled prose batch');await button.click();check((await flags()).length===3,'Batch missed selected prose/empty paragraphs');check(await editor.locator('li[data-first-indent],h2[data-first-indent]').count()===0,'Batch changed list or heading');check(await editor.locator('ol').getAttribute('start')==='5','Batch changed numbering');
  await test.evaluate(()=>noteApp.save());await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  for(const layout of ['handout','table']){await test.locator('[data-view="preview"]').click();await test.locator('[data-layout="'+layout+'"]').click();check(await test.locator('.paper-paragraph [data-first-indent="off"]').count()===3,'Batch setting was lost after saving');for(const para of await test.locator('.paper-paragraph [data-first-indent="off"]').all())check(await para.evaluate(e=>parseFloat(getComputedStyle(e).textIndent))===0,'Preview ignored batch');check(await test.locator('.paper-paragraph p').last().evaluate(e=>parseFloat(getComputedStyle(e).textIndent))>0,'Preview changed unselected prose');await test.locator('[data-view="edit"]').click();}
  // Collapsed caret in bare text after BR must affect that line, not the first.
  await seed('甲乙<br>丙丁<br>戊己');await select(3,3);await button.click();check((await flags()).length===1&&(await flags())[0].text==='丙丁','Collapsed caret applied to the wrong bare line');
  await seed(p('甲乙')+p('丙丁')+p('戊己'));await editor.press('ControlOrMeta+A');await button.click();check((await flags()).length===3,'Select-all batch missed a paragraph');
  await test.locator('[data-view="preview"]').click();await test.locator('#paper').screenshot({path:'output/playwright/batch-paragraph-indent.png'});check(!errors.length,'Browser errors: '+errors.join(';'));
  return {passed:true,multipleParagraphs:true,rawLines:true,nestedInline:true,mixedState:true,selectionBoundary:true,partialAndReverseSelection:true,emptyParagraphs:true,skipsListsAndHeadings:true,undoRedo:true,reload:true,bothLayouts:true,selectAll:true,errors};
 }finally{await context.close();}
}
