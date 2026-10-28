async page => {
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1050}}),test=await context.newPage(),errors=[];
  const check=(value,message)=>{if(!value)throw Error(message);};
  test.on('pageerror',error=>errors.push(error.message));
  try{
    await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    const editor=test.locator('.paragraph-text').first(),copy='人虽然知道圣经中有永生，但因为魔鬼的妨碍无法得到，所以神差来耶稣，告知我们真理。';
    const highlighted='<strong><span style="background-color:#fef08a;color:#15803d">'+copy+'</span></strong>';
    const original='<ol start="5"><li>第五点</li><li>第六点</li><li>'+highlighted+'</li><li>第八点</li></ol>';
    async function seed(html){await editor.evaluate((el,html)=>{el.innerHTML=html;el.dispatchEvent(new InputEvent('input',{bubbles:true}));},html);}
    async function place(selector,offset=0,selectAll=false){await editor.evaluate((el,{selector,offset,selectAll})=>{const target=el.querySelector(selector),r=document.createRange();if(selectAll)r.selectNodeContents(target);else{const w=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);w.nextNode();if(w.currentNode.nodeType===Node.TEXT_NODE)r.setStart(w.currentNode,offset);else r.selectNodeContents(target);r.collapse(true);}el.focus();getSelection().removeAllRanges();getSelection().addRange(r);noteEditor.remember();},{selector,offset,selectAll});}
    for(const method of ['picker','shortcut','toggle','menu']){
      await seed(original);await place('li:nth-child(3)',2,method==='menu');
      if(method==='picker')await test.locator('#textTypePicker').selectOption('p');
      if(method==='shortcut')await editor.press('ControlOrMeta+Shift+0');
      if(method==='toggle'||method==='menu'){
        await test.locator('summary[aria-label="列表"]').click();
        await test.locator(method==='toggle'?'[data-list="ordered"]':'[data-list-action="outdent"]').click();
      }
      check(await editor.locator('li').count()===3,'Normal paragraph did not remove only item seven: '+method);
      check(await editor.textContent()==='第五点第六点'+copy+'第八点','Converting item seven reordered or lost text: '+method);
      check(await editor.locator('li p').filter({hasText:copy}).count()===0,'Converted paragraph remains inside its list item: '+method);
      check(await editor.locator('p strong span').textContent()===copy,'Converting lost highlight/bold structure: '+method);
      check(await editor.locator('ol').last().evaluate(el=>el.start)===8,'Following list numbering was changed: '+method);
      if(method==='menu')check(await test.evaluate(()=>getSelection().toString())===copy,'Converting lost the selected text');
      await editor.press('ControlOrMeta+Z');check(await editor.locator('li').count()===4,'Conversion cannot be undone: '+method);
      await editor.press('ControlOrMeta+Shift+Z');check(await editor.locator('li').count()===3,'Conversion cannot be redone: '+method);
    }
    for(const index of [1,4]){
      await seed(original);await place('li:nth-child('+index+')',1);await editor.press('ControlOrMeta+Shift+0');
      check(await editor.textContent()==='第五点第六点'+copy+'第八点','First/last conversion reordered text');
      check(await editor.locator('li').count()===3,'First/last conversion removed other items');
    }
    await seed('<ol start="5"><li>第五点</li><li>第六点</li><li>'+highlighted+'</li></ol>');await place('li:nth-child(3)',2);await editor.press('ControlOrMeta+Shift+0');
    await test.evaluate(()=>noteApp.save());await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    check(await editor.locator('li').count()===2&&await editor.locator('p').textContent()===copy,'Reload lost the converted paragraph');
    for(const suffix of ['<p>'+highlighted+'</p>','<div>'+highlighted+'</div>',highlighted,'<br>'+highlighted]){
      await seed('<ol start="5"><li>第五点</li><li>第六点<br>列表内说明</li></ol>'+suffix);
      for(const layout of ['handout','table']){
        await test.locator('[data-view="preview"]').click();await test.locator('[data-layout="'+layout+'"]').click();
        const p=test.locator('.paper-paragraph p').filter({hasText:copy});check(await p.count()===1,'Preview did not create a paragraph after the list');
        const geometry=await p.evaluate(el=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);w.nextNode();const r=document.createRange();r.setStart(w.currentNode,0);r.setEnd(w.currentNode,1);return {indent:r.getBoundingClientRect().x-el.getBoundingClientRect().x,expected:2*parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el.querySelector('span')).backgroundColor};});
        check(Math.abs(geometry.indent-geometry.expected)<1,'Preview paragraph has no two-character indent: '+JSON.stringify(geometry));
        check(geometry.color==='rgb(254, 240, 138)','Preview changed the highlight');
        check(await test.locator('.paper-paragraph li').first().evaluate(el=>parseFloat(getComputedStyle(el).textIndent))===0,'Preview applied prose indentation to a list item');
        await test.locator('[data-view="edit"]').click();
      }
    }
    await test.locator('[data-view="preview"]').click();await test.locator('[data-layout="handout"]').click();
    await test.locator('#paper').screenshot({path:'output/playwright/list-to-paragraph-preview.png'});
    await test.setViewportSize({width:390,height:844});check(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile preview overflowed');
    check(!errors.length,'Browser errors: '+errors.join('; '));
    return {passed:true,cancelSingleListItem:true,keepsOrderAndFormatting:true,undoRedo:true,reload:true,legacyParagraphIndent:true,bothLayouts:true,mobile:true,errors};
  }finally{await context.close();}
}
