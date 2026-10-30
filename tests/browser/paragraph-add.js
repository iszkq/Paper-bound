async page => {
  const check=(value,message)=>{if(!value)throw Error(message);};
  const context=await page.context().browser().newContext(),test=await context.newPage(),errors=[];
  test.on('pageerror',error=>errors.push(error.message));
  const paragraphs=()=>test.evaluate(()=>{noteApp.save();return noteRuntime.clone(noteApp.getState().data.paragraphs);});
  try{
    await test.goto(new URL('/index.html',page.url()).href);
    await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    await test.evaluate(()=>noteApp.importArticle([
      {html:'<p>第一段<strong>原文</strong></p>',noteHtml:'<p>第一段分析</p>'},
      {html:'<p>第二段原文</p>',noteHtml:'<p>第二段分析</p>'}
    ],'新增段落回归'));
    for(const button of ['#addBottom','#addBottom','#addBtn']){
      const before=await paragraphs();
      await test.locator(button).click();
      const after=await paragraphs();
      check(after.length===before.length+1,'Add button did not create exactly one paragraph');
      check(JSON.stringify(after.slice(0,-1))===JSON.stringify(before),'Add button changed existing paragraph order or paired contents');
      check(after.at(-1).html===''&&after.at(-1).noteHtml==='','Add button did not append a blank paragraph at the end');
      check(await test.locator('.paragraph-text').last().evaluate(el=>el===document.activeElement),'New last paragraph was not focused');
      await test.keyboard.type('新增正文 '+after.length);
      await test.locator('.annotation-text').last().fill('新增分析 '+after.length);
    }
    const beforeInsert=await paragraphs();
    await test.locator('[data-add-paragraph-after]').first().click();
    const inserted=await paragraphs();
    check(inserted.length===beforeInsert.length+1&&!inserted[1].html&&!inserted[1].noteHtml,'Inline insert did not create a blank paragraph after the selected paragraph');
    check(JSON.stringify([inserted[0],...inserted.slice(2)])===JSON.stringify(beforeInsert),'Inline insert changed neighboring paragraph pairs');
    await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    check(JSON.stringify(await paragraphs())===JSON.stringify(inserted),'Added paragraphs did not persist after reload');
    check(!errors.length,'Browser errors: '+errors.join('; '));
    return 'Bottom append, repeated append, toolbar append, focus, paired contents, inline insert and reload persistence passed';
  }finally{await context.close();}
}
