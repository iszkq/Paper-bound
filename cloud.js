(() => {
  'use strict';
  const app=window.noteApp,$=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
  const account=window.cloudAccount={user:null};
  const mobileStatus=document.createElement('button');mobileStatus.id='mobileSyncStatus';mobileStatus.className='mobile-sync-state';document.body.append(mobileStatus);
  let revision=0,dirty=false,conflict=false,busy=false,suspend=true,timer,editGeneration=0,lastContent='',lastError='',authExpired=false;
  const key=()=>account.user?'zhijian-sync-v1:'+account.user.id:'';
  const content=()=>JSON.stringify(app.getState().library);
  const badge=(message,state='')=>{ $('#saveText').textContent=message;mobileStatus.textContent=message;mobileStatus.dataset.state=state;$('#syncStatusBtn').dataset.state=state;$('#syncStatusBtn').title=lastError||'点击立即同步；本机修改会自动保存'; };
  function remember(){if(key())localStorage.setItem(key(),JSON.stringify({revision,dirty}));}
  function status(){if(!account.user){badge('仅保存在本机');return;}if(authExpired)badge('登录已失效 · 点击登录','error');else if(conflict)badge('同步冲突 · 点击处理','conflict');else if(busy)badge('正在同步…','busy');else if(lastError)badge('本机已保存 · 同步待重试','error');else badge(dirty?'本机已保存 · 等待同步':'已同步到服务器',dirty?'pending':'synced');}
  async function api(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(12000)});let result;try{result=await response.json();}catch{throw Error('文档服务未连接，请稍后重试。');}if(!response.ok){if(path==='/api/library'&&response.status===401)authExpired=true;const err=Error(result.error||'同步失败，请稍后重试。');err.status=response.status;throw err;}if(path==='/api/library')authExpired=false;return result;}
  function apply(lib){suspend=true;try{app.replaceLibrary(lib);lastContent=content();}finally{suspend=false;}}
  function queue(){clearTimeout(timer);timer=setTimeout(()=>push(),750);}
  document.addEventListener('notesaved',()=>{
    if(suspend)return;
    if(!account.user||app.getState().session!=='cloud:'+account.user.id){status();return;}
    const value=content();if(value!==lastContent){lastContent=value;dirty=true;editGeneration++;try{remember();}catch{lastError='本机存储空间不足，请立即下载备份。';}queue();}status();
  });
  document.addEventListener('input',e=>{if(e.target.closest('.workspace'))editGeneration++;});
  async function push(){
    clearTimeout(timer);if(!account.user||busy||conflict)return false;
    app.save();if(!dirty){status();return true;}
    busy=true;lastError='';status();const payload=content();
    try{const result=await api('/api/library',{method:'PUT',body:JSON.stringify({revision,library:JSON.parse(payload)})});revision=result.revision;dirty=payload!==content();remember();if(dirty)queue();return true;
    }catch(err){lastError=err.message;if(err.status===409)conflict=true;dirty=true;remember();return false;}finally{busy=false;status();}
  }
  async function pull(){
    if(!account.user||busy||conflict)return;if(dirty)return push();
    // Avoid replacing DOM while the user is editing or has an open account dialog.
    if(document.activeElement?.closest('.workspace')||document.querySelector('dialog[open]'))return;
    busy=true;const generation=editGeneration;status();
    try{const result=await api('/api/library');lastError='';if(generation===editGeneration&&!dirty&&result.library&&result.revision!==revision){apply(result.library);revision=result.revision;remember();}}catch(err){lastError=err.message;}finally{busy=false;status();if(dirty)queue();}
  }
  function dialog(id,title,html){let d=$('#'+id);d?.remove();d=document.createElement('dialog');d.id=id;d.className='app-dialog';d.innerHTML='<form method="dialog" class="dialog-close-row"><button class="small-icon-btn" aria-label="关闭">×</button></form><h2>'+esc(title)+'</h2>'+html;document.body.append(d);d.showModal();return d;}
  function mergeLibraries(remote,local){
    const merged=structuredClone(remote),folderMap=new Map(),docMap=new Map();
    for(const f of local.folders){const existing=merged.folders.find(x=>x.id===f.id);folderMap.set(f.id,!existing||existing.name===f.name&&existing.parentId===f.parentId?f.id:crypto.randomUUID());}
    for(const f of local.folders){const id=folderMap.get(f.id);if(!merged.folders.some(x=>x.id===id))merged.folders.push({...f,id,parentId:folderMap.get(f.parentId)||''});}
    for(const doc of local.documents){const existing=merged.documents.find(x=>x.id===doc.id);if(existing&&JSON.stringify(existing.data)===JSON.stringify(doc.data)&&existing.title===doc.title&&existing.folderId===(folderMap.get(doc.folderId)||'')){docMap.set(doc.id,doc.id);continue;}const copy=structuredClone(doc);if(existing){copy.id=crypto.randomUUID();copy.title+=' · 本机副本';copy.data.title=copy.title;}copy.folderId=folderMap.get(doc.folderId)||'';merged.documents.push(copy);docMap.set(doc.id,copy.id);}
    merged.activeId=docMap.get(local.activeId)||remote.activeId;return merged;
  }
  function resolveConflict(){
    if($('#syncConflict')?.open)return;
    const d=dialog('syncConflict','其他位置有新的修改','<p class="dialog-copy">你的本机修改已保留。可以合并两个版本（有差异的文档另存为“本机副本”），或使用服务器版本。</p><p id="conflictError" class="form-error" role="alert"></p><div class="dialog-actions"><button class="btn btn-primary" id="mergeConflict">保留两个版本</button><button class="btn" id="remoteConflict">使用服务器版本</button></div>');
    const resolve=async merge=>{if(busy)return;busy=true;try{app.save();const local=structuredClone(app.getState().library);const remote=await api('/api/library');if(!remote.library)throw Error('服务器尚无文档，请稍后重试。');if(!merge&&!confirm('使用服务器版本？当前本机版本将先下载为备份。'))return;if(!merge)backup(local,'同步前本机备份');apply(merge?mergeLibraries(remote.library,local):remote.library);revision=remote.revision;conflict=false;dirty=merge;lastError='';remember();d.close();}catch(err){$('#conflictError').textContent=err.message;}finally{busy=false;status();if(dirty&&!conflict)queue();}};
    $('#mergeConflict').onclick=()=>resolve(true);$('#remoteConflict').onclick=()=>resolve(false);
  }
  $('#syncStatusBtn').onclick=()=>{if(authExpired){app.save();location.href='login.html';}else if(conflict)resolveConflict();else if(account.user){lastError='';dirty?push():pull();}else app.toast('登录后可按账号保存并同步文档');};
  mobileStatus.onclick=()=>$('#syncStatusBtn').click();
  function backup(library,name){const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,library},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function importLibrary(source){
    if(!Array.isArray(source?.documents)||!source.documents.length||!Array.isArray(source.folders))throw Error('没有可导入的文档。');
    const copy=structuredClone(source),map=new Map(copy.folders.map(f=>[f.id,crypto.randomUUID()]));
    copy.folders=copy.folders.map(f=>({...f,id:map.get(f.id),parentId:map.get(f.parentId)||''}));
    copy.documents=copy.documents.map(d=>({...d,id:crypto.randomUUID(),folderId:map.get(d.folderId)||'',data:app.normalize(d.data)}));
    const lib=app.getState().library;lib.folders.push(...copy.folders);lib.documents.push(...copy.documents);app.updateLibrary();
  }
  async function logout(){
    const ok=await push();if(!ok&&dirty&&!confirm('还有修改尚未同步，退出后会继续保留在本机。仍然退出？'))return;
    await api('/api/logout',{method:'POST',body:'{}'});suspend=true;account.user=null;localStorage.removeItem('zhijian-cloud-user');app.switchUser('guest');suspend=false;status();location.href='login.html';
  }
  function profile(){
    const user=account.user;if(!user||authExpired){app.save();location.href='login.html';return;}
    const d=dialog('cloudProfile','账号与同步','<p class="dialog-copy">'+esc(user.username)+' · 文档按账号独立保存在服务器。本机保留缓存，断网后可继续编辑。</p><form id="profileForm"><label>显示名称<input id="profileName" maxlength="32" value="'+esc(user.displayName)+'" required></label><label>当前密码（修改设置时填写）<input id="profileOld" type="password" autocomplete="current-password" maxlength="256" required></label><label>新密码（选填）<input id="profileNew" type="password" autocomplete="new-password" minlength="8" maxlength="256"></label><p id="profileError" class="form-error" role="alert"></p><button class="btn btn-primary" id="profileSave" type="submit">保存设置</button></form><div class="dialog-actions"><button class="btn" id="importLocal">导入本机文档</button><button class="btn" id="backupExport">下载文档备份</button><button class="btn" id="backupImport">导入备份</button><button class="btn" id="profileLogout">退出登录</button><button class="btn danger-button" id="profileDelete">注销账号</button></div><input type="file" id="backupFile" accept="application/json,.json" hidden>');
    if(user.role==='admin'){const link=document.createElement('a');link.href='admin.html';link.className='btn';link.textContent='管理子账号';link.id='manageAccounts';d.querySelector('.dialog-actions').prepend(link);$('#profileDelete').hidden=true;}
    $('#profileForm').onsubmit=async e=>{e.preventDefault();const btn=$('#profileSave');btn.disabled=true;try{const result=await api('/api/account',{method:'PATCH',body:JSON.stringify({displayName:$('#profileName').value.trim(),password:$('#profileOld').value,newPassword:$('#profileNew').value})});account.user=result.user;localStorage.setItem('zhijian-cloud-user',JSON.stringify(result.user));document.dispatchEvent(new Event('libraryupdated'));d.close();app.toast('账号设置已保存');}catch(err){$('#profileError').textContent=err.message;}finally{btn.disabled=false;}};
    $('#profileLogout').onclick=()=>logout().catch(err=>$('#profileError').textContent=err.message);
    $('#backupExport').onclick=()=>{app.save();backup(app.getState().library,'纸间-'+user.username+'-文档备份');};
    $('#backupImport').onclick=()=>$('#backupFile').click();$('#backupFile').onchange=async e=>{try{const file=e.target.files[0];if(file){importLibrary(JSON.parse(await file.text()).library);app.toast('备份已导入，等待同步');}}catch(err){$('#profileError').textContent=err.message;}};
    $('#importLocal').onclick=()=>{const sources=[{id:'guest',name:'未登录时的本机文档'},...read('zhijian-users-v1',[]).map(u=>({id:u.id,name:'旧本机账号 · '+u.username}))].filter(s=>read('zhijian-library-v1:'+s.id,null)?.documents?.length);if(!sources.length){$('#profileError').textContent='没有可导入的本机文档。';return;}const picker=dialog('importLocalDialog','选择本机文档库','<label>文档来源<select id="localSource">'+sources.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('')+'</select></label><p class="dialog-copy">导入后会添加到当前账号，原来的本机文档仍会保留。</p><button class="btn btn-primary" id="importLocalConfirm">导入到当前账号</button>');$('#importLocalConfirm').onclick=()=>{try{importLibrary(read('zhijian-library-v1:'+$('#localSource').value,null));picker.close();d.close();app.toast('本机文档已导入，等待同步');}catch(err){app.toast(err.message);}};};
    $('#profileDelete').onclick=async()=>{if(!$('#profileOld').value){$('#profileError').textContent='请先填写当前密码。';return;}if(!confirm('注销账号将删除服务器上的全部文档。请先下载备份，确认继续？'))return;try{await api('/api/account',{method:'DELETE',body:JSON.stringify({password:$('#profileOld').value})});const id=user.id;suspend=true;account.user=null;app.switchUser('guest');localStorage.removeItem('zhijian-library-v1:cloud:'+id);localStorage.removeItem('zhijian-sync-v1:'+id);localStorage.removeItem('zhijian-cloud-user');suspend=false;location.href='login.html';}catch(err){$('#profileError').textContent=err.message;}};
  }
  $('#accountOpen').onclick=profile;$('#logoutBtn').onclick=()=>logout().catch(err=>app.toast(err.message));
  async function start(){
    $('#app').inert=true;
    badge('正在连接文档服务…','busy');const cached=read('zhijian-cloud-user',null);
    try{
      const result=await api('/api/session');
      if(result.setupRequired){location.href='login.html';return;}
      if(!result.user){if(app.getState().session.startsWith('cloud:'))app.switchUser('guest');localStorage.removeItem('zhijian-cloud-user');suspend=false;status();return;}
      account.user=result.user;localStorage.setItem('zhijian-cloud-user',JSON.stringify(result.user));app.switchUser('cloud:'+result.user.id);
      const meta=read(key(),{revision:0,dirty:false});revision=meta.revision;dirty=meta.dirty;
      const remote=await api('/api/library');if(dirty){lastContent=content();}else if(remote.library){apply(remote.library);revision=remote.revision;}else{revision=0;dirty=true;}
      lastContent=content();remember();suspend=false;document.dispatchEvent(new Event('libraryupdated'));status();if(dirty)await push();
    }catch(err){if(cached&&app.getState().session==='cloud:'+cached.id){account.user=cached;const meta=read(key(),{revision:0,dirty:true});revision=meta.revision;dirty=meta.dirty;lastContent=content();}lastError=err.message;suspend=false;document.dispatchEvent(new Event('libraryupdated'));status();}finally{$('#app').inert=false;}
  }
  window.noteCloud={sync:push,refresh:pull,ready:start(),getState:()=>({user:account.user,revision,dirty,conflict,busy,error:lastError})};
  setInterval(()=>{if(navigator.onLine)pull();},15000);
  window.addEventListener('online',()=>dirty?push():pull());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull();});
  window.addEventListener('pagehide',()=>{if(account.user){app.save();remember();}});
})();
