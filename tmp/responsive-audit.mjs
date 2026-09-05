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

const viewports = [
  ["phone", 375, 812, true],
  ["tablet", 768, 1024, true],
  ["desktop", 1440, 900, false],
];

for (const [name, width, height, mobile] of viewports) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await wait(1500);
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(`tmp/responsive-${name}.png`, Buffer.from(screenshot.data, "base64"));
  const metrics = await send("Runtime.evaluate", {
    expression: "JSON.stringify({innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,title:document.title,login:!!document.querySelector('input[type=password]')})",
    returnByValue: true,
  });
  console.log(name, metrics.result.value);
}

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Runtime.evaluate", { expression: "[...document.querySelectorAll('*')].forEach(element => { if (element.scrollHeight > element.clientHeight) element.scrollTop = element.scrollHeight; })" });
await wait(1000);
const rankingScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync("tmp/responsive-overview-rankings.png", Buffer.from(rankingScreenshot.data, "base64"));
const rankingMetrics = await send("Runtime.evaluate", { expression: "JSON.stringify({heading:[...document.querySelectorAll('h2')].some(element => element.textContent.includes('Rankings do período')),panels:[...document.querySelectorAll('h3')].filter(element => ['Faturamento de barbeiros','Produtos vendidos','Serviços extras por barbeiro','Clientes atendidos','Ticket médio','Serviços extras mais vendidos'].includes(element.textContent.trim())).length,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth})", returnByValue: true });
console.log("rankings", rankingMetrics.result.value);

await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 812, deviceScaleFactor: 1, mobile: true });
await send("Runtime.evaluate", { expression: "[...document.querySelectorAll('*')].forEach(element => { if (element.scrollHeight > element.clientHeight) element.scrollTop = element.scrollHeight; })" });
await wait(800);
const mobileRankingScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync("tmp/responsive-overview-rankings-mobile.png", Buffer.from(mobileRankingScreenshot.data, "base64"));
const mobileRankingMetrics = await send("Runtime.evaluate", { expression: "JSON.stringify({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,heading:[...document.querySelectorAll('h2')].some(element => element.textContent.includes('Rankings do período'))})", returnByValue: true });
console.log("rankings-mobile", mobileRankingMetrics.result.value);

socket.close();
