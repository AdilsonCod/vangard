import { writeFileSync } from "node:fs";

const page = await fetch("http://127.0.0.1:9223/json/new?http://localhost:3000/", {
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
await send("Runtime.evaluate", {
  expression: "localStorage.setItem('vans_authenticated_user_id','01ed2a76-ddc0-4d95-8556-1c46e2d3a87c'); location.reload();",
});
await wait(8000);


for (const [pageLabel, heading] of [['Meu desempenho','Meu desempenho'],['Meus pagamentos','Meus pagamentos'],['Minhas metas','Minhas metas']]) {
  await send("Emulation.setDeviceMetricsOverride", {width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send("Runtime.evaluate", {expression: `[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()===${JSON.stringify(pageLabel)})?.click()`});
  await wait(1200);
  if(pageLabel==='Meus pagamentos') {
    await send("Runtime.evaluate",{expression:"document.querySelector('main details summary')?.click()"});
    await wait(300);
  }
  for(const width of [375,768,1440]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<1000});
    for(const dark of [false,true]) {
      await send("Runtime.evaluate",{expression:`document.documentElement.classList.toggle('dark',${dark})`});
      await wait(400);
      const metrics=await send("Runtime.evaluate",{expression:"JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,mainWidth:document.querySelector('main')?.clientWidth,mainScroll:document.querySelector('main')?.scrollWidth,heading:document.querySelector('main h1,main h2')?.textContent.trim(),details:document.querySelectorAll('main details').length})",returnByValue:true});
      console.log(pageLabel,width,dark,metrics.result.value);
      if(width===375 || width===1440) {
        const shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
        writeFileSync(`tmp/professional-${pageLabel.replaceAll(' ','-')}-${width}-${dark}.png`,Buffer.from(shot.data,'base64'));
      }
    }
  }
}
socket.close();
