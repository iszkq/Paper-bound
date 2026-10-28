async page => {
 const check=(value,message)=>{if(!value)throw Error(message);},context=await page.context().browser().newContext({viewport:{width:1440,height:1100}}),test=await context.newPage(),errors=[],uploads=[];
 test.on('pageerror',e=>errors.push(e.message));test.on('request',r=>{if(r.method()==='POST'||r.method()==='PUT')uploads.push(r.url());});
 const state=()=>test.evaluate(()=>{noteApp.save();return noteRuntime.clone(noteApp.getState().library);});
 const choose=async file=>{const event=test.waitForEvent('filechooser');await test.locator('#articleChooseFile').click();await(await event).setFiles(file);};
 try{
  await test.goto('http://127.0.0.1:4173/index.html');await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  check(!await test.evaluate(()=>!!window.mammoth),'Word parser should load on demand');
  const original=await state();await test.locator('#importBtn').click();
  check((await test.locator('#importFile').getAttribute('accept')).includes('.docx'),'Word file picker missing');
  await choose('tests/fixtures/word-import.docx');await test.waitForFunction(()=>!document.querySelector('#actionDialog').open);
  let library=await state(),doc=library.documents.find(d=>d.id===library.activeId),ps=doc.data.paragraphs,html=ps.map(p=>p.html).join('');
  check(library.documents.length===original.documents.length+1,'Word import did not create a new document');
  check(JSON.stringify(library.documents[0])===JSON.stringify(original.documents[0]),'Original document changed');
  check(doc.title==='word-import'&&ps.length===6,'Word title or block order/count changed: '+JSON.stringify(ps));
  check(ps[0].html==='<h1>文章标题</h1>','Word heading lost');
  check(/<strong>加粗内容<\/strong>/.test(html)&&/<em>斜体内容<\/em>/.test(html)&&/<u>下划线内容<\/u>/.test(html),'Word inline formats lost');
  check(/background-color:/.test(ps[1].html)&&ps[1].html.includes('黄色高亮')&&ps[1].html.includes('<br>'),'Word highlight or soft break lost');
  check(/<ol>.*<li>第一项<ol>.*嵌套子项/.test(ps[2].html)&&ps[2].html.includes('第二项'),'Nested list structure lost: '+ps[2].html);
  check(ps[4].html==='<p>表格甲 · 表格乙</p>'&&ps[5].html.includes('末段内容不丢失'),'Table row layout or final content lost');
  check(!/javascript:|<script|<a\b|onerror/i.test(html)&&html.includes('链接文字保留'),'Imported markup was not sanitized');
  await test.reload();await test.waitForFunction(()=>window.noteCloud);await test.evaluate(()=>noteCloud.ready);
  check(JSON.stringify((await state()).documents.find(d=>d.id===doc.id))===JSON.stringify(doc),'Word import did not persist');
  // Broken/legacy/unsupported/oversize files leave the document and library untouched.
  for(const [name,buffer,message] of [['broken.docx',Buffer.from('not a zip'),'无法读取'],['legacy.doc',Buffer.from('legacy'),'另存为 .docx'],['unknown.pdf',Buffer.from('pdf'),'请选择 Word'],['large.docx',Buffer.alloc(20*1024*1024+1),'超过 20 MB']]){
   await test.locator('#importBtn').click();await choose({name,mimeType:'application/octet-stream',buffer});
   await test.waitForFunction(()=>!document.querySelector('#articleChooseFile').disabled);
   check((await test.locator('#articlePasteStatus').innerText()).includes(message),'Unhelpful error for '+name);
   check(JSON.stringify(await state())===JSON.stringify(library),'Failed import mutated library: '+name);
   await test.locator('#articleImportCancel').click();
  }
  // Replacement still requires confirmation after Word conversion completes.
  await test.locator('#importBtn').click();await test.locator('#articleImportTarget').selectOption('current');
  test.once('dialog',d=>d.dismiss());await choose('tests/fixtures/word-import.docx');await test.waitForFunction(()=>!document.querySelector('#articleChooseFile').disabled);
  check(JSON.stringify(await state())===JSON.stringify(library),'Cancelled replacement mutated library');
  test.once('dialog',d=>d.accept());await choose('tests/fixtures/word-import.docx');await test.waitForFunction(()=>!document.querySelector('#actionDialog').open);
  check((await state()).documents.length===library.documents.length,'Word replacement created an extra document');
  await test.locator('[data-view="preview"]').click();await test.screenshot({path:'output/playwright/word-import-preview.png',fullPage:true});
  check(!errors.length,'Browser errors: '+errors.join(';'));check(!uploads.length,'Guest file import unexpectedly uploaded data: '+uploads.join(';'));
  return {passed:true,blocks:ps.length,headings:true,nestedLists:true,formats:true,tableText:true,failuresPreservedDocument:true,noUpload:true,errors};
 }finally{await context.close();}
}
