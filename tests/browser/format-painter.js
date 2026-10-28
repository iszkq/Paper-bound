async page => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}}),test=await context.newPage(),errors=[];
 const check=(v,m)=>{if(!v)throw Error(m);};
 test.on('pageerror',e=>errors.push(e.message));
 try{
  await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  const editor=test.locator('.paragraph-text').first(),note=test.locator('.annotation-text').first(),button=test.locator('#formatPainter');
  const source='<strong><span style="font-size:24px;color:#15803d;background-color:#fef08a;font-style:italic;text-decoration:underline 2px #b73530;text-underline-offset:4px"><span style="text-decoration:underline wavy 3px #2563eb;text-underline-offset:5px">格式来源</span></span></strong>';
  const target='<p><s><u><span style="font-size:32px;color:red;background-color:pink">甲乙丙丁戊己</span></u></s></p>';
  async function seed(el,html){await el.evaluate((e,h)=>{e.innerHTML=h;e.dispatchEvent(new InputEvent('input',{bubbles:true}));},html);}
  async function select(el,start,end){await el.evaluate((e,[a,b])=>{e.focus();const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let pos=0,first,last;while(w.nextNode()){const n=w.currentNode;if(!first&&a<pos+n.length)first=[n,a-pos];if(b<=pos+n.length){last=[n,b-pos];break;}pos+=n.length;}const r=document.createRange();r.setStart(...first);r.setEnd(...last);getSelection().removeAllRanges();getSelection().addRange(r);noteEditor.remember();},[start,end]);}
  async function states(el){return el.evaluate(e=>{const out=[],w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode,c=getComputedStyle(n.parentElement),lines=[];let bg='';for(let p=n.parentElement;p&&p!==e;p=p.parentElement){const s=getComputedStyle(p);if(!bg&&s.backgroundColor!=='rgba(0, 0, 0, 0)')bg=s.backgroundColor;if(s.textDecorationLine!=='none')lines.push([s.textDecorationLine,s.textDecorationStyle,s.textDecorationColor,s.textDecorationThickness,s.textUnderlineOffset]);}for(const char of n.textContent)out.push({char,bold:Number(c.fontWeight)>=600,italic:c.fontStyle,color:c.color,size:c.fontSize,bg,lines});}return out;});}
  async function release(el){await el.evaluate(e=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0}));});await test.waitForTimeout(30);}
  await seed(editor,source);await seed(note,target);await select(editor,0,4);const sourceState=await states(editor),before=await states(note);
  await button.click();check(await button.getAttribute('aria-pressed')==='true','Single click did not arm');
  await select(note,1,4);await release(note);check(await button.getAttribute('aria-pressed')==='false','One-shot did not stop');
  let result=await states(note);check(result.map(s=>s.char).join('')==='甲乙丙丁戊己','Painter changed target text');
  for(const s of result.slice(1,4))check(s.bold&&s.italic==='italic'&&s.size==='24px'&&s.color==='rgb(21, 128, 61)'&&s.bg==='rgb(254, 240, 138)'&&s.lines.length===2&&s.lines.some(l=>l[1]==='wavy')&&!s.lines.some(l=>l[0].includes('line-through')),'Copied styles incorrect: '+JSON.stringify(s));
  check(JSON.stringify(result[0])===JSON.stringify(before[0])&&JSON.stringify(result[5])===JSON.stringify(before[5]),'Painter changed unselected target text');
  check(JSON.stringify(await states(editor))===JSON.stringify(sourceState),'Painter changed source');check(await test.evaluate(()=>getSelection().toString())==='乙丙丁','Painter lost target selection');
  await note.press('ControlOrMeta+Z');check(JSON.stringify(await states(note))===JSON.stringify(before),'Painter undo did not restore target');
  await note.press('ControlOrMeta+Shift+Z');check(JSON.stringify(await states(note))===JSON.stringify(result),'Painter redo did not restore painted styles');
  await select(editor,0,4);await button.dblclick();check(await button.getAttribute('data-locked')==='true','Double click did not lock');
  for(const [a,b] of [[0,1],[4,6]]){await select(note,a,b);await release(note);check(await button.getAttribute('aria-pressed')==='true','Locked painter stopped');}
  check((await states(note)).every(s=>s.bold&&s.lines.length===2),'Locked painter did not paint every target');
  await note.press('Escape');check(await button.getAttribute('aria-pressed')==='false','Escape did not cancel');
  await seed(editor,'普通文字');await select(editor,0,4);await button.click();await select(note,0,6);await release(note);
  check((await states(note)).every(s=>!s.bold&&s.italic==='normal'&&s.size==='17px'&&!s.lines.length&&!s.bg),'Plain source did not remove old target styles');
  await seed(editor,source);await select(editor,0,4);await editor.press('ControlOrMeta+Shift+C');await select(note,0,6);await note.press('ControlOrMeta+Shift+V');check((await states(note)).every(s=>s.bold&&s.lines.length===2),'Keyboard format painter failed');await note.press('Escape');
  await test.evaluate(()=>noteApp.save());await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);check((await states(note)).every(s=>s.bold&&s.lines.length===2),'Painted formatting was not saved');
  // Actual mouse dragging must apply the brush, including reverse direction.
  await select(editor,0,4);await button.click();await note.scrollIntoViewIfNeeded();
  const points=await note.evaluate(e=>{const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);w.nextNode();const n=w.currentNode,r=document.createRange();r.setStart(n,0);r.setEnd(n,n.length);const b=r.getBoundingClientRect();return {x:b.x,y:b.y+b.height/2,right:b.right};});
  await test.mouse.move(points.right-1,points.y);await test.mouse.down();await test.mouse.move(points.x,points.y,{steps:8});await test.mouse.up();await test.waitForTimeout(50);check(await button.getAttribute('aria-pressed')==='false','Real mouse drag did not apply one-shot painter');
  // Clicking a word and painting across paragraphs preserve content and lists.
  await seed(note,'hello world');await select(editor,0,4);await button.click();
  const wordPoint=await note.evaluate(e=>{const r=document.createRange();r.setStart(e.firstChild,7);r.setEnd(e.firstChild,8);const b=r.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};});
  await test.mouse.click(wordPoint.x,wordPoint.y);await test.waitForTimeout(40);
  check((await states(note)).slice(6).every(s=>s.bold&&s.lines.length===2)&&(await states(note)).slice(0,5).every(s=>!s.bold),'Single word click did not paint only the clicked word');
  await seed(note,'<ol start="3"><li><span style="color:red">甲乙</span><ol start="2"><li>丙丁</li></ol></li><li value="7">戊己</li></ol><p><sub>庚</sub>辛</p>');
  await select(editor,0,4);await button.click();const beforeList=await states(note);await select(note,1,6);await release(note);
  check(await note.locator('ol').count()===2&&await note.locator('li').count()===3&&await note.locator('ol').first().getAttribute('start')==='3'&&await note.locator('li[value="7"]').count()===1,'Painting changed nested list structure or numbering');
  check(await note.textContent()==='甲乙丙丁戊己庚辛','Painting across paragraphs changed text');
  await note.press('ControlOrMeta+Z');check(JSON.stringify(await states(note))===JSON.stringify(beforeList),'Undo list painting changed unselected formatting');await note.press('ControlOrMeta+Shift+Z');
  await select(editor,0,4);await button.click();await button.click();check(await button.getAttribute('aria-pressed')==='false','Clicking active brush did not cancel');
  const unchanged=await states(note);await select(note,0,1);await release(note);check(JSON.stringify(await states(note))===JSON.stringify(unchanged),'Cancelled brush still painted');
  await select(editor,0,4);await button.dblclick();await test.locator('[data-view="preview"]').click();check(await button.getAttribute('aria-pressed')==='false','Preview did not cancel painter');await test.locator('[data-view="edit"]').click();
  await test.setViewportSize({width:390,height:844});check(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Painter toolbar overflowed on mobile');
  await test.setViewportSize({width:1440,height:1000});await select(editor,0,4);await button.dblclick();await test.screenshot({path:'output/playwright/format-painter.png'});check(!errors.length,'Browser errors: '+errors.join(';'));
  return {passed:true,oneShot:true,locked:true,escape:true,partialSelection:true,replacesOldFormatting:true,overlappingLines:true,crossEditors:true,undoRedo:true,keyboard:true,reload:true,mouseDrag:true,wordClick:true,nestedLists:true,mobile:true,errors};
 }finally{await context.close();}
}
