async page => {
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const browser=page.context().browser(),results=[];
  const health=await page.context().request.get('http://127.0.0.1:4175/api/setup');
  if((await health.json()).required){
    const setup=await page.context().request.post('http://127.0.0.1:4175/api/setup',{data:{username:'deployment_admin',password:'Deploy-check-12345'}});
    check(setup.ok(),'Failed to initialize isolated test server');
  }
  const scenarios=[
    {name:'HTTP IP',base:'http://192.0.2.20:8080',legacy:false,secure:false},
    {name:'HTTP IP with missing modern APIs',base:'http://192.0.2.21:8080',legacy:true,secure:false},
    {name:'HTTPS public entry simulated by routed origin',base:'https://192.0.2.22',legacy:false,secure:true}
  ];
  for(const scenario of scenarios){
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[],responses=[];
    try {
      if(scenario.legacy)await context.addInitScript(()=>{Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});Object.defineProperty(globalThis,'structuredClone',{value:undefined,configurable:true});});
      await context.route(scenario.base+'/**',async route=>{
        const request=route.request(),headers={...request.headers(),host:new URL(request.url()).host};
        const response=await route.fetch({url:request.url().replace(scenario.base,'http://127.0.0.1:4175'),headers});
        await route.fulfill({response});
      });
      const test=await context.newPage();test.on('pageerror',e=>errors.push(e.message));test.on('response',r=>{if(r.status()>=400)responses.push([r.status(),r.url()]);});
      await test.goto(scenario.base+'/login.html');await test.waitForFunction(()=>!document.querySelector('#loginSubmit').disabled);
      check(await test.evaluate(()=>isSecureContext)===scenario.secure,'Wrong security context for '+scenario.name);
      if(!scenario.secure)check(await test.evaluate(()=>typeof crypto.randomUUID)==='undefined','HTTP test still has native UUID');
      await test.locator('#username').fill('deployment_admin');await test.locator('#password').fill('Deploy-check-12345');await test.locator('#loginSubmit').click();
      await test.waitForURL('**/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
      check(await test.evaluate(()=>noteCloud.getState().user?.username)==='deployment_admin','Login/session failed on '+scenario.name);
      await test.locator('#newBtn').click();await test.locator('#titleInput').fill('部署验证 '+scenario.name);
      const editor=test.locator('.paragraph-text').first();await editor.fill('开始编辑的原始文字');
      for(const palette of ['text','highlight','underline','wave']){
        await test.locator('[data-palette="'+palette+'"] > summary').click();
        check(await test.locator('.tool-menu[open]').count()===1,'Menus overlap on '+scenario.name);
        check(await test.locator('[data-palette="'+palette+'"]').getAttribute('open')!==null,'Wrong active menu');
      }
      await test.locator('.tool-menu summary[aria-label="列表"]').click();
      check(await test.locator('.tool-menu[open]').count()===1,'List overlaps color picker');
      await test.keyboard.press('Escape');check(await test.locator('.tool-menu[open]').count()===0,'Escape did not close menus');
      // Programmatic opens must also obey the same exclusivity.
      await test.evaluate(()=>{document.querySelector('[data-palette=text]').open=true;document.querySelector('[data-palette=wave]').open=true;});
      await test.waitForFunction(()=>document.querySelectorAll('.tool-menu[open]').length===1);
      await editor.click();
      const before=await editor.innerText();
      const cancelFile={name:'取消导入.txt',mimeType:'text/plain',buffer:Buffer.from('不应被导入的内容')};
      const chooser1=await Promise.all([test.waitForEvent('filechooser'),test.locator('#importBtn').click()]);
      test.once('dialog',dialog=>dialog.dismiss());await chooser1[0].setFiles(cancelFile);
      await test.waitForFunction(()=>document.querySelector('#importFile').value==='');
      check(await editor.innerText()===before,'Cancelling import changed the note');
      const chooser2=await Promise.all([test.waitForEvent('filechooser'),test.locator('#importBtn').click()]);
      test.once('dialog',dialog=>dialog.accept());await chooser2[0].setFiles({name:'实际文章.txt',mimeType:'text/plain',buffer:Buffer.from('第一段导入正文\n\n第二段导入正文')});
      await test.waitForFunction(()=>noteApp.getState().data.paragraphs.length===2);
      check(await test.locator('#titleInput').inputValue()==='实际文章','Imported title was not updated');
      check(await test.locator('.paragraph-text').nth(1).innerText()==='第二段导入正文','Text import lost paragraph');
      await test.evaluate(()=>noteCloud.sync());await test.waitForFunction(()=>!noteCloud.getState().dirty&&!noteCloud.getState().busy);
      await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
      check(await test.locator('.paragraph-text').count()===2,'Imported article was not persisted');
      const chooser3=await Promise.all([test.waitForEvent('filechooser'),test.locator('#importBtn').click()]);
      test.once('dialog',dialog=>dialog.accept());await chooser3[0].setFiles({name:'无P标签.html',mimeType:'text/html',buffer:Buffer.from('<h2>导入标题</h2><div>只有 div 的文章</div><script>window.shouldNeverRun=true</script>')});
      await test.waitForFunction(()=>document.querySelector('#titleInput').value==='无P标签');
      check((await test.locator('.paragraph-text').allInnerTexts()).join('').includes('只有 div 的文章'),'HTML without p tags was not imported');
      check(!await test.evaluate(()=>window.shouldNeverRun),'Imported script was executed');
      const version=await test.evaluate(()=>fetch('/api/version').then(r=>r.json()));
      check(version.filesValid&&!version.restartRequired,'Version integrity failed: '+JSON.stringify(version));
      await test.locator('#libraryToggle').click();await test.mouse.click(2,2);check(!await test.locator('#libraryDialog').isVisible(),'Library backdrop failed');
      const ids=await test.evaluate(()=>Array.from({length:1000},()=>noteRuntime.uuid()));check(new Set(ids).size===1000,'Duplicate IDs in compatibility generator');
      check(errors.length===0,'Browser errors: '+errors.join('; '));check(responses.length===0,'Failed resources/API: '+JSON.stringify(responses));
      if(!scenario.legacy){await test.locator('[data-palette=text] > summary').click();await test.screenshot({path:'output/playwright/deploy-'+(scenario.secure?'https':'http')+'.png'});}
      results.push({scenario:scenario.name,login:true,editor:true,fileChooser:true,importTXT:true,importHTML:true,persistence:true,exclusiveMenus:true,version:version.version,errors});
    } finally {await context.close();}
  }
  return results;
}
