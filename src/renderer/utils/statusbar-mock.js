/**
 * statusbar-mock.js — Môi trường mock dùng chung cho xem trước iframe thanh trạng thái
 *
 * Tách nguyên bản từ StatusBarSandbox.vue: Tiêm vào iframe các đối tượng kiểu jQuery/lodash
 * `$`/`_`, toastr, bus sự kiện waitGlobalInitialized/errorCatched/eventOn,
 * mock getAllVariables và Mvu.events; tiến trình chứa đẩy dữ liệu làm mới qua
 * postMessage(mockStatData:update). Hành vi đồng nhất với bản gốc, dùng chung cho Bàn làm việc và Sandbox.
 */

/**
 * Tạo chuỗi script môi trường mock tiêm vào <head> của iframe
 * @param {object} initialStatData stat_data ban đầu (giá trị mẫu điền sẵn)
 */
export function buildMockEnvironmentScript(initialStatData) {
  const initialData = JSON.stringify(initialStatData || {});
  return '<scr' + 'ipt>\n(function(){\n' +
    'function $$(sel){\n' +
    '  if(typeof sel==="function"){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",sel);}else{sel();}return;}\n' +
    '  const els=typeof sel==="string"?Array.from(document.querySelectorAll(sel)):(sel instanceof Element?[sel]:[]);\n' +
    '  const api={\n' +
    '    text:function(v){if(v===undefined)return els[0]?els[0].textContent:"";els.forEach(e=>e.textContent=v);return api;},\n' +
    '    html:function(v){if(v===undefined)return els[0]?els[0].innerHTML:"";els.forEach(e=>e.innerHTML=v);return api;},\n' +
    '    addClass:function(c){els.forEach(e=>e.classList.add(c));return api;},\n' +
    '    removeClass:function(c){els.forEach(e=>e.classList.remove(c));return api;},\n' +
    '    on:function(ev,selOrFn,handler){if(typeof selOrFn==="function"){handler=selOrFn;selOrFn=null;}els.forEach(e=>{if(selOrFn){e.addEventListener(ev,function(event){const t=event.target.closest(selOrFn);if(t&&e.contains(t))handler.call(t,event);});}else{e.addEventListener(ev,handler);}});return api;},\n' +
    '    data:function(k){return els[0]?els[0].dataset[k]:undefined;},\n' +
    '    attr:function(k,v){if(v===undefined)return els[0]?els[0].getAttribute(k):null;els.forEach(e=>e.setAttribute(k,v));return api;},\n' +
    '    val:function(v){if(v===undefined)return els[0]?els[0].value:"";els.forEach(e=>e.value=v);return api;},\n' +
    '    hide:function(){els.forEach(e=>e.style.display="none");return api;},\n' +
    '    show:function(){els.forEach(e=>e.style.display="");return api;},\n' +
    '    each:function(fn){els.forEach((e,i)=>fn.call(e,i,e));return api;},\n' +
    '    length:els.length\n' +
    '  };\n' +
    '  return api;\n' +
    '}\n' +
    'window.$=$$;window.jQuery=$$;\n' +
    'window._={\n' +
    '  get:function(obj,path,def){if(typeof path==="string")path=path.split(".");let n=obj;for(const p of path){if(n==null)return def;n=n[p];}return n===undefined?def:n;},\n' +
    '  set:function(obj,path,v){if(typeof path==="string")path=path.split(".");let n=obj;for(let i=0;i<path.length-1;i++){if(!n[path[i]]||typeof n[path[i]]!=="object")n[path[i]]={};n=n[path[i]];}n[path[path.length-1]]=v;return obj;},\n' +
    '  has:function(obj,path){if(typeof path==="string")path=path.split(".");let n=obj;for(const p of path){if(n==null||!(p in n))return false;n=n[p];}return true;},\n' +
    '  clamp:function(v,lo,hi){return Math.max(lo,Math.min(hi,v));},\n' +
    '  isEmpty:function(v){return v==null||(Array.isArray(v)&&v.length===0)||(typeof v==="object"&&Object.keys(v).length===0)||v==="";}\n' +
    '};\n' +
    'window.toastr={success:function(){console.info("[toastr.success]",...arguments);},info:function(){console.info("[toastr.info]",...arguments);},warning:function(){console.warn("[toastr.warning]",...arguments);},error:function(){console.error("[toastr.error]",...arguments);}};\n' +
    'window.waitGlobalInitialized=function(){return Promise.resolve();};\n' +
    'window.errorCatched=function(fn){return function(){try{return fn.apply(this,arguments);}catch(e){console.error("[errorCatched]",e);}};};\n' +
    'const _listeners={};\n' +
    'window.eventOn=function(ev,cb){if(!_listeners[ev])_listeners[ev]=[];_listeners[ev].push(cb);};\n' +
    'window.__triggerEvent=function(ev){const args=Array.prototype.slice.call(arguments,1);(_listeners[ev]||[]).forEach(cb=>{try{cb.apply(null,args);}catch(e){console.error(e);}});};\n' +
    'const VARIABLE_UPDATE_ENDED="mvu_mock_var_update_ended";\n' +
    'const VARIABLE_INITIALIZED="mvu_mock_var_initialized";\n' +
    'window.Mvu={events:{VARIABLE_UPDATE_ENDED:VARIABLE_UPDATE_ENDED,VARIABLE_INITIALIZED:VARIABLE_INITIALIZED}};\n' +
    'window.__mockStatData=' + initialData + ';\n' +
    'window.getAllVariables=function(){return{stat_data:window.__mockStatData};};\n' +
    'window.addEventListener("message",function(e){if(e.data&&e.data.type==="mockStatData:update"){window.__mockStatData=e.data.data;window.__triggerEvent(VARIABLE_UPDATE_ENDED);}});\n' +
    '})();\n' +
    '</scr' + 'ipt>';
}

/**
 * Bao bọc mã HTML thanh trạng thái bằng môi trường mock
 * @param {string} html Mã HTML thanh trạng thái (Tài liệu hoàn chỉnh hoặc đoạn mã)
 * @param {object} initialStatData stat_data ban đầu
 * @returns {string} Mã HTML có thể dùng trực tiếp cho srcdoc của iframe
 */
export function wrapWithMock(html, initialStatData) {
  const mockScript = buildMockEnvironmentScript(initialStatData);
  let out = html;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, '<head$1>' + mockScript);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, '<html$1><head>' + mockScript + '</head>');
  } else {
    out = '<!doctype html><html><head>' + mockScript + '</head><body>' + out + '</body></html>';
  }
  return out;
}

/** Hằng số giao thức postMessage (Tiến trình chứa → Đẩy dữ liệu mock vào iframe) */
export const MOCK_UPDATE_MESSAGE = { type: 'mockStatData:update' };