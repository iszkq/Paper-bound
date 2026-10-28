async page => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:1050},acceptDownloads:true}),test=await context.newPage(),errors=[];
 const check=(value,message)=>{if(!value)throw Error(message);};test.on('pageerror',e=>errors.push(e.message));
 try{
  await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  await test.evaluate(()=>{
   const library=noteRuntime.clone(noteApp.getState().library),doc=library.documents[0];
   doc.data={...doc.data,title:'按内容自动导出验证',author:'导出作者',source:'边界验证',blocks:[],paragraphs:[{html:'<p>正文开头保留。</p>',noteHtml:'<p>分析文字保留。</p>'}]};library.activeId=doc.id;noteApp.replaceLibrary(library);
  });
  await test.locator('[data-view="preview"]').click();const results=[];
  for(const layout of ['handout','table']){
   await test.locator('[data-layout="'+layout+'"]').click();await test.evaluate(()=>document.fonts.ready);
   // Control body extent to exercise final-page capacity with real headers and rendering.
   for(const fullLongPages of [0,1,3])for(const tailRatio of [.25,.999,1,1.001,1.3]){
    const result=await test.evaluate(async({fullLongPages,tailRatio})=>{
     const root=document.querySelector('#paper'),header=root.querySelector('.paper-header,.paper-table-header'),body=root.lastElementChild;
     header.style.height=Math.ceil(header.getBoundingClientRect().height)+'px';
     const base=await noteApp.prepareImageExport(),a4Height=Math.ceil(base.width*Math.SQRT2),longHeight=Math.ceil(base.width*2.2),tailHeading=base.headerBottom+(fullLongPages?base.columnsHeight:0),tailCapacity=a4Height-tailHeading-base.bottomPadding-base.footer;
     const tailStart=fullLongPages?longHeight-base.bottomPadding-base.footer+(fullLongPages-1)*(longHeight-base.headerBottom-base.columnsHeight-base.bottomPadding-base.footer):base.headerBottom;
     const requestedEnd=tailStart+tailCapacity*tailRatio,bodyTop=body.getBoundingClientRect().top-root.getBoundingClientRect().top;
     body.style.height=(requestedEnd-bodyTop)+'px';
     const end=body.getBoundingClientRect().bottom-root.getBoundingClientRect().top,prepared=await noteApp.prepareImageExport();window.adaptiveCheck=prepared;
     return {pages:prepared.pages,mode:prepared.mode,width:prepared.width,a4Height,longHeight,headerBottom:prepared.headerBottom,end,actualRatio:(end-tailStart)/tailCapacity,bottomPadding:prepared.bottomPadding,footer:prepared.footer};
    },{fullLongPages,tailRatio});
    check(Math.abs(result.actualRatio-tailRatio)<.0001,'Fixture missed requested threshold');
    check(result.pages.length===fullLongPages+1,'Wrong automatic page count: '+JSON.stringify(result));
    check(result.pages[0].start===result.headerBottom&&result.pages.at(-1).end===result.end,'Content extent changed');
    const tail=result.pages.at(-1),longTail=tailRatio>1;
    check(tail.kind===(longTail?'long':'a4'),'Wrong final page kind: '+JSON.stringify(result));
    check(longTail?tail.height>result.a4Height:tail.height===result.a4Height,'Wrong final page height');
    check(result.pages.every(p=>p.height<=result.longHeight),'Image exceeded long-page limit');
    check(result.pages.slice(0,-1).every(p=>p.kind==='long'&&p.height===result.longHeight),'Full pages did not use long images');
    for(let i=1;i<result.pages.length;i++)check(result.pages[i].start===result.pages[i-1].end&&result.pages[i].repeatColumns,'Continuation omitted body or headings');
    results.push({layout,fullLongPages,tailRatio:result.actualRatio,kinds:result.pages.map(p=>p.kind)});
    if(fullLongPages===1&&tailRatio===.25){
     const downloads=[],capture=d=>downloads.push(d);test.on('download',capture);
     await test.locator('#imageExportBtn').click();await test.waitForFunction(()=>!document.querySelector('#imageExportBtn').disabled,{},{timeout:120000});
     for(let attempt=0;downloads.length<2&&attempt<50;attempt++)await test.waitForTimeout(100);
     check(downloads.length===2,'Mixed export did not download both pages');
     for(let i=0;i<2;i++){check(downloads[i].suggestedFilename()==='按内容自动导出验证-'+(i+1)+'.png','Wrong mixed download filename');await downloads[i].saveAs('output/playwright/adaptive-boundary-'+layout+'-'+(i+1)+'.png');}
     const raster=await test.evaluate(async()=>{
      const p=window.adaptiveCheck,checks=[];
      for(let i=0;i<p.pages.length;i++){const c=await p.renderPage(i),pixels=c.getContext('2d').getImageData(0,0,c.width,Math.ceil(p.headerBottom*2)).data;let ink=0;for(let at=0;at<pixels.length;at+=4)if(pixels[at]<240||pixels[at+1]<240||pixels[at+2]<240)ink++;checks.push({width:c.width,height:c.height,ink});c.width=c.height=0;}
      return checks;
     });
     check(raster.every((r,i)=>r.width===Math.ceil(result.width*2)&&r.height===Math.ceil(result.pages[i].height*2)&&r.ink>200),'Mixed raster is blank or has incorrect dimensions');test.off('download',capture);
    }
   }
  }
  check(!errors.length,'Browser errors: '+errors.join(';'));
  return {passed:true,results,mixedDownloads:true,errors};
 }finally{await context.close();}
}
