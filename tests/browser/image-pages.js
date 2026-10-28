async page => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:1050},acceptDownloads:true}),test=await context.newPage(),errors=[];
 const check=(value,message)=>{if(!value)throw Error(message);};test.on('pageerror',e=>errors.push(e.message));
 try{
  await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  const sentence='长篇阅读笔记需要连续分页，每一页保留标题和作者，正文按顺序衔接，不能丢失文字。';
  await test.evaluate(sentence=>{
   const lib=noteRuntime.clone(noteApp.getState().library),doc=lib.documents[0];
   doc.data={...doc.data,title:'长文分页图片验证',author:'分页作者',source:'连续阅读资料',fontFamily:'KaiTiGB2312',blocks:[{title:'文前概要',html:'<p>概要只出现在第一张图片。</p>',position:'top'},{title:'文末总结',html:'<p>全部正文之后的结束总结。</p>',position:'bottom'}],paragraphs:[{html:'<p><span style="background-color:#fef08a">'+sentence.repeat(80)+'</span></p>',noteHtml:'<p><span style="font-size:22px;text-decoration:underline wavy red;text-decoration-thickness:2px">'+sentence.repeat(40)+'</span></p>'},...Array.from({length:5},(_,i)=>({html:'<p>第'+(i+2)+'组文段：'+sentence.repeat(5)+'</p>',noteHtml:'<p>对应分析：'+sentence.repeat(3)+'</p>'}))]};lib.activeId=doc.id;noteApp.replaceLibrary(lib);
  },sentence);
  await test.locator('[data-view="preview"]').click();const results=[];
  for(const layout of ['handout','table']){
   await test.locator('[data-layout="'+layout+'"]').click();await test.evaluate(()=>document.fonts.ready);
   const plan=await test.evaluate(async()=>{
    const prepared=await noteApp.prepareImageExport();const {renderPage,...plan}=prepared;window.imagePagesForCheck=prepared;
    const root=document.querySelector('#paper'),top=root.getBoundingClientRect().top,lines=[],w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(w.nextNode()){if(!w.currentNode.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(w.currentNode);for(const box of r.getClientRects())lines.push({top:box.top-top,bottom:box.bottom-top});}
    return {...plan,lines};
   });
   check(plan.pages.length>=3,'Long text was not paginated: '+layout);
   for(let i=0;i<plan.pages.length;i++){
    const p=plan.pages[i];check(p.height/plan.width<1.7,'A page is still excessively long: '+JSON.stringify(p));
    check(i===0?p.start===plan.headerBottom:p.start===plan.pages[i-1].end,'Page slices omit or repeat content');
    check(p.end>p.start,'Empty body page');
    if(i<plan.pages.length-1)check(!plan.lines.some(line=>line.top<p.end-.1&&line.bottom>p.end+.1),'Page boundary cuts through text: '+p.end);
    if(i>0)check(p.repeatColumns,'Continuation lost column headings');
   }
   const raster=await test.evaluate(async()=>{
    const prepared=window.imagePagesForCheck,checks=[];let first;
    for(let i=0;i<prepared.pages.length;i++){
     const canvas=await prepared.renderPage(i),ctx=canvas.getContext('2d'),header=ctx.getImageData(0,0,canvas.width,Math.floor(prepared.headerBottom*2)).data;
     if(!first)first=header;let different=0,ink=0;for(let p=0;p<header.length;p++)if(header[p]!==first[p])different++;
     const body=ctx.getImageData(0,Math.ceil(prepared.headerBottom*2),canvas.width,canvas.height-Math.ceil(prepared.headerBottom*2)-100).data;for(let p=0;p<body.length;p+=4)if(body[p]<240||body[p+1]<240||body[p+2]<240)ink++;
     checks.push({different,ink,width:canvas.width,height:canvas.height});canvas.width=0;canvas.height=0;
    }
    return checks;
   });
   check(raster.every(p=>p.different===0),'Repeated page header pixels changed');check(raster.every(p=>p.ink>200),'An exported body is blank');
   const downloads=[],capture=d=>downloads.push(d);test.on('download',capture);await test.locator('#imageExportBtn').click();await test.waitForFunction(()=>!document.querySelector('#imageExportBtn').disabled,{},{timeout:120000});
   for(let attempt=0;downloads.length<plan.pages.length&&attempt<50;attempt++)await test.waitForTimeout(100);
   check(downloads.length===plan.pages.length,'Button did not download every page: '+downloads.length+'/'+plan.pages.length);
   for(let i=0;i<downloads.length;i++){check(downloads[i].suggestedFilename().endsWith('-'+(i+1)+'.png'),'Files are not in page order');if(i<2)await downloads[i].saveAs('output/playwright/paged-'+layout+'-'+(i+1)+'.png');}
   test.off('download',capture);results.push({layout,pages:plan.pages.length,sameHeader:true,continuousBody:true,noCutLines:true,downloads:downloads.length});
  }
  await test.setViewportSize({width:390,height:844});
  const mobile=await test.evaluate(async()=>{const p=await noteApp.prepareImageExport();return {width:p.width,pages:p.pages.map(page=>({height:page.height,start:page.start,end:page.end}))};});
  check(mobile.pages.every(p=>p.height/mobile.width<1.9),'Mobile export produced an excessively long image');
  await test.setViewportSize({width:1440,height:1050});
  // Short documents stay a single image, with the same title and footer.
  await test.evaluate(()=>{const lib=noteRuntime.clone(noteApp.getState().library),doc=lib.documents[0];doc.data.blocks=[];doc.data.paragraphs=[{html:'<p>短篇正文。</p>',noteHtml:'<p>短篇分析。</p>'}];noteApp.replaceLibrary(lib);});
  await test.locator('[data-view="preview"]').click();check(await test.evaluate(async()=>(await noteApp.prepareImageExport()).pages.length)===1,'Short document unexpectedly split');
  check(!errors.length,'Browser errors: '+errors.join(';'));
  return {passed:true,results,customFont:true,shortDocument:true,errors};
 }finally{await context.close();}
}
