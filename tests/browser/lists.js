async page => {
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1050}}),test=await context.newPage(),errors=[];let stage='load';test.setDefaultTimeout(6000);
  const check=(value,message)=>{if(!value)throw Error(stage+': '+message);};
  const results=[];
  test.on('pageerror',error=>errors.push(error.message));
  try {
    await test.goto('http://127.0.0.1:4173/index.html');
    await test.waitForFunction(()=>window.noteCloud);
    await test.evaluate(()=>noteCloud.ready);
    const editor=test.locator('.paragraph-text').first(),ime=await context.newCDPSession(test);
    async function seed(html){await editor.evaluate((el,html)=>{el.innerHTML=html;el.dispatchEvent(new InputEvent('input',{bubbles:true}));el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);noteEditor.remember();},html);}
    async function caret(selector,offset){await editor.evaluate((el,{selector,offset})=>{const target=selector?el.querySelector(selector):el,walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let node,remaining=offset;while(walker.nextNode()){node=walker.currentNode;if(remaining<=node.length)break;remaining-=node.length;}const r=document.createRange();if(node)r.setStart(node,remaining);else r.selectNodeContents(target);r.collapse(true);el.focus();const s=getSelection();s.removeAllRanges();s.addRange(r);noteEditor.remember();},{selector,offset});}
    async function menu(kind){await test.locator('summary[aria-label="列表"]').click();await test.locator('[data-list="'+kind+'"]').click();}
    async function shape(){return editor.evaluate(el=>({html:el.innerHTML,text:el.textContent,items:el.querySelectorAll('li').length,levels:Array.from(el.querySelectorAll('li')).map(li=>{let depth=0;for(let p=li.parentElement;p&&el.contains(p);p=p.parentElement)if(p.matches('ol,ul'))depth++;return depth;})}));}
    async function caretInItem(){return editor.evaluate(el=>{const node=getSelection().anchorNode,element=node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement;return !!element?.closest('li')&&el.contains(element);});}
    async function compose(text){await ime.send('Input.imeSetComposition',{text:'chengdu',selectionStart:7,selectionEnd:7});await ime.send('Input.insertText',{text});}

    // Real toolbar interaction must wrap the whole paragraph, retaining the caret.
    stage='paragraph conversion';
    for(const kind of ['ordered','unordered','task']){
      await seed('<p>前一段</p><p>点击顶部<strong>文件库</strong>，可以新建文件夹。</p><p>后一段</p>');
      await caret('strong',1);await menu(kind);
      check(await editor.locator('li').count()===1,'Toolbar inserted an empty item: '+kind);
      check(await editor.locator('li').textContent()==='点击顶部文件库，可以新建文件夹。','Toolbar split the current paragraph: '+kind);
      check((await editor.textContent())==='前一段点击顶部文件库，可以新建文件夹。后一段','Toolbar changed surrounding text: '+kind);
      check(await editor.locator('strong').count()===1,'Toolbar discarded inline formatting: '+kind);
      await test.keyboard.insertText('光标');check((await editor.locator('li').textContent()).includes('文光标件库'),'Toolbar lost caret position: '+kind);
      await menu(kind);check(await editor.locator('li').count()===0,'Clicking the same list did not toggle it off: '+kind);
    }
    results.push('paragraph conversion and toggles');
    await seed('段落标题<br>点击顶部「文件库」，可以新建文件夹。<br>点击名称即可打开。');
    await caret('',12);await menu('ordered');
    check((await editor.locator('li').first().textContent()).includes('点击顶部「文件库」'),'Legacy BR content was split at the caret');
    check(!(await editor.locator('li').first().textContent()).includes('段落标题'),'Adjacent logical line was converted');
    await editor.press('ControlOrMeta+Z');check(await editor.locator('ol').count()===0,'Toolbar conversion cannot be undone');
    await editor.press('ControlOrMeta+Shift+Z');check(await editor.locator('ol').count()===1,'Toolbar conversion cannot be redone');
    results.push('legacy paragraphs and undo');

    stage='number shortcuts';for(const start of [1,2,3,12]){stage='number shortcut '+start;
      await seed('');await editor.pressSequentially(start+'.');await editor.press('Space');
      const actual=await editor.evaluate(el=>({html:el.innerHTML,start:el.querySelector('ol')?.start,items:el.querySelectorAll('li').length}));
      check(actual.items===1&&actual.start===start,'Number plus space did not create the requested list: '+JSON.stringify(actual));
      check(await caretInItem(),'Empty-list caret is outside the item');
      await compose('从指定编号开始');check(await editor.locator('li').first().textContent()==='从指定编号开始','Chinese composition escaped the new list');
      await editor.press('Enter');await test.keyboard.insertText('继续编号');
      check(await editor.locator('ol > li').count()===2,'Enter did not continue the list');
      check(!(await editor.textContent()).includes(start+'.'),'Typed marker was retained as literal text');
    }
    await seed('<p>保留前段</p><p>3.<strong>后续正文</strong></p><p>保留后段</p>');await caret('p:nth-child(2)',2);await editor.press('Space');
    check(await editor.evaluate(el=>el.querySelector('ol')?.start)===3,'Marker before existing text was not converted: '+await editor.evaluate(el=>el.innerHTML));
    check(await editor.locator('li strong').textContent()==='后续正文','Marker conversion discarded following formatting');
    await seed('普通正文中间2.');await editor.press('Space');check(await editor.locator('ol').count()===0,'A marker inside prose unexpectedly created a list');
    await seed('标题<br>2.后续正文');await caret('',4);await editor.press('Space');
    check(await editor.evaluate(el=>el.querySelector('ol')?.start)===2,'Marker after BR did not create a list: '+await editor.evaluate(el=>el.innerHTML));
    results.push('typed markers and custom starts');
    await seed('1.');await editor.press('Space');await editor.press('ControlOrMeta+Z');
    check(await editor.textContent()==='1.'&&await editor.locator('ol').count()===0,'Undo did not restore the typed marker');
    await editor.press('ControlOrMeta+Shift+Z');await compose('重做后继续输入');
    check(await editor.locator('li').textContent()==='重做后继续输入','Chinese composition escaped the list after redo');

    stage='continue root list after nested items';
    const firstItem='<ol><li>第一点<ol><li>子项一</li><li>子项二</li></ol></li></ol>';
    for(const suffix of ['2.','<div>2.</div>','<p>2.</p>','<br>2.']){
      await seed(firstItem+suffix);await editor.press('Space');
      check(await caretInItem(),'Continuing a root list did not place the caret inside its item: '+suffix);
      await compose('第二点正文');
      check(await editor.locator('li').filter({hasText:'第二点正文'}).count()===1,'Continuation text leaked outside the root item: '+await editor.innerHTML());
      check((await shape()).levels.join(',')==='1,2,2,1','Continuation was nested under an old item: '+await editor.innerHTML());
      check(await editor.locator('ol > li').filter({hasText:'第二点正文'}).count()===1,'Continuation created a separate nested root list: '+await editor.innerHTML());
      check(await editor.locator('ol[start="2"]').count()===1,'Continuation did not retain the second root number');
      check(!(await editor.textContent()).includes('2.'),'Root continuation retained the literal marker');
    }
    await seed(firstItem);await caret('ol ol li:last-child',3);await editor.press('Enter');await editor.press('Enter');await editor.press('Enter');
    await editor.pressSequentially('2.');await editor.press('Space');check(await caretInItem(),'Enter-based exit did not recognize the next root marker');
    await compose('返回一级后的内容');check(await editor.locator('li').filter({hasText:'返回一级后的内容'}).count()===1,'After exiting nesting, composition appeared above the list');
    results.push('Chinese composition and root-list continuation');

    stage='nesting';await seed('<ol start="2"><li>第一项</li><li>第二项</li><li>第三项</li></ol>');
    await caret('li:nth-child(2)',3);await editor.press('Tab');
    check((await shape()).levels.join(',')==='1,2,1','Tab did not nest under the previous item: '+JSON.stringify(await shape()));
    check(await test.evaluate(()=>document.activeElement.matches('.rich-editor')),'Tab moved focus out of the editor');
    await editor.press('Enter');await test.keyboard.insertText('准备三级');await editor.press('Tab');
    check((await shape()).levels.includes(3),'A second Tab level did not produce a third level');
    await editor.press('Shift+Tab');check(!(await shape()).levels.includes(3),'Shift+Tab did not reduce the level');
    await editor.press('Shift+Tab');
    check((await shape()).levels.filter(level=>level===1).length===3,'Outdent did not return the item to the root');
    await caret('ol > li',0);const before=await shape();await editor.press('Tab');check((await shape()).html===before.html,'The first item nested without a preceding parent');
    results.push('nested levels, outdent and focus');

    stage='explanation text';await seed('<ol start="2"><li>第一项</li><li>第二项</li></ol>');await caret('li',3);
    await editor.press('Shift+Enter');await test.keyboard.insertText('这段是不编号的说明');
    check(await editor.locator('li').count()===2,'Shift+Enter created another numbered item');
    check((await editor.locator('li').first().innerText()).includes('第一项\n这段是不编号的说明'),'The explanation did not stay with the first item');
    await editor.press('Enter');await test.keyboard.insertText('新的编号项');
    check(await editor.locator('li').count()===3,'Enter after an explanation did not resume numbering');
    await editor.press('Enter');await editor.press('Enter');await test.keyboard.insertText('退出列表后的普通正文');
    check(!(await editor.locator('ol').first().textContent()).includes('退出列表后的普通正文'),'Empty-item Enter did not exit the list');
    results.push('unnumbered explanations and empty-item exit');

    stage='save preview and mobile';await seed('<ol start="3"><li>开始编号<strong>加粗</strong><br>不编号的说明<ol start="2"><li>二级条目<ol><li>三级条目</li></ol></li></ol></li><li value="8">指定第八项</li></ol>');
    await test.evaluate(()=>noteApp.save());await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    check(await editor.locator('ol').first().evaluate(el=>el.start)===3,'Reload discarded the ordered-list start');
    check(await editor.locator('li[value="8"]').count()===1,'Reload discarded explicit item numbering');
    check(await editor.locator('ol ol ol li').textContent()==='三级条目','Reload discarded nested list structure');
    await test.locator('[data-view="preview"]').click();
    check(await test.locator('#paper ol').first().evaluate(el=>el.start)===3,'Preview discarded the list start');
    check(await test.locator('#paper li[value="8"]').count()===1,'Preview discarded explicit numbering');
    check(await test.locator('#paper ol ol ol li').textContent()==='三级条目','Preview discarded third-level structure');
    await test.locator('[data-view="edit"]').click();
    await test.locator('#shortcutsToggle').click();await test.locator('#shortcutsSearch').fill('不编号');
    check((await test.locator('#shortcutsList').innerText()).includes('Shift'),'Help does not explain unnumbered text');
    await test.locator('#shortcutsClose').click();
    await editor.screenshot({path:'output/playwright/ordered-lists.png'});
    await test.setViewportSize({width:390,height:844});await caret('li',0);await test.locator('summary[aria-label="列表"]').click();
    const bounds=await test.locator('.list-popover').boundingBox();check(bounds.x>=0&&bounds.x+bounds.width<=390,'List menu overflows on mobile');
    check(!errors.length,'Browser errors: '+errors.join('; '));
    results.push('save, preview, help and mobile menu');
    return {passed:true,results,errors};
  } catch(error){throw Error(stage+': '+error.message);
  } finally {await context.close();}
}
