import { writeFileSync } from "node:fs";

const page = await fetch("http://127.0.0.1:9223/json/new?http://localhost:3000/tmp/chart-preview.html", {
  method: "PUT",
}).then((response) => response.json());
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let sequence = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await send("Page.enable");
await send("Runtime.enable");
await wait(5000);
for(const width of [375,768,1440]){
await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<1000});
await wait(400);
const metrics=await send('Runtime.evaluate',{expression:"JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,charts:[...document.querySelectorAll('.recharts-wrapper')].map(x=>({html:x.innerHTML.slice(0,500),width:x.clientWidth,height:x.clientHeight,paths:x.querySelectorAll('path').length})),svg:[...document.querySelectorAll('svg')].map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})),mainScroll:document.querySelector('#root')?.scrollWidth})",returnByValue:true});
console.log(metrics.result.value);
const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
writeFileSync('tmp/chart-'+width+'.png',Buffer.from(shot.data,'base64'));
}
socket.close();
