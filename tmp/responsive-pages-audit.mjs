const pages = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const page = pages.find((item) => item.type === "page" && item.url.includes("localhost:3000"));
if (!page) throw new Error("Página local não encontrada no Chrome de auditoria.");

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
const evaluate = (expression) => send("Runtime.evaluate", { expression, returnByValue: true });
const clickButton = async (label) => {
  const result = await evaluate(`(() => { const target = [...document.querySelectorAll('button')].find(button => button.offsetParent !== null && button.textContent.trim() === ${JSON.stringify(label)}); if (!target) return false; target.click(); return true; })()`);
  if (!result.result.value) throw new Error(`Botão não encontrado: ${label}`);
  await wait(700);
};
const hasButton = async (label) => {
  const result = await evaluate(`[...document.querySelectorAll('button')].some(button => button.offsetParent !== null && button.textContent.trim() === ${JSON.stringify(label)})`);
  return Boolean(result.result.value);
};
const navigateSubpage = async (parent, child) => {
  await openMenu();
  if (!(await hasButton(child))) await clickButton(parent);
  await clickButton(child);
};
const openMenu = async () => {
  const result = await evaluate(`(() => { if (document.querySelector('button[aria-label="Fechar menu"]')) return true; const target = document.querySelector('button[aria-label="Abrir menu"]'); if (!target) return false; target.click(); return true; })()`);
  if (!result.result.value) throw new Error("Botão do menu móvel não encontrado.");
  await wait(500);
};
const inspect = async (name) => {
  const metrics = await evaluate(`JSON.stringify({documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,viewport:innerWidth,mainWidth:document.querySelector('main')?.scrollWidth,mainClientWidth:document.querySelector('main')?.clientWidth,dialogs:[...document.querySelectorAll('[role=dialog]')].length,charts:[...document.querySelectorAll('.recharts-responsive-container')].slice(0,6).map(chart => { const bar = chart.querySelector('.recharts-bar-rectangle path'); const svg = chart.querySelector('svg'); return {width:chart.getBoundingClientRect().width,height:chart.getBoundingClientRect().height,svg:!!svg,svgOpacity:svg && getComputedStyle(svg).opacity,bars:chart.querySelectorAll('.recharts-bar-rectangle').length,bar:bar ? {fill:getComputedStyle(bar).fill,visibility:getComputedStyle(bar).visibility,display:getComputedStyle(bar).display,opacity:getComputedStyle(bar).opacity,clip:bar.closest('.recharts-bar')?.getAttribute('clip-path'),box:{x:bar.getBoundingClientRect().x,y:bar.getBoundingClientRect().y,width:bar.getBoundingClientRect().width,height:bar.getBoundingClientRect().height},d:bar.getAttribute('d')} : null,clips:[...chart.querySelectorAll('clipPath rect')].map(rect => ({width:rect.getAttribute('width'),height:rect.getAttribute('height')}))};})})`);
  console.log(name, metrics.result.value);
  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(`tmp/responsive-page-${name}.png`, Buffer.from(screenshot.data, "base64"));
};

await send("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 812,
  deviceScaleFactor: 1,
  mobile: true,
});
await wait(800);
await evaluate("document.querySelector('button[aria-label=\"Ativar modo escuro\"]')?.click()");
await wait(500);

await navigateSubpage("Financeiro", "Resumo");
await inspect("financeiro-resumo");

await navigateSubpage("Financeiro", "Conciliação");
await inspect("conciliacao");

await navigateSubpage("Financeiro", "Baixa de Recebimentos");
await inspect("recebimentos");

await navigateSubpage("Financeiro", "Baixa de Despesas");
await inspect("despesas");
await evaluate("[...document.querySelectorAll('*')].forEach(element => { if (element.scrollHeight > element.clientHeight) element.scrollTop = element.scrollHeight; })");
await wait(500);
await inspect("despesas-lista");
await evaluate("[...document.querySelectorAll('*')].forEach(element => { if (element.scrollHeight > element.clientHeight) element.scrollTop = 0; })");

await openMenu();
await clickButton("Pagamentos");
await inspect("pagamentos");

await openMenu();
await clickButton("Importações");
await inspect("importacoes");

await navigateSubpage("Análises", "Análise de Unidades");
await wait(2500);
await inspect("analise-unidades");
await evaluate("[...document.querySelectorAll('*')].forEach(element => { if (element.scrollHeight > element.clientHeight) element.scrollTop = Math.min(760, element.scrollHeight); })");
await wait(500);
await inspect("analise-unidades-graficos");

socket.close();
import { writeFileSync } from "node:fs";
