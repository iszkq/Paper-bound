// Isolated browser storage and mocked account API; no production database writes.
async page => {
  const check=(value,message)=>{if(!value)throw Error(message);};
  const contexts=[],errors=[],results=[];
  async function open(cloud=false){
    const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}});contexts.push(context);
    const server={revision:0,library:null,puts:[],fail:false,holdNext:false,release:null};
    await context.route('**/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      let body={},status=200;
      if(path==='/api/session')body={user:cloud?{id:'saving_test',username:'saving_test',displayName:'保存检查',role:'user'}:null};
      else if(path==='/api/library'&&request.method()==='GET')body={library:server.library,revision:server.revision};
      else if(path==='/api/library'&&request.method()==='PUT'){
        const payload=request.postDataJSON();server.puts.push({payload,time:await request.frame().evaluate(()=>Date.now())});
        if(server.holdNext){server.holdNext=false;await new Promise(resolve=>{server.release=resolve;});}
        if(server.fail){status=503;body={error:'测试网络不可用'};}
        else if(payload.revision!==server.revision){status=409;body={error:'测试远端冲突'};}
        else{server.library=payload.library;body={revision:++server.revision};}
      }
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    });
    await context.addInitScript(()=>{
      window.saveWrites=[];const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key.startsWith('zhijian-library-v1:'))saveWrites.push({key,value,time:Date.now()});
        return original.call(this,key,value);
      };
    });
    const test=await context.newPage();test.on('pageerror',error=>errors.push(error.message));
    await test.clock.install({time:new Date('2026-10-27T08:00:00Z')});await test.clock.pauseAt(new Date('2026-10-27T08:00:01Z'));
    await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    await test.evaluate(()=>{
      noteApp.save();saveWrites.length=0;window.saveLabelChanges=[];
      new MutationObserver(()=>saveLabelChanges.push(document.querySelector('#saveText').textContent)).observe(document.querySelector('#saveText'),{childList:true,characterData:true,subtree:true});
    });
    server.puts.length=0;return {test,server};
  }
  const cached=test=>test.evaluate(()=>{
    const library=JSON.parse(localStorage.getItem('zhijian-library-v1:'+noteApp.getState().session));
    return library.documents.find(doc=>doc.id===library.activeId).data.paragraphs[0].html;
  });
  const writes=test=>test.evaluate(()=>saveWrites.length);
  async function clean(test){await test.waitForFunction(()=>!noteCloud.getState().busy&&!noteCloud.getState().dirty);}
  try{
    const {test:guest}=await open();const editor=guest.locator('.paragraph-text').first();
    await editor.fill('安静的本地草稿');await guest.clock.runFor(799);
    check(await writes(guest)===0,'Local save ran before idle delay');
    await guest.clock.runFor(1);check((await cached(guest)).includes('安静的本地草稿'),'Idle draft was not cached');
    check(await writes(guest)===1,'Local idle save wrote more than once');
    await guest.locator('#syncStatusBtn').click();await guest.keyboard.press('ControlOrMeta+S');
    check(await writes(guest)===1,'Unchanged manual saves rewrote browser library');
    await guest.evaluate(()=>saveWrites.length=0);
    for(let i=0;i<13;i++){await editor.fill('连续输入 '+i);await guest.clock.runFor(400);}
    check(await writes(guest)===1,'Continuous editing did not checkpoint at five seconds');
    check((await cached(guest)).includes('连续输入 12'),'Continuous draft checkpoint lost latest content');
    await editor.fill('立即刷新也要保留');await guest.reload();await guest.waitForFunction(()=>window.noteCloud);await guest.evaluate(()=>noteCloud.ready);
    check((await guest.locator('.paragraph-text').first().innerText()).includes('立即刷新也要保留'),'Reload discarded pending draft');
    results.push('Local idle/continuous checkpoints, duplicate suppression, manual save and reload recovery');

    const {test,server}=await open(true),cloudEditor=test.locator('.paragraph-text').first();
    await cloudEditor.fill('等待合并同步');await test.clock.runFor(9800);
    check(server.puts.length===0,'Cloud upload ran for a small edit before batching delay');
    await test.clock.runFor(1000);await clean(test);
    check(server.puts.length===1,'Idle changes were not uploaded together');
    const before=server.puts.length,start=await test.evaluate(()=>Date.now());
    for(let i=0;i<32;i++){await cloudEditor.fill('持续编辑云草稿 '+i);await test.clock.runFor(1000);}
    check(server.puts.length===before+1&&server.puts[before].time-start<=30000,'Continuous edits were not batched within thirty seconds');
    await cloudEditor.fill('按下快捷键立即同步');const manualBefore=server.puts.length;
    await test.keyboard.press('ControlOrMeta+S');await clean(test);
    check(server.puts.length===manualBefore+1&&JSON.stringify(server.library).includes('按下快捷键立即同步'),'Ctrl+S failed to flush pending local changes immediately');
    await test.locator('#syncStatusBtn').click();await clean(test);
    check(server.puts.length===manualBefore+1,'Unchanged manual save sent another upload');
    check(await test.evaluate(()=>saveLabelChanges.length)===0,'Routine saves changed the visible button label');
    server.holdNext=true;await cloudEditor.fill('第一批正在上传');
    await test.evaluate(()=>{window.pendingUpload=noteCloud.sync();});
    await test.waitForFunction(()=>noteCloud.getState().busy);
    await cloudEditor.fill('上传期间再次手动保存的最新内容');await test.keyboard.press('ControlOrMeta+S');
    server.release();await test.evaluate(()=>pendingUpload);await test.clock.runFor(1);await clean(test);
    check(JSON.stringify(server.library).includes('上传期间再次手动保存的最新内容'),'Manual save during an upload did not flush the newer edit');
    results.push('Cloud idle batching, thirty-second deadline, stable label and immediate Ctrl+S');

    server.fail=true;await cloudEditor.fill('离线期间保留的草稿');await test.clock.runFor(10800);
    await test.waitForFunction(()=>!noteCloud.getState().busy&&!!noteCloud.getState().error);
    check((await cached(test)).includes('离线期间保留的草稿'),'Upload failure lost the local draft');
    await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    check((await test.locator('.paragraph-text').first().innerText()).includes('离线期间保留的草稿'),'Reload overwrote dirty draft with server content');
    server.fail=false;await test.evaluate(()=>window.dispatchEvent(new Event('online')));await clean(test);
    check(JSON.stringify(server.library).includes('离线期间保留的草稿'),'Reconnect did not retry the draft');
    // A remote poll between input and local debounce must never replace that input.
    server.library=JSON.parse(JSON.stringify(server.library));server.library.documents[0].data.paragraphs[0].html='远端的新版本';server.revision++;
    await test.locator('.paragraph-text').first().fill('尚在本地等待保存的输入');await test.locator('[data-view=preview]').click();
    await test.evaluate(()=>noteCloud.refresh());
    check((await cached(test)).includes('尚在本地等待保存的输入')&&await test.evaluate(()=>noteCloud.getState().dirty),'Remote polling replaced pending local input');
    results.push('Offline recovery, reconnect and protection from remote overwrite');

    const {test:quota}=await open();
    await quota.evaluate(()=>{
      const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){
        if(key.startsWith('zhijian-library-v1:'))throw new DOMException('Storage full','QuotaExceededError');
        return original.call(this,key,value);
      };
    });
    await quota.locator('.paragraph-text').first().fill('空间不足时保留在页面的内容');await quota.clock.runFor(800);
    check(await quota.locator('#saveText').innerText()==='保存失败','Local quota failure was hidden');
    check(!await quota.evaluate(()=>noteApp.save()),'Local quota failure was reported as success');
    check((await quota.locator('.paragraph-text').first().innerText()).includes('空间不足'),'Local save error removed editor contents');
    const {test:meta,server:metaServer}=await open(true);
    await meta.evaluate(()=>{
      const original=Storage.prototype.setItem;window.restoreSaveStorage=()=>Storage.prototype.setItem=original;
      Storage.prototype.setItem=function(key,value){if(key.startsWith('zhijian-sync-v1:'))throw new DOMException('Storage full','QuotaExceededError');return original.call(this,key,value);};
    });
    await meta.locator('.paragraph-text').first().fill('同步状态空间不足仍保留文档');await meta.clock.runFor(800);
    await meta.evaluate(()=>noteCloud.sync());
    check(JSON.stringify(metaServer.library).includes('同步状态空间不足仍保留文档'),'Sync metadata failure discarded document');
    check(!!await meta.evaluate(()=>noteCloud.getState().error),'Sync metadata failure was hidden');
    await meta.evaluate(()=>{restoreSaveStorage();return noteCloud.sync();});
    check(!await meta.evaluate(()=>noteCloud.getState().error),'Recovered storage did not clear metadata error');
    check(!errors.length,'Browser errors: '+errors.join('; '));results.push('Visible storage failure without discarding editor content');
    return results;
  }finally{for(const context of contexts)await context.close();}
}
