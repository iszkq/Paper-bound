async page => {
  const check=(value,message)=>{if(!value)throw Error(message);},results=[];
  for(const mode of ['native','unavailable','rejected']){
    const context=await page.context().browser().newContext({viewport:{width:1440,height:1050}}),test=await context.newPage(),errors=[];
    test.on('pageerror',error=>errors.push(error.message));
    let phase='setup';
    try{
      if(mode!=='native')await context.addInitScript(mode=>{
        Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:mode==='unavailable'?undefined:()=>Promise.reject(Error('Fullscreen blocked'))});
      },mode);
      await test.goto(new URL('/index.html',page.url()).href);
      await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
      await test.evaluate(()=>noteApp.importArticle(Array.from({length:12},(_,i)=>({html:'<p>第 '+(i+1)+' 段正文，用于检查全屏阅读中完整的长文滚动。</p>',noteHtml:'<p>对应分析与思考。</p>'})),'纯净全屏阅读'));
      const original=await test.evaluate(()=>JSON.stringify(noteApp.getState().data));
      await test.locator('[data-view="preview"]').click();
      for(const viewport of [{width:1440,height:1050},{width:390,height:844}]){
        await test.setViewportSize(viewport);
        for(const layout of ['handout','table']){
          await test.locator('[data-layout="'+layout+'"]').click();
          await test.locator('#previewReadingSize').selectOption('22');
          const entry=test.locator('#readingPreviewBtn'),exit=test.locator('#exitReadingBtn');
          phase=mode+' '+viewport.width+' '+layout+' enter';
          await entry.click();await test.waitForFunction(()=>document.body.classList.contains('clean-preview'));
          if(mode==='native')await test.waitForFunction(()=>document.fullscreenElement===document.querySelector('.preview-wrap'));
          else check(await test.evaluate(()=>!document.fullscreenElement),'Fallback unexpectedly entered native fullscreen');
          check(await test.locator('.preview-toolbar').isHidden()&&await test.locator('.topbar').isHidden(),'Reading mode did not hide toolbars');
          check(await exit.isVisible(),'Missing reading exit control');
          check(await test.locator('#paper').count()===1,'Reading mode cloned the document');
          const reading=await test.locator('.preview-wrap').evaluate(e=>({overflow:e.scrollWidth-e.clientWidth,scrollable:e.scrollHeight>e.clientHeight}));
          check(reading.overflow<=1&&reading.scrollable,'Reading is clipped or does not scroll: '+JSON.stringify(reading));
          check(await exit.evaluate(e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44),'Exit touch target is too small');
          check(await test.locator('#paper').evaluate(e=>getComputedStyle(e).getPropertyValue('--preview-reading-size').trim())==='22px','Reading size changed');
          await test.keyboard.press('ControlOrMeta+Alt+O');
          check(!await test.locator('#libraryDialog').evaluate(e=>e.open),'Hidden app shortcut opened a dialog during clean reading');
          await test.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
          await test.waitForFunction(()=>!document.body.classList.contains('clean-preview')&&!document.fullscreenElement);
          await test.emulateMedia({media:'print'});
          check(await exit.isHidden()&&await test.locator('.preview-wrap').evaluate(e=>getComputedStyle(e).position==='static'),'Print includes reading controls or clips the document');
          check(await test.locator('body').evaluate(e=>getComputedStyle(e).overflow==='visible'),'Reading mode clips printed pages');
          await test.emulateMedia({media:'screen'});
          await entry.click();await test.waitForFunction(()=>document.body.classList.contains('clean-preview'));
          if(mode==='native')await test.waitForFunction(()=>document.fullscreenElement);
          if(mode==='native'&&layout==='handout')await test.screenshot({path:'output/playwright/clean-preview-'+viewport.width+'.png'});
          await test.locator('.preview-wrap').evaluate(e=>{e.scrollTop=e.scrollHeight;});
          check(await test.locator('.content-pair').last().evaluate(e=>e.getBoundingClientRect().top<innerHeight),'Last paragraph cannot be reached');
          phase+=' button exit';await exit.click();await test.waitForFunction(()=>!document.body.classList.contains('clean-preview')&&!document.fullscreenElement);
          check(await entry.isVisible()&&await entry.evaluate(e=>document.activeElement===e),'Exit did not restore the entry control and focus');
          phase+=' reenter';await entry.click();await test.waitForFunction(()=>document.body.classList.contains('clean-preview'));
          if(mode==='native')await test.waitForFunction(()=>document.fullscreenElement);
          phase+=' escape';await test.keyboard.press('Escape');await test.waitForFunction(()=>!document.body.classList.contains('clean-preview')&&!document.fullscreenElement);
          if(mode==='native'){
            phase+=' native reenter';await entry.click();await test.waitForFunction(()=>document.fullscreenElement);
            phase+=' native exit';await test.evaluate(()=>document.exitFullscreen());await test.waitForFunction(()=>!document.body.classList.contains('clean-preview'));
          }
          check(await test.evaluate(()=>JSON.stringify(noteApp.getState().data))===original,'Reading changed document contents');
        }
      }
      check(!errors.length,'Browser errors: '+errors.join('; '));results.push(mode+' passed');
    }catch(error){
      const state=await test.evaluate(()=>({body:document.body.className,fullscreen:!!document.fullscreenElement}));
      throw Error(phase+': '+error.message+' '+JSON.stringify(state));
    }finally{await context.close();}
  }
  return {results,desktopMobile:true,bothLayouts:true,scrolling:true,keyboardAndButtonExit:true,fullscreenExitSync:true,documentPreserved:true};
}
