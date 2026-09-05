import { writeFileSync } from "node:fs";

const page = await fetch("http://127.0.0.1:9223/json/new?http://localhost:3000/tmp/sva-preview.html", {
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
const metrics=await send('Runtime.evaluate',{expression:"JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.textContent,mainScroll:document.querySelector('#root')?.scrollWidth})",returnByValue:true});
console.log(metrics.result.value);
const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
writeFileSync('tmp/sva-'+width+'.png',Buffer.from(shot.data,'base64'));
}
socket.close();
