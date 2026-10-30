async page => {
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1050}}),test=await context.newPage(),errors=[];
  const check=(value,message)=>{if(!value)throw Error(message);};
  test.on('pageerror',error=>errors.push(error.message));
  try{
    await test.goto(new URL('/index.html',page.url()).href);
    await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    for(const viewport of [{width:1440,height:1050},{width:390,height:844}]){
      await test.setViewportSize(viewport);
      for(const target of [
        {editor:'#bottomBlockEditors .block-content-input',preview:'.bottom-block > div'},
        {editor:'#topBlockEditors .block-content-input',preview:'.paper-custom-block:not(.bottom-block) > div'},
        {editor:'.annotation-text',preview:'.paper-note-copy'}
      ]){
        for(const html of ['<p><strong>需要缩进的文字</strong></p>','<div>需要缩进的文字</div>','需要缩进的文字','前一行<br>需要缩进的文字']){
          await test.evaluate(html=>{
            const data={title:'栏目缩进检查',paragraphs:[{html:'正文',noteHtml:html}],blocks:[
              {title:'文前概要',html,position:'top'},
              {title:'总结与思考',html,position:'bottom'}
            ]};
            const state=noteApp.getState();Object.assign(state.data,data);noteApp.openDocument(state.activeDoc.id);
          },html);
          const editor=test.locator(target.editor).first(),button=test.locator('#paragraphIndent');
          const caret=()=>editor.evaluate(e=>{
            const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let offset=e.textContent.indexOf('需要缩进')+2;
            while(walker.nextNode()){if(offset<walker.currentNode.length)break;offset-=walker.currentNode.length;}
            const range=document.createRange();range.setStart(walker.currentNode,offset);range.collapse(true);
            e.focus();getSelection().removeAllRanges();getSelection().addRange(range);noteEditor.remember();
          });
          const geometry=locator=>locator.evaluate(e=>{
            const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let offset=e.textContent.indexOf('需要缩进');
            while(walker.nextNode()){if(offset<walker.currentNode.length)break;offset-=walker.currentNode.length;}
            const node=walker.currentNode,range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);
            const block=node.parentElement.closest('p,div');
            return {offset:range.getBoundingClientRect().x-block.getBoundingClientRect().x,size:parseFloat(getComputedStyle(node.parentElement).fontSize)};
          });
          await caret();check(await button.getAttribute('aria-pressed')==='false','Column should initially be flush left');
          await button.click();check(await button.getAttribute('aria-pressed')==='true','Toolbar did not enable indentation');
          const editing=await geometry(editor);
          check(Math.abs(editing.offset-2*editing.size)<1,'Editor ignored column indent: '+target.editor+' '+JSON.stringify(editing));
          await editor.press('ControlOrMeta+Z');await caret();check(await button.getAttribute('aria-pressed')==='false','Column indent undo failed');
          await editor.press('ControlOrMeta+Shift+Z');await caret();
          for(const layout of ['handout','table']){
            await test.locator('[data-view="preview"]').click();await test.locator('[data-layout="'+layout+'"]').click();
            const preview=await geometry(test.locator(target.preview).first());
            check(Math.abs(preview.offset-2*preview.size)<1,'Preview ignored column indent: '+layout+' '+target.preview+' '+JSON.stringify(preview));
            await test.locator('[data-view="edit"]').click();
          }
          await caret();await button.click();
          check(Math.abs((await geometry(editor)).offset)<1,'Disabling column indent failed');
          await button.click();await test.evaluate(()=>noteApp.save());await test.reload();
          await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
          const saved=await geometry(test.locator(target.editor).first());
          check(Math.abs(saved.offset-2*saved.size)<1,'Column indent did not survive reload');
        }
      }
    }
    await test.locator('[data-view="preview"]').click();
    await test.locator('#paper').screenshot({path:'output/playwright/column-indent.png'});
    check(!errors.length,'Browser errors: '+errors.join('; '));
    return 'Column and analysis indentation passed on desktop/mobile: P/DIV/bare/BR, actual glyph positions, both previews, toggle, undo/redo and reload';
  }finally{await context.close();}
}
