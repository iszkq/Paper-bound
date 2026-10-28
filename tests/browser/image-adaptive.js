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
   // Control the measured content extent to test the exact half-page boundary.
   // Keep the real preview structure, header, columns, fonts and snapshot renderer.
   for(const ratio of [.25,.499,.5,.501,.8,1.1]){
    const result=await test.evaluate(async ratio=>{
     const root=document.querySelector('#paper'),header=root.querySelector('.paper-header,.paper-table-header'),body=root.lastElementChild;
     header.style.height=Math.ceil(header.getBoundingClientRect().height)+'px';
     const base=await noteApp.prepareImageExport(),pageHeight=Math.ceil(base.width*Math.SQRT2),capacity=pageHeight-base.headerBottom-base.columnsHeight-base.bottomPadding-base.footer;
     const firstEnd=pageHeight-base.bottomPadding-base.footer,requestedEnd=firstEnd+capacity*ratio,bodyTop=body.getBoundingClientRect().top-root.getBoundingClientRect().top;
     body.style.height=(requestedEnd-bodyTop)+'px';
     const end=body.getBoundingClientRect().bottom-root.getBoundingClientRect().top,prepared=await noteApp.prepareImageExport();window.adaptiveCheck=prepared;
     return {ratio,actualRatio:(end-firstEnd)/capacity,mode:prepared.mode,pages:prepared.pages,width:prepared.width,pageHeight,headerBottom:prepared.headerBottom,end,bottomPadding:prepared.bottomPadding,footer:prepared.footer};
    },ratio);
    const merged=ratio<.5,expectedPages=merged?1:ratio>1?3:2;
    check(Math.abs(result.actualRatio-ratio)<.0001,'Fixture missed requested threshold');
    check(result.mode===(merged?'long':'a4'),'Wrong automatic mode: '+JSON.stringify(result));
    check(result.pages.length===expectedPages,'Wrong automatic page count: '+JSON.stringify(result));
    check(result.pages[0].start===result.headerBottom&&result.pages.at(-1).end===result.end,'Content extent changed');
    if(merged){
     check(result.pages[0].height>result.pageHeight,'Merged image did not grow');
     check(result.pages[0].height===Math.ceil(result.end+result.bottomPadding+result.footer),'Merged image has excessive blank tail');
    }else check(result.pages.every(p=>p.height===result.pageHeight),'A4 pages changed size');
    for(let i=1;i<result.pages.length;i++)check(result.pages[i].start===result.pages[i-1].end&&result.pages[i].repeatColumns,'Continuation omitted body or headings');
    results.push({layout,ratio:result.actualRatio,mode:result.mode,pages:result.pages.length});
    if(ratio===.25){
     const downloads=[],capture=d=>downloads.push(d);test.on('download',capture);
     await test.locator('#imageExportBtn').click();await test.waitForFunction(()=>!document.querySelector('#imageExportBtn').disabled,{},{timeout:120000});
     for(let attempt=0;!downloads.length&&attempt<50;attempt++)await test.waitForTimeout(100);
     check(downloads.length===1,'Merged export produced multiple downloads');
     check(downloads[0].suggestedFilename()==='按内容自动导出验证.png','Merged download unexpectedly has a page suffix');
     const raster=await test.evaluate(async()=>{const p=window.adaptiveCheck,c=await p.renderPage(0),ctx=c.getContext('2d'),pixels=ctx.getImageData(0,0,c.width,Math.ceil(p.headerBottom*2)+100).data;let ink=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<240||pixels[i+1]<240||pixels[i+2]<240)ink++;return {width:c.width,height:c.height,ink};});
     check(raster.width===Math.ceil(result.width*2)&&raster.height===Math.ceil(result.pages[0].height*2)&&raster.ink>200,'Merged raster is blank or has incorrect dimensions');
     await downloads[0].saveAs('output/playwright/adaptive-boundary-'+layout+'.png');test.off('download',capture);
    }
   }
  }
  check(!errors.length,'Browser errors: '+errors.join(';'));
  return {passed:true,results,mergedDownloads:true,errors};
 }finally{await context.close();}
}
