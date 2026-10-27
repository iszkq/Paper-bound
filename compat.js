(() => {
  'use strict';
  // randomUUID is restricted to secure contexts; getRandomValues also works on HTTP.
  function uuid(){
    if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
    const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  }
  function timeout(milliseconds){
    if(typeof globalThis.AbortSignal?.timeout==='function')return AbortSignal.timeout(milliseconds);
    const controller=new AbortController();setTimeout(()=>controller.abort(),milliseconds);return controller.signal;
  }
  // Libraries are plain JSON data, including on browsers without structuredClone.
  function clone(value){return typeof globalThis.structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));}
  window.noteRuntime=Object.freeze({uuid,timeout,clone});
})();
