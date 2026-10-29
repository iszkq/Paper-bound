async page => {
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1050}}),test=await context.newPage();
  const check=(value,message)=>{if(!value)throw Error(message);};
  try {
    await test.goto('http://127.0.0.1:4173/index.html');
    await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    await test.evaluate(()=>{noteApp.getState().data.paragraphs[0].html='在那预言了启示录约翰的异象内容'.repeat(16)+'<br>启示录第二行概要<br>第三行内容';noteApp.save();});
    await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    const measure=selector=>test.locator(selector).first().evaluate(host=>Array.from(host.children).filter(e=>e.matches('p,div')).map(p=>{
      const lines=[],walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())for(let i=0;i<walker.currentNode.length;i++){
        const range=document.createRange();range.setStart(walker.currentNode,i);range.setEnd(walker.currentNode,i+1);
        const rect=range.getBoundingClientRect();if(!rect.width)continue;
        let line=lines.find(item=>Math.abs(item.y-rect.y)<1);if(!line)lines.push(line={y:rect.y,x:rect.x,text:''});line.text+=walker.currentNode.textContent[i];
      }
      return {indent:parseFloat(getComputedStyle(p).textIndent),size:parseFloat(getComputedStyle(p).fontSize),left:p.getBoundingClientRect().left,width:p.getBoundingClientRect().width,lines};
    }));
    const editor=await measure('.paragraph-text');
    await test.locator('.edit-pair').first().screenshot({path:'output/playwright/paragraph-indent-editor.png'});
    check(editor.length===3,'Editor did not split hard line breaks like preview');
    for(const paragraph of editor){check(Math.abs(paragraph.indent-2*paragraph.size)<1,'Editor paragraph has the wrong first-line indent');check(paragraph.lines.length>0&&Math.abs(paragraph.lines[0].x-paragraph.left-paragraph.indent)<1,'Editor does not visually show the first-line indent');}
    check(editor[0].lines.length>1&&Math.abs(editor[0].lines[1].x-editor[0].left)<1,'Wrapped continuation line is not aligned to paragraph edge');
    await test.locator('[data-view="preview"]').click();
    const preview=await measure('.paper-paragraph');
    await test.locator('.content-pair').first().screenshot({path:'output/playwright/paragraph-indent-preview.png'});
    check(preview.length===3,'Preview paragraph count differs from editor');
    for(const paragraph of preview)check(Math.abs(paragraph.indent-2*paragraph.size)<1&&Math.abs(paragraph.lines[0].x-paragraph.left-paragraph.indent)<1,'Preview first-line indent differs');
    check(preview[0].lines.length>1&&Math.abs(preview[0].lines[1].x-preview[0].left)<1,'Preview continuation line is not aligned to paragraph edge');
    check(JSON.stringify(editor[0].lines.map(line=>line.text))===JSON.stringify(preview[0].lines.map(line=>line.text)),'Editor and preview wrap text at different positions');
    await test.setViewportSize({width:390,height:844});await test.locator('[data-view="edit"]').click();
    const mobileEditor=await measure('.paragraph-text');await test.locator('[data-view="preview"]').click();const mobilePreview=await measure('.paper-paragraph');
    check(mobileEditor.length===mobilePreview.length,'Mobile editor and preview split paragraphs differently');
    for(const paragraph of [...mobileEditor,...mobilePreview])check(Math.abs(paragraph.indent-2*paragraph.size)<1&&Math.abs(paragraph.lines[0].x-paragraph.left-paragraph.indent)<1,'Mobile first-line indent differs');
    return {passed:true,editorParagraphs:editor.length,previewParagraphs:preview.length,matchingLineWrap:true,desktopAndMobileIndent:true};
  }finally{await context.close();}
}
