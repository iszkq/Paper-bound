async page => {
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}}),test=await context.newPage(),errors=[];
  const check=(value,message)=>{if(!value)throw Error(message);};
  test.on('pageerror',error=>errors.push(error.message));
  try {
    await test.goto('http://127.0.0.1:4173/index.html');
    await test.waitForFunction(()=>window.noteCloud);
    await test.evaluate(()=>noteCloud.ready);
    const editor=test.locator('.paragraph-text').first();
    async function select(start,end){await editor.evaluate((el,[from,to])=>{el.focus();let at=0,first,last,w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(!first&&from<at+n.length)first=[n,from-at];if(to<=at+n.length){last=[n,to-at];break;}at+=n.length;}const r=document.createRange();r.setStart(...first);r.setEnd(...last);const s=getSelection();s.removeAllRanges();s.addRange(r);noteEditor.remember();},[start,end]);}
    async function seed(html){await editor.evaluate((el,html)=>{el.innerHTML=html;el.dispatchEvent(new InputEvent('input',{bubbles:true}));},html);await select(0,(await editor.textContent()).length);}
    async function states(){return editor.evaluate(el=>{const out=[],w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(!n.length)continue;const css=getComputedStyle(n.parentElement),lines=[];for(let p=n.parentElement;p&&el.contains(p);p=p.parentElement){const c=getComputedStyle(p);if(c.textDecorationLine.includes('underline'))lines.push(c.textDecorationStyle);}for(const char of n.textContent)out.push({char,lines,bold:Number(css.fontWeight)>=600,color:css.color,size:css.fontSize,italic:css.fontStyle,background:css.backgroundColor});}return out;});}
    async function clear(palette){await test.locator('[data-palette='+palette+'] > summary').click();await test.locator('[data-clear='+palette+']').click();}
    const nested='<strong><span style="color:#15803d;font-size:24px;font-style:italic;text-decoration:underline 2px #b73530;text-underline-offset:4px"><span style="text-decoration:underline wavy 2px #2563eb;text-underline-offset:4px">甲乙丙丁</span></span></strong>';
    for(const palette of ['underline','wave']){
      await seed(nested);await select(1,3);await clear(palette);
      const result=await states();
      check(result.map(s=>s.char).join('')==='甲乙丙丁','Clear changed text');
      check(result[0].lines.length===2&&result[3].lines.length===2,'Partial clear changed unselected annotations');
      check(result[1].lines.length===0&&result[2].lines.length===0,'Partial clear left overlapping underlines');
      check(result.every(s=>s.bold&&s.italic==='italic'&&s.size==='24px'&&s.color==='rgb(21, 128, 61)'),'Clear removed unrelated formatting');
      check(await test.evaluate(()=>getSelection().toString())==='乙丙','Partial clear lost selection');
      await editor.press('ControlOrMeta+Z');check((await states()).every(s=>s.lines.length===2),'Undo did not restore overlapping annotations');
      await editor.press('ControlOrMeta+Shift+Z');check(JSON.stringify(await states())===JSON.stringify(result),'Redo did not restore partial clear exactly');
      await select(1,3);
      await clear(palette);check((await states()).slice(1,3).every(s=>s.lines.length===0),'Clearing twice added an underline');
    }
    await seed('甲<span style="text-decoration:underline wavy 2px #b73530">乙</span>丙<u>丁</u>');
    await clear('wave');check((await states()).every(s=>!s.lines.length),'Clear failed on mixed annotated/plain selection');
    await seed('<u>旧式下划线</u>');await editor.press('ControlOrMeta+U');check((await states()).every(s=>!s.lines.length),'Shortcut did not remove legacy underline');
    await seed('<span style="text-decoration:underline wavy 3px blue">蓝色波浪线</span>');await editor.press('ControlOrMeta+Shift+U');check((await states()).every(s=>!s.lines.length),'Shortcut did not remove a custom wave');
    await seed('<p style="text-decoration:underline wavy red">甲乙</p><p><s><span style="text-decoration:underline blue">丙丁</span></s></p>');
    await select(1,3);await clear('underline');
    const blocks=await states();check(blocks[0].lines.length===1&&blocks[1].lines.length===0&&blocks[2].lines.length===0&&blocks[3].lines.length===1,'Clear across paragraphs changed the wrong text');
    check(await editor.locator('p').count()===2&&await editor.locator('s').count()===1,'Clear removed paragraph or strike formatting');
    for(const [key,style] of [['ControlOrMeta+U','solid'],['ControlOrMeta+Shift+U','wavy']]){
      await seed('<strong>标注测试</strong>');await editor.press(key);
      check((await states()).every(s=>s.bold&&s.lines.includes(style)),'Applying annotation lost bold text');
      await editor.press(key);check((await states()).every(s=>s.bold&&!s.lines.length),'Second shortcut did not cancel annotation');
    }
    for(const [key,property,enabled] of [['ControlOrMeta+B','bold',true],['ControlOrMeta+I','italic','italic']]){
      await seed('快捷键检查');await editor.press(key);check((await states()).every(s=>s[property]===enabled),'Native toggle did not apply: '+key);await editor.press(key);check((await states()).every(s=>s[property]!==enabled),'Native toggle did not cancel: '+key);
    }
    await seed('删除线检查');await editor.press('ControlOrMeta+Shift+X');check(await editor.evaluate(el=>Array.from(el.querySelectorAll('*')).some(n=>getComputedStyle(n).textDecorationLine.includes('line-through'))),'Strike shortcut did not apply');await editor.press('ControlOrMeta+Shift+X');check(!await editor.evaluate(el=>Array.from(el.querySelectorAll('*')).some(n=>getComputedStyle(n).textDecorationLine.includes('line-through'))),'Strike shortcut did not toggle off');
    await seed(nested);await clear('underline');await test.evaluate(()=>noteApp.save());await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    check((await states()).every(s=>!s.lines.length&&s.bold),'Cleared annotations returned after reload');
    check(!errors.length,'Browser errors: '+errors.join('; '));
    await test.screenshot({path:'output/playwright/cleared-overlapping-lines.png'});
    return {passed:true,partialClear:true,mixedClear:true,repeatedClear:true,legacyShortcuts:true,boldAndItalicToggle:true,reloadPreserved:true,errors};
  } finally {await context.close();}
}
