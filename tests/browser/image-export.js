// Run with playwright-cli run-code --filename tests/browser/image-export.js.
// Compare actual downloaded PNGs with browser screenshots, in an isolated library.
async page => {
  const check=(value,message)=>{if(!value)throw Error(message);};
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1100},deviceScaleFactor:2});
  const test=await context.newPage(),errors=[],results=[];
  test.on('pageerror',error=>errors.push(error.message));
  const dataURL=buffer=>'data:image/png;base64,'+buffer.toString('base64');
  const bytes=async download=>{
    const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
    return Buffer.concat(chunks);
  };
  async function fixture(font,long=false){
    await test.evaluate(({font,long})=>{
      const library=noteRuntime.clone(noteApp.getState().library),doc=library.documents[0];
      const paragraph={
        html:'<p>文段正文。将身体献上，当作活祭，是圣洁的，是神所喜悦的。中英文 mixed text 123。</p><ul data-task="true"><li data-checked="true">已读内容</li><li>待办思考</li></ul>',
        noteHtml:'<p><span style="font-size:28px;color:#30383e;background-color:#fff08a">将身体献上，当作活祭，是圣洁的，是神所喜悦的，</span>标记之后的内容。</p><p><strong>这里是右侧分析。</strong><span style="text-decoration:underline solid #c62828 2px">红色下划线，<span style="text-decoration:underline wavy #315cb6 2px">叠加蓝色波浪线，需要正确换行和显示。</span></span></p><ol><li>第一项分析</li><li>第二项分析，包含 English words 与数字 123。</li></ol>'
      };
      paragraph.noteHtml+='<p style="font-size:22px;text-indent:2em"><span style="background-color:#fff08a">(约5:39-40)你们查考圣经(或作“应当查考圣经”),因你们以为内中有永生,给我作见证的就是这经。然而你们不肯到我这里来得生命。</span></p><p style="font-size:22px"><span style="background-color:#fff08a">(约17:3)认识你独一的真神,并且认识你所差来的耶稣基督,这就是永生。</span></p>';
      doc.data={...doc.data,title:'图片排版验证',fontFamily:font,blocks:[
        {id:'before',position:'top',title:'阅读要点',html:'<p>栏目说明与正文使用同一字体。</p>'},
        {id:'after',position:'bottom',title:'总结与思考',html:'<p><mark>文末高亮</mark>、列表与文字标注保持原来的位置。</p>'}
      ],paragraphs:Array.from({length:long?12:1},(_,i)=>({...paragraph,html:'<p>第 '+(i+1)+' 组文段</p>'+paragraph.html}))};
      library.activeId=doc.id;noteApp.replaceLibrary(library);
    },{font,long});
    await test.locator('[data-view=preview]').click();
    await test.evaluate(()=>{document.querySelector('#paper').getBoundingClientRect();return document.fonts.ready;});
  }
  async function compare(font,layout,long=false){
    await test.locator('[data-layout='+layout+']').click();
    const dimensions=await test.locator('#paper').evaluate(el=>{
      const rect=el.getBoundingClientRect();
      return {width:rect.width,height:rect.height,regions:[...el.querySelectorAll('.paper-note-copy,.paper-paragraph,.paper-custom-block')].map(node=>{
        const box=node.getBoundingClientRect();return {x:box.x-rect.x,y:box.y-rect.y,width:box.width,height:box.height};
      })};
    });
    const downloads=[],expectedCount=Math.ceil(dimensions.height/5000);let received;
    const complete=new Promise(resolve=>{received=resolve;});
    const receive=d=>{downloads.push(d);if(downloads.length===expectedCount)received();};test.on('download',receive);
    await test.locator('#imageExportBtn').click();
    await test.waitForFunction(()=>!document.querySelector('#imageExportBtn').disabled);
    // Browser download events can arrive after the click handler has completed.
    let timeout;try{await Promise.race([complete,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Timed out receiving image downloads')),10000);})]);}finally{clearTimeout(timeout);}
    test.off('download',receive);
    check(downloads.length===Math.ceil(dimensions.height/5000),'Wrong number of exported slices: '+font+'/'+layout+' '+downloads.length+' height='+dimensions.height+' toast='+await test.locator('#toast').innerText());
    if(long)check(downloads.length>1,'Long-document fixture must exercise multiple slices');
    const slices=[];
    for(let i=0;i<downloads.length;i++){
      await downloads[i].saveAs('output/playwright/export-'+font+'-'+layout+(long?'-long':'')+'-'+i+'.png');
      slices.push(dataURL(await bytes(downloads[i])));
    }
    // Hide sticky chrome only for the reference screenshot; it is outside #paper.
    const hidden=await test.addStyleTag({content:'.topbar,.preview-toolbar{visibility:hidden!important}'});
    const baseline=dataURL(await test.locator('#paper').screenshot({path:'output/playwright/export-'+font+'-'+layout+(long?'-long':'')+'-preview.png'}));
    await hidden.evaluate(el=>el.remove());
    const comparison=await test.evaluate(async({baseline,slices,dimensions})=>{
      const load=async src=>{const img=new Image();img.src=src;await img.decode();return img;};
      const reference=await load(baseline),images=await Promise.all(slices.map(load));
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      // Compare one content region at a time to keep long-document memory bounded.
      const regions=dimensions.regions.map(rect=>{
        const x=Math.ceil(rect.x*2),y=Math.ceil(rect.y*2),width=Math.floor(rect.width*2),height=Math.floor(rect.height*2);
        canvas.width=width;canvas.height=height;ctx.drawImage(reference,-x,-y);
        const expected=ctx.getImageData(0,0,width,height).data;
        ctx.clearRect(0,0,width,height);let offset=0;
        for(const img of images){ctx.drawImage(img,-x,offset-y);offset+=img.height;}
        const actual=ctx.getImageData(0,0,width,height).data;let changed=0,sum=0;
        for(let at=0;at<actual.length;at+=4){
          let delta=0;for(let c=0;c<3;c++){const difference=Math.abs(expected[at+c]-actual[at+c]);sum+=difference;delta=Math.max(delta,difference);}
          if(delta>30)changed++;
        }
        return {changed:changed/(width*height),mean:sum/(width*height*3)};
      });
      return {width:reference.width,height:reference.height,sizes:images.map(img=>[img.width,img.height]),offset:images.reduce((sum,img)=>sum+img.height,0),regions};
    },{baseline,slices,dimensions});
    check(comparison.sizes.every(([w])=>w===comparison.width)&&Math.abs(comparison.offset-comparison.height)<=1,'Export dimensions differ from preview: '+font+'/'+layout+' '+JSON.stringify({dimensions,width:comparison.width,height:comparison.height,sizes:comparison.sizes}));
    for(const [i,region] of comparison.regions.entries()){
      // Allow subpixel font antialiasing; reflow and solid highlight boxes exceed this.
      check(region.changed<0.06&&region.mean<3,'Export differs from preview: '+font+'/'+layout+' region '+i+' '+JSON.stringify(region));
    }
    results.push({font,layout,long,slices:downloads.length,maxChanged:Math.max(...comparison.regions.map(r=>r.changed)),maxMean:Math.max(...comparison.regions.map(r=>r.mean))});
  }
  try {
    await test.goto('http://127.0.0.1:4173/index.html');
    await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
    for(const font of ['KaiTiGB2312','FangSongGB2312','XiaozhangReading','XiaozhangReadingLight','XiaozhangReadingBold','HanChanFangKai']){
      await fixture(font);
      for(const layout of ['handout','table'])await compare(font,layout);
    }
    await fixture('KaiTiGB2312',true);
    for(const layout of ['handout','table'])await compare('KaiTiGB2312',layout,true);
    check(!errors.length,'Browser errors: '+errors.join('; '));
    return results;
  } finally {await context.close();}
}
