import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const base=process.argv[2]??"http://127.0.0.1:3119"; const out=process.argv[3];
if(!out){console.error("usage: node scripts/admin-pilot-check.mjs <base> <out>");process.exit(1)}
mkdirSync(join(out,"shots"),{recursive:true});
const chrome="/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome"; const port=9610;
const proc=spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars",`--remote-debugging-port=${port}`,"--user-data-dir=/tmp/cdp-admin-pilot","about:blank"],{stdio:"ignore"});
for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/json/version`)).ok)break}catch{}await sleep(150)}
const t=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:"PUT"})).json();const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true})});
let id=0;const p=new Map();ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){const{resolve,reject}=p.get(m.id);p.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result)}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;p.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}))});
const ev=async x=>(await send("Runtime.evaluate",{expression:x,returnByValue:true,awaitPromise:true})).result?.value;
const wait=async(fn,t=40)=>{for(let i=0;i<t;i++){if(await fn())return true;await sleep(250)}return false};
const shot=async n=>{const{data}=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});writeFileSync(join(out,"shots",n),Buffer.from(data,"base64"))};
const goto=async(path)=>{await send("Page.navigate",{url:base+path});await sleep(1200)};
const results=[];const record=(n,ok,d)=>{results.push({name:n,ok,detail:d});console.log(`${ok?"OK  ":"FAIL"} ${n} — ${JSON.stringify(d)}`)};
async function login(user){
 await send("Network.clearBrowserCookies"); await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false}); await goto("/dang-nhap?next=%2Fquan-tri");
 await ev(`(()=>{const set=(s,v)=>{const e=document.querySelector(s);const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;d.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}))};set('#login-username',${JSON.stringify(user)});set('#login-password','123456');document.querySelector('form').requestSubmit()})()`);
 return wait(async()=>await ev(`!!document.querySelector('.admB') || location.pathname==='/tai-khoan'`),50);
}
await send("Page.enable");await send("Runtime.enable");await send("Network.clearBrowserCookies");
await send("Page.navigate",{url:base+"/dang-nhap?next=%2Fquan-tri"});await sleep(700);await ev("localStorage.setItem('fasearch-admin-theme','light')");
const admin=await login("admin"); await wait(async()=>await ev(`!!document.querySelector('.sidebar')`));
const adminState=await ev(`({path:location.pathname,admB:!!document.querySelector('.admB'),font:getComputedStyle(document.querySelector('.admB')).fontFamily,sidebar:!!document.querySelector('.sidebar'),rows:document.querySelectorAll('.order-row').length,codes:[...document.querySelectorAll('.order-id strong')].map(e=>e.textContent),finance:!!document.querySelector('.finance-desk'),inventory:!!document.querySelector('.inventory'),customerFooter:!!document.querySelector('.sfFooter'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})`);
record("S1 ADMIN shell + live queue max3 + finance preview + inventory preview",adminState.admB&&adminState.sidebar&&adminState.rows===3&&adminState.finance&&adminState.inventory&&!adminState.customerFooter&&adminState.overflow<=1&&/Inter/.test(adminState.font),adminState);
await shot("admin-overview-1440-light.png");
// dialog escape/focus
await ev(`document.querySelector('.chart-open')?.click()`); await wait(async()=>await ev(`document.querySelector('#chart-dialog')?.open===true`));
const dialogOpen=await ev(`document.querySelector('#chart-dialog')?.open===true`);
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27}); await sleep(300);
const dialogClosed=await ev(`document.querySelector('#chart-dialog')?.open===false`);
const focusReturned=await ev(`document.activeElement?.classList.contains('chart-open')`);
record("S1 chart dialog closes on Escape and returns focus",dialogOpen&&dialogClosed&&focusReturned,{dialogOpen,dialogClosed,focusReturned});
// theme
await ev(`document.querySelector('.utilities button')?.click()`); await sleep(300);
const dark=await ev(`document.querySelector('.admB')?.classList.contains('dark')`);
record("S1 theme toggle scopes dark to Admin wrapper",dark,{dark});
await shot("admin-overview-1440-dark.png");
// list + detail
await goto("/quan-tri/don-hang"); await wait(async()=>await ev(`document.querySelectorAll('.review-orders-table tbody tr').length>0`));
const list=await ev(`({path:location.pathname,rows:document.querySelectorAll('.review-orders-table tbody tr').length,total:document.querySelector('.review-orders-table caption')?.textContent,footer:!!document.querySelector('.sfFooter'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})`);
record("S2 Admin order list live server pagination",list.path==="/quan-tri/don-hang"&&list.rows>0&&!list.footer&&list.overflow<=1,list);
await shot("admin-orders-1440-dark.png");
const href=await ev(`document.querySelector('.review-orders-table tbody a')?.getAttribute('href')`); await goto(href);
const detail=await wait(async()=>await ev(`!!document.querySelector('.section-head h2')`));
const detailState=await ev(`({path:location.pathname,title:document.querySelector('.section-head h2')?.textContent,rows:document.querySelectorAll('.review-orders-table tbody tr').length,hasWrite:document.querySelectorAll('button').length,text:document.body.innerText.includes('không có thao tác ghi')})`);
record("S2 Admin order detail actual + no write controls",detail&&detailState.rows>0&&detailState.hasWrite<20&&detailState.text,detailState);
await shot("admin-order-detail-1440-dark.png");
// staff role
const staff=await login("nhanvien1"); await wait(async()=>await ev(`!!document.querySelector('.sidebar')`));
const staffState=await ev(`({path:location.pathname,rows:document.querySelectorAll('.order-row').length,finance:!!document.querySelector('.finance-desk'),chart:!!document.querySelector('.chart'),dialog:!!document.querySelector('#chart-dialog'),dataSection:!!document.querySelector('.data-section'),sidebar:!!document.querySelector('.sidebar'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})`);
record("S1 STAFF live queue but finance/chart/dialog absent from DOM",staff&&staffState.sidebar&&staffState.rows===3&&!staffState.finance&&!staffState.chart&&!staffState.dialog&&!staffState.dataSection&&staffState.overflow<=1,staffState);
await shot("staff-overview-1440-light.png");
// customer denied
const cust=await login("khachhang1"); await sleep(700);
const custState=await ev(`({path:location.pathname,denied:document.body.innerText.includes('Không có quyền'),sidebar:!!document.querySelector('.sidebar'),finance:!!document.querySelector('.finance-desk'),orderRows:document.querySelectorAll('.order-row').length})`);
record("S1 CUSTOMER denied, no Admin data/shell",cust&&custState.denied&&!custState.sidebar&&!custState.finance&&custState.orderRows===0,custState);
await shot("customer-denied-1440.png");
// responsive admin overview/list/detail
await login("admin"); await wait(async()=>await ev(`!!document.querySelector('.sidebar')`));
for(const [w,h] of [[1024,1000],[768,1000],[390,844],[320,780]]){
 await send("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=760});
 await goto("/quan-tri"); await sleep(700);
 const m=await ev(`({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,footer:!!document.querySelector('.sfFooter'),sidebar:!!document.querySelector('.sidebar'),title:document.querySelector('h1')?.textContent})`);
 record(`S1 overview @${w}: no overflow/customer footer`,m.overflow<=1&&!m.footer,m); await shot(`admin-overview-${w}.png`);
}
await ev("localStorage.setItem('fasearch-admin-theme','light')");
for(const [w,h] of [[1024,1000],[768,1000],[390,844],[320,780]]){await send("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=760});await goto("/quan-tri");await sleep(700);const m=await ev(`({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,footer:!!document.querySelector('.sfFooter'),title:document.querySelector('h1')?.textContent})`);record(`S1 overview light @${w}: no overflow/customer footer`,m.overflow<=1&&!m.footer,m);await shot(`admin-overview-light-${w}.png`);}
// small-screen list/detail: only table internals may scroll
for(const [w,h] of [[390,844],[320,780]]){await send("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:true});await goto("/quan-tri/don-hang");await wait(async()=>await ev("document.querySelectorAll('.review-orders-table tbody tr').length>0"));const m=await ev(`({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,footer:!!document.querySelector('.sfFooter')})`);record(`S2 list @${w}: body no overflow/footer`,m.overflow<=1&&!m.footer,m);await shot(`admin-orders-${w}.png`);const href=await ev(`document.querySelector('.review-orders-table tbody a')?.getAttribute('href')`);await goto(href);await wait(async()=>await ev("document.querySelectorAll('.review-orders-table tbody tr').length>0"));const d=await ev(`({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,title:document.querySelector('h1')?.textContent,footer:!!document.querySelector('.sfFooter')})`);record(`S2 detail @${w}: no overflow/footer`,d.overflow<=1&&!d.footer&&d.title==='Chi tiết đơn',d);await shot(`admin-detail-${w}.png`);}
writeFileSync(join(out,"admin-pilot-report.json"),JSON.stringify({results,completed:true},null,2));
proc.kill();const failed=results.filter(x=>!x.ok);console.log(`\n${results.length-failed.length}/${results.length} pass`);process.exit(failed.length?1:0);
