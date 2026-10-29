async page => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:1050}}),test=await context.newPage(),errors=[];
 const check=(value,message)=>{if(!value)throw Error(message);};test.on('pageerror',e=>errors.push(e.message));
 try {
  await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  const editor=test.locator('.paragraph-text').first(),button=test.locator('#paragraphIndent');
  const copy='这句话需要单独设置首行缩进。',marked='<strong><span style="background-color:#fef08a;color:#15803d">'+copy+'</span></strong>';
  async function seed(html){await editor.evaluate((e,h)=>{e.innerHTML=h;e.dispatchEvent(new InputEvent('input',{bubbles:true}));},html);}
  async function editorIndent(expected){
   const g=await editor.evaluate(e=>{const block=e.querySelector('[data-first-indent]')||e.querySelector('p,div')||e,style=getComputedStyle(block);return {indent:parseFloat(style.textIndent),size:parseFloat(style.fontSize)};});
   check(Math.abs(g.indent-(expected?2*g.size:0))<1,'Editing text does not match preview first-line indentation: '+JSON.stringify(g));
  }
  async function caret(selector,selected=false){await editor.evaluate((e,{selector,selected,copy})=>{const parent=selector?e.querySelector(selector):e,w=document.createTreeWalker(parent,NodeFilter.SHOW_TEXT);let node;while(w.nextNode())if(w.currentNode.textContent.includes(copy)){node=w.currentNode;break;}if(!node){w.currentNode=parent;while(w.nextNode())if(w.currentNode.length){node=w.currentNode;break;}}const r=document.createRange();r.setStart(node,selected?0:Math.min(3,node.length));if(selected)r.setEnd(node,node.length);else r.collapse(true);e.focus();getSelection().removeAllRanges();getSelection().addRange(r);noteEditor.remember();},{selector,selected,copy});}
  async function preview(expected){
   await test.locator('[data-view="preview"]').click();
   for(const layout of ['handout','table']){
    await test.locator('[data-layout="'+layout+'"]').click();
    const p=test.locator('.paper-paragraph p').filter({hasText:copy});check(await p.count()===1,'Preview did not retain independent paragraph');
    const g=await p.evaluate(e=>{const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);w.nextNode();const r=document.createRange();r.setStart(w.currentNode,0);r.setEnd(w.currentNode,1);return {indent:r.getBoundingClientRect().x-e.getBoundingClientRect().x,size:parseFloat(getComputedStyle(e).fontSize),bg:getComputedStyle(e.querySelector('span')).backgroundColor};});
    check(Math.abs(g.indent-(expected?2*g.size:0))<1,'Wrong individual indentation: '+layout+' '+JSON.stringify(g));check(g.bg==='rgb(254, 240, 138)','Indent setting lost highlight');
    check(await test.locator('.paper-paragraph > p').last().evaluate(e=>parseFloat(getComputedStyle(e).textIndent)>0),'Changing one paragraph changed the next paragraph');
    check(await test.locator('.paper-paragraph li').first().evaluate(e=>parseFloat(getComputedStyle(e).textIndent))===0,'Changing prose indented list');
   }
   await test.locator('[data-view="edit"]').click();
  }
  for(const suffix of ['<p>'+marked+'</p>','<div>'+marked+'</div>',marked,'<br>'+marked]){
   await seed('<ol start="5"><li>第五点</li><li>第六点</li></ol>'+suffix+'<p>其他段落保留缩进。</p>');
   await editorIndent(true);
   await caret(null,true);await button.click();check(await button.getAttribute('aria-pressed')==='false','Toggle did not disable paragraph indent');
   check(await test.evaluate(()=>getSelection().toString())===copy,'Toggle lost selected text');check(await editor.locator('[data-first-indent="off"]').count()===1,'Indent was not saved on one paragraph');
   await editorIndent(false);
   await preview(false);await caret('[data-first-indent="off"]');await editor.press('ControlOrMeta+Z');check(await editor.locator('[data-first-indent="off"]').count()===0,'Cannot undo indentation');await editor.press('ControlOrMeta+Shift+Z');check(await editor.locator('[data-first-indent="off"]').count()===1,'Cannot redo indentation');
   await caret('[data-first-indent="off"]');await button.click();check(await button.getAttribute('aria-pressed')==='true','Toggle did not restore two-character indent');await editorIndent(true);await preview(true);
   await caret('[data-first-indent="on"]');await button.click();await test.evaluate(()=>noteApp.save());await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);await preview(false);
  }
  // Format painter copies text formatting while retaining paragraph indentation.
  await editor.evaluate(e=>{const el=e.querySelector('p:last-child'),r=document.createRange();r.selectNodeContents(el);e.focus();getSelection().removeAllRanges();getSelection().addRange(r);noteEditor.remember();});
  await test.locator('#formatPainter').click();await caret('[data-first-indent="off"]',true);await editor.evaluate(e=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0}));});await test.waitForTimeout(30);
  check(await editor.locator('[data-first-indent="off"]').count()===1,'Format painter removed paragraph indentation setting');
  await editor.evaluate(e=>{const li=e.querySelector('li'),r=document.createRange();r.selectNodeContents(li);r.collapse(true);e.focus();getSelection().removeAllRanges();getSelection().addRange(r);noteEditor.remember();});check(await button.isDisabled(),'Indent control should be disabled in a list');
  await caret('[data-first-indent="off"]');await button.click();await test.locator('[data-view="preview"]').click();await test.locator('[data-layout="handout"]').click();await test.locator('#paper').screenshot({path:'output/playwright/individual-paragraph-indent.png'});
  await test.setViewportSize({width:390,height:844});await test.locator('[data-view="edit"]').click();check(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Toolbar overflowed on mobile');
  check(!errors.length,'Browser errors: '+errors.join(';'));
  return {passed:true,perParagraph:true,legacyStructures:true,undoRedo:true,restoresIndent:true,selectedTextPreserved:true,otherParagraphsUnaffected:true,bothLayouts:true,reload:true,painterCompatible:true,mobile:true,errors};
 }finally{await context.close();}
}
