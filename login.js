(() => {
  const $=s=>document.querySelector(s);let signup=false,setup=false;
  function setMode(){
    $('#authTitle').textContent=setup?'设置管理员账号':signup?'从这里，写下第一篇札记。':'让每一次阅读，都有迹可循。';
    $('#authIntro').textContent=setup?'欢迎使用纸间。先创建管理员账号，之后可管理所有子账号。':signup?'创建账号，让文档有一个独立的归处。':'登录纸间，继续你的阅读与思考。';
    $('#loginSubmit').textContent=setup?'创建管理员并开始使用':signup?'创建账号':'登录';
    $('#switchHint').textContent=signup?'已经有账号？':'还没有账号？';$('#switchAuth').textContent=signup?'返回登录':'创建账号';
    $('#confirmField').hidden=!(setup||signup);$('#confirmPassword').required=setup||signup;$('#passwordHint').hidden=!(setup||signup);$('#password').autocomplete=setup||signup?'new-password':'current-password';$('#loginError').textContent='';
    $('#registrationField').hidden=setup||!signup;$('#registrationCode').required=!setup&&signup;$('#registrationCode').disabled=setup||!signup;
    $('.auth-switch').hidden=setup;$('.auth-guest').hidden=setup;
  }
  $('#switchAuth').onclick=()=>{if(setup)return;signup=!signup;setMode();};
  $('#togglePassword').onclick=()=>{const show=$('#password').type==='password';$('#password').type=show?'text':'password';$('#togglePassword').textContent=show?'隐藏密码':'显示密码';$('#togglePassword').setAttribute('aria-label',show?'隐藏密码':'显示密码');};
  $('#loginForm').onsubmit=async e=>{
    e.preventDefault();$('#loginError').textContent='';if((signup||setup)&&$('#password').value!==$('#confirmPassword').value){$('#loginError').textContent='两次输入的密码不一致。';$('#confirmPassword').focus();return;}
    const btn=$('#loginSubmit');btn.disabled=true;btn.textContent=signup||setup?'正在创建…':'正在登录…';
    try{const payload={username:$('#username').value.trim(),password:$('#password').value};if(signup&&!setup)payload.registrationCode=$('#registrationCode').value.trim();const response=await fetch(setup?'/api/setup':signup?'/api/register':'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:noteRuntime.timeout(12000)});const result=await response.json();if(!response.ok){if(response.status===428||response.status===409&&setup){const state=await fetch('/api/setup').then(r=>r.json());setup=state.required;setMode();}const error=Error(result.error||'暂时无法登录，请稍后重试。');error.field=result.field;throw error;}localStorage.setItem('zhijian-cloud-user',JSON.stringify(result.user));location.href=setup?'admin.html':'index.html';}
    catch(err){$('#loginError').textContent=err.name==='TypeError'||err instanceof SyntaxError?'暂时无法连接文档服务，请稍后重试。':err.message;$(err.field==='registrationCode'?'#registrationCode':'#password').focus();}
    finally{btn.disabled=false;btn.textContent=setup?'创建管理员并开始使用':signup?'创建账号':'登录';}
  };
  $('#loginSubmit').disabled=true;
  fetch('/api/setup',{signal:noteRuntime.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(state=>{setup=state.required;setMode();}).catch(()=>$('#loginError').textContent='暂时无法连接文档服务，请稍后重试。').finally(()=>$('#loginSubmit').disabled=false);
})();
