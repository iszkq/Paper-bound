async page => {
  const check=(value,message)=>{if(!value)throw Error(message);};
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1100}}),test=await context.newPage(),errors=[];
  test.on('pageerror',error=>errors.push(error.message));
  const state=()=>test.evaluate(()=>{noteApp.save();return noteRuntime.clone(noteApp.getState().library);});
  try{
    await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    const original=await state();
    await test.locator('#importBtn').click();
    check(await test.locator('#actionDialog').isVisible(),'Import dialog missing');
    await test.locator('#articlePasteTitle').fill('粘贴导入检查');
    await test.locator('#articlePasteText').fill('第一段正文\n保留段内换行\n\n第二段 <script>文本</script>\n\n第三段正文');
    check((await test.locator('#articlePasteStatus').innerText()).includes('3 个文段'),'Paste paragraph count is wrong');
    await test.locator('#articlePasteForm button[type=submit]').click();
    let library=await state(),doc=library.documents.find(d=>d.id===library.activeId);
    check(library.documents.length===original.documents.length+1,'Paste should create a new document by default');
    check(JSON.stringify(library.documents[0])===JSON.stringify(original.documents[0]),'Import changed original document');
    check(doc.title==='粘贴导入检查'&&doc.data.paragraphs.length===3,'Paste import lost title or paragraphs');
    check(doc.data.paragraphs[0].html.includes('<br>')&&doc.data.paragraphs[1].html.includes('&lt;script&gt;'),'Plain text should retain line breaks and escape markup');
    await test.locator('.annotation-text').nth(0).fill('第一段对应分析');
    await test.locator('.annotation-text').nth(1).fill('第二段对应分析');
    await test.locator('.annotation-text').nth(2).fill('第三段对应分析');
    check(await test.locator('[data-para-move=up]').first().isDisabled(),'First paragraph can move beyond start');
    check(await test.locator('[data-para-move=down]').last().isDisabled(),'Last paragraph can move beyond end');
    const before=(await state()).documents.find(d=>d.id===doc.id).data.paragraphs;
    await test.locator('[data-para-move=down]').first().click();
    let after=(await state()).documents.find(d=>d.id===doc.id).data.paragraphs;
    check(JSON.stringify(after)===JSON.stringify([before[1],before[0],before[2]]),'Move down separated paragraph and analysis');
    await test.locator('[data-para-move=up]').nth(1).click();
    // Start the drag before scrolling; source and destination need not fit together.
    const handle=test.locator('.paragraph-drag').first(),target=test.locator('.edit-pair').last();
    await handle.scrollIntoViewIfNeeded();const source=await handle.boundingBox();
    await test.mouse.move(source.x+source.width/2,source.y+source.height/2);await test.mouse.down();
    await test.mouse.move(source.x+source.width/2,source.y+source.height/2+12,{steps:5});
    await target.evaluate(el=>el.scrollIntoView({block:'end'}));const box=await target.boundingBox();
    await test.mouse.move(box.x+30,box.y+box.height-10,{steps:8});await test.mouse.move(box.x+30,box.y+box.height-8);await test.mouse.up();
    after=(await state()).documents.find(d=>d.id===doc.id).data.paragraphs;
    check(JSON.stringify(after)===JSON.stringify([before[1],before[2],before[0]]),'Drag to end did not preserve paired contents');
    await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    check(JSON.stringify((await state()).documents.find(d=>d.id===doc.id).data.paragraphs)===JSON.stringify(after),'Reordered paragraphs did not persist');
    // File import uses the same local parser; no original file upload is needed.
    await test.locator('#importBtn').click();
    const chooser=test.waitForEvent('filechooser');await test.locator('#articleChooseFile').click();
    await (await chooser).setFiles({name:'文件导入检查.html',mimeType:'text/html',buffer:Buffer.from('<p>文件正文 <strong>保留加粗</strong></p><p>第二段正文</p>')});
    await test.waitForFunction(()=>!document.querySelector('#actionDialog').open);
    library=await state();doc=library.documents.find(d=>d.id===library.activeId);
    check(doc.title==='文件导入检查'&&doc.data.paragraphs.length===2&&doc.data.paragraphs[0].html.includes('<strong>'),'HTML file import regressed');
    // Replacement is explicit and cancellation must leave the document untouched.
    await test.locator('#importBtn').click();await test.locator('#articleImportTarget').selectOption('current');
    await test.locator('#articlePasteText').fill('替换后的正文');
    test.once('dialog',dialog=>dialog.dismiss());await test.locator('#articlePasteForm button[type=submit]').click();
    check(JSON.stringify((await state()).documents.find(d=>d.id===doc.id))===JSON.stringify(doc),'Cancelled import changed current document');
    test.once('dialog',dialog=>dialog.accept());await test.locator('#articlePasteForm button[type=submit]').click();
    const final=await state(),replaced=final.documents.find(d=>d.id===doc.id);
    check(final.documents.length===library.documents.length&&replaced.data.paragraphs.length===1&&replaced.data.paragraphs[0].html==='替换后的正文','Replace import created an unwanted extra document');
    check(!errors.length,'Browser errors: '+errors.join('; '));
    await test.screenshot({path:'output/playwright/article-order.png',fullPage:true});
    return 'Paste/file imports, cancellation, paired up/down/drag ordering and persistence passed';
  }finally{await context.close();}
}
