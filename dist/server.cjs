var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// message-dispatch-service.ts
var import_baileys = __toESM(require("@whiskeysockets/baileys"), 1);
var import_pino = __toESM(require("pino"), 1);
var import_qrcode = __toESM(require("qrcode"), 1);
var AUTH_DIRECTORY = process.env.WHATSAPP_AUTH_DIR || ".whatsapp-session";
var MAX_CONTACTS = 200;
var state = { enabled: true, connectionStatus: "disconnected", currentQr: "", isSending: false, progress: 0, total: 0, currentAction: "Aguardando conex\xE3o.", logs: [], campaignStatus: "idle", successCount: 0, errorCount: 0, errorDetails: [], runId: "" };
var socket = null;
var connecting = false;
var addLog = (text, type = "info") => {
  state.logs.unshift({ id: crypto.randomUUID(), time: (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR"), text, type });
  state.logs = state.logs.slice(0, 80);
};
var pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var authorized = (req) => {
  const expected = process.env.MESSAGE_DISPATCH_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.header("x-dispatch-secret") === expected;
};
var guard = (req, res) => {
  if (authorized(req)) return true;
  res.status(403).json({ error: "Informe a chave operacional configurada no servidor." });
  return false;
};
var publicState = () => ({ ...state, currentQr: state.currentQr, errorDetails: state.errorDetails.slice(0, 100) });
async function connect() {
  if (connecting || state.connectionStatus === "connected") return;
  connecting = true;
  state.connectionStatus = "connecting";
  state.currentAction = "Inicializando conex\xE3o com o WhatsApp...";
  try {
    const { state: authState, saveCreds } = await (0, import_baileys.useMultiFileAuthState)(AUTH_DIRECTORY);
    socket = (0, import_baileys.default)({ auth: authState, printQRInTerminal: false, logger: (0, import_pino.default)({ level: "silent" }), browser: ["Van\u2019s Management", "Chrome", "1.0.0"] });
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        state.connectionStatus = "qr";
        state.currentQr = await import_qrcode.default.toDataURL(qr);
        state.currentAction = "Escaneie o QR Code para conectar.";
      }
      if (connection === "open") {
        connecting = false;
        state.connectionStatus = "connected";
        state.currentQr = "";
        state.currentAction = "WhatsApp conectado e pronto.";
        addLog("WhatsApp conectado com sucesso.", "success");
      }
      if (connection === "close") {
        connecting = false;
        state.connectionStatus = "disconnected";
        state.currentQr = "";
        state.currentAction = "WhatsApp desconectado.";
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== import_baileys.DisconnectReason.loggedOut) setTimeout(() => void connect(), 3e3);
      }
    });
  } catch (error) {
    connecting = false;
    state.connectionStatus = "disconnected";
    state.currentAction = "Falha ao iniciar a conex\xE3o.";
    addLog(error instanceof Error ? error.message : "Falha de conex\xE3o.", "warning");
  }
}
function configureMessageDispatch(app2) {
  app2.get("/api/message-dispatch/status", (req, res) => {
    if (!guard(req, res)) return;
    res.json(publicState());
  });
  app2.post("/api/message-dispatch/connect", async (req, res) => {
    if (!guard(req, res)) return;
    void connect();
    res.json({ success: true });
  });
  app2.post("/api/message-dispatch/stop", (req, res) => {
    if (!guard(req, res)) return;
    state.isSending = false;
    state.campaignStatus = "stopped";
    state.currentAction = "Envio interrompido pelo operador.";
    addLog("Campanha interrompida manualmente.", "warning");
    res.json({ success: true });
  });
  app2.post("/api/message-dispatch/start", async (req, res) => {
    if (!guard(req, res)) return;
    if (state.isSending) {
      res.status(409).json({ error: "J\xE1 existe uma campanha em andamento." });
      return;
    }
    if (state.connectionStatus !== "connected" || !socket) {
      res.status(409).json({ error: "Conecte o WhatsApp antes de iniciar." });
      return;
    }
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const rawContacts = Array.isArray(req.body?.contacts) ? req.body.contacts : String(req.body?.contacts || "").split(/\r?\n/);
    const contacts = [...new Set(rawContacts.map((value) => String(value).replace(/\D/g, "")).map((value) => value.length === 10 || value.length === 11 ? `55${value}` : value).filter((value) => value.length >= 12 && value.length <= 13))];
    const minDelay = Math.max(8, Math.min(120, Number(req.body?.minDelay) || 15));
    const maxDelay = Math.max(minDelay, Math.min(180, Number(req.body?.maxDelay) || 35));
    const simulateTyping = req.body?.simulateTyping !== false;
    if (req.body?.confirmedOptIn !== true) {
      res.status(400).json({ error: "Confirme que os destinat\xE1rios autorizaram o recebimento." });
      return;
    }
    if (!message || message.length > 4096) {
      res.status(400).json({ error: "A mensagem deve ter entre 1 e 4.096 caracteres." });
      return;
    }
    if (!contacts.length || contacts.length > MAX_CONTACTS) {
      res.status(400).json({ error: `Informe entre 1 e ${MAX_CONTACTS} contatos v\xE1lidos.` });
      return;
    }
    res.json({ success: true, total: contacts.length });
    state.isSending = true;
    state.campaignStatus = "running";
    state.runId = crypto.randomUUID();
    state.successCount = 0;
    state.errorCount = 0;
    state.errorDetails = [];
    state.total = contacts.length;
    state.progress = 0;
    state.logs = [];
    addLog(`Campanha iniciada com ${contacts.length} destinat\xE1rio(s).`);
    for (let index = 0; index < contacts.length && state.isSending; index++) {
      const contact = contacts[index];
      let jid = `${contact}@s.whatsapp.net`;
      try {
        state.currentAction = `Validando ${contact}...`;
        const availability = await socket.onWhatsApp(contact);
        if (!availability?.[0]?.exists) throw new Error("N\xFAmero n\xE3o encontrado no WhatsApp");
        jid = availability[0].jid;
        if (simulateTyping) {
          state.currentAction = `Preparando mensagem ${index + 1} de ${contacts.length}...`;
          await socket.sendPresenceUpdate("composing", jid);
          await pause(Math.min(6e3, Math.max(1200, message.length * 45)));
          await socket.sendPresenceUpdate("paused", jid);
        }
        if (!state.isSending) break;
        state.currentAction = `Enviando ${index + 1} de ${contacts.length}...`;
        await socket.sendMessage(jid, { text: message });
        state.successCount++;
        addLog(`Mensagem entregue para ${contact}.`, "success");
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Falha no envio";
        state.errorCount++;
        state.errorDetails.push({ contact, error: detail });
        addLog(`Falha para ${contact}: ${detail}`, "warning");
      }
      state.progress = index + 1;
      if (index < contacts.length - 1 && state.isSending) {
        const seconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        state.currentAction = `Intervalo operacional de ${seconds}s...`;
        for (let elapsed = 0; elapsed < seconds && state.isSending; elapsed++) await pause(1e3);
      }
    }
    if (state.isSending) {
      state.campaignStatus = "completed";
      state.currentAction = "Campanha conclu\xEDda.";
      addLog("Processamento conclu\xEDdo.", "success");
    }
    state.isSending = false;
  });
}

// smart-links-service.ts
var import_promises = require("node:dns/promises");
var import_node_net = require("node:net");
var import_firestore2 = require("firebase/firestore");

// src/firebase.ts
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0595576094",
  appId: "1:840151771043:web:ce866e491e4313faaa5c16",
  apiKey: "AIzaSyCA3DoNDB8xR6cmZBM-SbIM8PzB4B9yOxY",
  authDomain: "gen-lang-client-0595576094.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-vansguard-16394f26-85fa-4c3e-a3d9-b85f6d25ecce",
  storageBucket: "gen-lang-client-0595576094.firebasestorage.app",
  messagingSenderId: "840151771043",
  measurementId: "",
  oAuthClientId: "840151771043-ajaau37no5jf24cs1qdps5hbmieuq5jg.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/firebase.ts
var app = (0, import_app.initializeApp)(firebase_applet_config_default);
var db = (0, import_firestore.initializeFirestore)(app, {
  experimentalForceLongPolling: true
}, firebase_applet_config_default.firestoreDatabaseId || "(default)");

// src/smartLinks.ts
function generateCycleSlug(baseSlug, slugType, cycleNumber, customSlugs = []) {
  const base = baseSlug.toLowerCase().replace(/[^a-z0-9-]/g, "") || "link";
  if (slugType === "custom_list" && customSlugs.length) return customSlugs[(cycleNumber - 1) % customSlugs.length].trim().toLowerCase();
  if (slugType === "sequential_number") return `${base}-${String(cycleNumber).padStart(2, "0")}`;
  let hash = 0;
  for (const character of `${base}:vans:${cycleNumber}`) hash = (hash << 5) - hash + character.charCodeAt(0) | 0;
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  let token = "", value = Math.abs(hash);
  for (let index = 0; index < 4; index++) {
    token += alphabet[value % alphabet.length];
    value = Math.floor(value / alphabet.length) + cycleNumber * 11 + index;
  }
  return `${base}-${token}`;
}
function rotatingStatus(link, at = /* @__PURE__ */ new Date()) {
  const intervalMs = Math.max(1, link.rotationIntervalMinutes || 60) * 6e4;
  const started = new Date(link.rotationStartedAt || link.createdAt).getTime();
  const elapsed = Math.max(0, at.getTime() - started);
  const cycleNumber = Math.floor(elapsed / intervalMs) + 1;
  const offset = elapsed % intervalMs;
  return { cycleNumber, current: generateCycleSlug(link.baseSlug || link.shortCode, link.slugType || "hash_token", cycleNumber, link.customSlugs), next: generateCycleSlug(link.baseSlug || link.shortCode, link.slugType || "hash_token", cycleNumber + 1, link.customSlugs), nextSwitchAt: new Date(at.getTime() + intervalMs - offset).toISOString(), progressPercent: Math.round(offset / intervalMs * 100) };
}
function resolveSmartLink(link, at = /* @__PURE__ */ new Date(), usedCode) {
  const fallback = link.fallbackUrl || "";
  if (!link.isActive) return { url: fallback, phase: "paused", label: "Pausado", activeShortCode: link.shortCode, progressPercent: 0, reason: "Link pausado manualmente." };
  if (link.maxClicks && link.totalClicks >= link.maxClicks) return { url: fallback, phase: "limit", label: "Limite atingido", activeShortCode: link.shortCode, progressPercent: 100, reason: "O limite total de cliques foi atingido." };
  if (link.mode === "rotating_shortlink") {
    const status = rotatingStatus(link, at);
    const base = (link.baseSlug || link.shortCode).toLowerCase();
    const code = (usedCode || status.current).toLowerCase();
    const isBase = code === base;
    const expired = !isBase && code !== status.current;
    if (expired && link.expireOldLinks) return { url: fallback, phase: "expired", label: "C\xF3digo expirado", cycleNumber: status.cycleNumber, activeShortCode: status.current, nextShortCode: status.next, nextSwitchAt: status.nextSwitchAt, progressPercent: status.progressPercent, reason: "Este c\xF3digo pertence a outro ciclo.", expiredSlug: true };
    return { url: link.destinationUrl, phase: "rotating_shortlink", label: `Ciclo ${status.cycleNumber}`, cycleNumber: status.cycleNumber, activeShortCode: status.current, nextShortCode: status.next, nextSwitchAt: status.nextSwitchAt, progressPercent: status.progressPercent, reason: "Destino fixo com c\xF3digo curto rotativo." };
  }
  if (link.mode === "infinite_loop") {
    const stages = (link.destinations || []).filter((item) => item.url && item.durationMinutes > 0);
    if (!stages.length) return { url: link.destinationUrl, phase: "infinite_loop", label: "Destino principal", activeShortCode: link.shortCode, progressPercent: 0, reason: "Nenhuma etapa adicional cadastrada." };
    const cycleMinutes = stages.reduce((sum, item) => sum + item.durationMinutes, 0), cycleMs = cycleMinutes * 6e4;
    const started = new Date(link.rotationStartedAt || link.createdAt).getTime(), elapsed = Math.max(0, at.getTime() - started), cycleNumber = Math.floor(elapsed / cycleMs) + 1;
    let offset = elapsed % cycleMs / 6e4, active = stages[0];
    for (const stage of stages) {
      if (offset < stage.durationMinutes) {
        active = stage;
        break;
      }
      offset -= stage.durationMinutes;
    }
    const remaining = Math.max(0, active.durationMinutes - offset) * 6e4;
    return { url: active.url, phase: "infinite_loop", label: active.name, cycleNumber, activeShortCode: link.shortCode, nextSwitchAt: new Date(at.getTime() + remaining).toISOString(), progressPercent: Math.round(offset / active.durationMinutes * 100), reason: `Etapa ${active.name} do ciclo cont\xEDnuo.` };
  }
  if (link.mode === "dual_switch") {
    const switched = at.getTime() >= new Date(link.switchDate).getTime();
    const start = new Date(link.createdAt).getTime(), end = new Date(link.switchDate).getTime();
    return { url: switched ? link.phaseTwoUrl || fallback : link.phaseOneUrl, phase: switched ? "phase2" : "phase1", label: switched ? "Fase 2" : "Fase 1", activeShortCode: link.shortCode, nextSwitchAt: switched ? void 0 : link.switchDate, progressPercent: switched ? 100 : Math.max(0, Math.min(100, Math.round((at.getTime() - start) / (end - start) * 100))), reason: switched ? "Prazo encerrado; destino final ativo." : "Destino inicial ativo at\xE9 a data programada." };
  }
  const steps = (link.timelineSteps || []).filter((step2) => new Date(step2.startDate).getTime() <= at.getTime() && (!step2.endDate || at.getTime() < new Date(step2.endDate).getTime()) && (!step2.maxClicks || (step2.clickCount || 0) < step2.maxClicks)).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const step = steps[0];
  return { url: step?.url || fallback, phase: step ? "timeline" : "expired", label: step?.name || "Sem etapa ativa", activeShortCode: link.shortCode, nextSwitchAt: step?.endDate, progressPercent: 0, reason: step ? `Etapa cronol\xF3gica \u201C${step.name}\u201D ativa.` : "N\xE3o h\xE1 etapa ativa para esta data." };
}
function findSmartLinkByCode(links, code, at = /* @__PURE__ */ new Date()) {
  const clean = code.toLowerCase();
  const direct = links.find((link) => link.shortCode.toLowerCase() === clean || link.baseSlug?.toLowerCase() === clean);
  if (direct) return direct;
  return links.find((link) => {
    if (link.mode !== "rotating_shortlink") return false;
    const current = rotatingStatus(link, at);
    if (current.current === clean) return true;
    if (!link.expireOldLinks) {
      for (let cycle = Math.max(1, current.cycleNumber - 200); cycle < current.cycleNumber; cycle++) if (generateCycleSlug(link.baseSlug, link.slugType, cycle, link.customSlugs) === clean) return true;
    }
    return false;
  });
}

// smart-links-service.ts
var escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
var device = (agent = "") => /ipad|tablet/i.test(agent) ? "tablet" : /mobile|android|iphone/i.test(agent) ? "mobile" : "desktop";
var privateIpv4 = (address) => {
  const parts = address.split(".").map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168;
};
var privateIpv6 = (address) => address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:");
async function assertPublicUrl(raw) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Protocolo n\xE3o permitido.");
  if (url.username || url.password) throw new Error("URL com credenciais n\xE3o permitida.");
  if (["localhost", "0.0.0.0"].includes(url.hostname.toLowerCase())) throw new Error("Destino interno n\xE3o permitido.");
  const addresses = (0, import_node_net.isIP)(url.hostname) ? [{ address: url.hostname }] : await (0, import_promises.lookup)(url.hostname, { all: true });
  if (addresses.some((item) => item.address.includes(":") ? privateIpv6(item.address) : privateIpv4(item.address))) throw new Error("Destino interno n\xE3o permitido.");
  return url;
}
async function fetchPublicHtml(raw) {
  let url = await assertPublicUrl(raw);
  for (let redirect = 0; redirect < 4; redirect++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8e3);
    try {
      const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 TempoLink/1.0", "accept": "text/html,application/xhtml+xml" } });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        url = await assertPublicUrl(new URL(response.headers.get("location"), url).toString());
        continue;
      }
      if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return null;
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > 25e5) return null;
      const html = await response.text();
      return html.length <= 25e5 ? { html, url } : null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
function statusPage(title, message, status) {
  return { status, html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font:15px system-ui;padding:20px;box-sizing:border-box}.c{max-width:480px;padding:34px;border:1px solid #3f3f46;border-radius:22px;background:#18181b;text-align:center}h1{font-size:22px}p{color:#a1a1aa;line-height:1.6}</style></head><body><div class="c"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>` };
}
async function allLinks() {
  const snapshot = await (0, import_firestore2.getDocs)((0, import_firestore2.collection)(db, "smart_links"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
function configureSmartLinks(app2) {
  app2.get("/api/smart-links/:id/simulate", async (req, res) => {
    try {
      const link = (await allLinks()).find((item) => item.id === req.params.id);
      if (!link) return res.status(404).json({ error: "Link n\xE3o encontrado." });
      const at = req.query.at ? new Date(String(req.query.at)) : /* @__PURE__ */ new Date();
      if (Number.isNaN(at.getTime())) return res.status(400).json({ error: "Data inv\xE1lida." });
      res.json(resolveSmartLink(link, at));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Falha na simula\xE7\xE3o." });
    }
  });
  app2.get("/r/:code", smartLinkRedirectHandler);
}
async function smartLinkRedirectHandler(req, res) {
  try {
    const links = await allLinks();
    const link = findSmartLinkByCode(links, req.params.code, /* @__PURE__ */ new Date());
    if (!link) {
      const page = statusPage("Link n\xE3o encontrado", "O c\xF3digo informado n\xE3o existe ou foi removido.", 404);
      return res.status(page.status).send(page.html);
    }
    const resolution = resolveSmartLink(link, /* @__PURE__ */ new Date(), req.params.code);
    if (!resolution.url) {
      const page = statusPage(resolution.label, link.expiredMessage || resolution.reason, resolution.expiredSlug ? 410 : 404);
      return res.status(page.status).send(page.html);
    }
    await assertPublicUrl(resolution.url);
    await Promise.allSettled([
      (0, import_firestore2.updateDoc)((0, import_firestore2.doc)(db, "smart_links", link.id), { totalClicks: (0, import_firestore2.increment)(1), lastClickAt: (/* @__PURE__ */ new Date()).toISOString() }),
      (0, import_firestore2.addDoc)((0, import_firestore2.collection)(db, "smart_link_clicks"), { linkId: link.id, shortCode: req.params.code, destinationUrl: resolution.url, phase: resolution.phase, cycleNumber: resolution.cycleNumber || null, timestamp: (/* @__PURE__ */ new Date()).toISOString(), device: device(req.headers["user-agent"]), referrer: req.headers.referer || "", simulated: false })
    ]);
    if (!link.maskUrl || req.query.direct === "1") return res.redirect(302, resolution.url);
    const result = await fetchPublicHtml(resolution.url);
    if (!result) return res.redirect(302, resolution.url);
    let html = result.html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "");
    const title = escapeHtml(link.maskTitle || link.title);
    const favicon = link.maskFavicon ? `<link rel="icon" href="${escapeHtml(link.maskFavicon)}">` : "";
    const injection = `<base href="${escapeHtml(result.url.origin)}/" target="_self"><title>${title}</title>${favicon}`;
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (match) => `${match}${injection}`) : `${injection}${html}`;
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("content-type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    const page = statusPage("Destino indispon\xEDvel", error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel abrir este link.", 502);
    return res.status(page.status).send(page.html);
  }
}

// server.ts
var DEEPSEEK_API_URL = (process.env.DEEPSEEK_API_URL || "https://api.deepseek.com").replace(/\/$/, "");
var DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
var AI_WINDOW_MS = 15 * 60 * 1e3;
var AI_MAX_REQUESTS_PER_WINDOW = 20;
var AI_MAX_TEXT_LENGTH = 2e4;
var aiRequestWindows = /* @__PURE__ */ new Map();
function limitAiRequests(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = aiRequestWindows.get(key);
  if (!current || current.resetAt <= now) {
    aiRequestWindows.set(key, { count: 1, resetAt: now + AI_WINDOW_MS });
    next();
    return;
  }
  if (current.count >= AI_MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: "Limite tempor\xE1rio de an\xE1lises atingido. Tente novamente mais tarde." });
    return;
  }
  current.count += 1;
  next();
}
function readLimitedText(value, field, required = false) {
  if (value == null || value === "") {
    if (required) throw new Error(`O campo ${field} \xE9 obrigat\xF3rio.`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`O campo ${field} deve ser texto.`);
  if (value.length > AI_MAX_TEXT_LENGTH) throw new Error(`O campo ${field} excede o limite permitido.`);
  return value.trim();
}
async function generateDeepSeekJson(systemPrompt, userPrompt, temperature = 0.4) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY n\xE3o configurada no servidor.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6e4);
  try {
    const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature,
        max_tokens: 2500,
        stream: false
      }),
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error?.message || `DeepSeek respondeu com HTTP ${response.status}.`);
    }
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("A DeepSeek retornou uma resposta vazia.");
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A DeepSeek excedeu o tempo m\xE1ximo de resposta.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function startServer() {
  const app2 = (0, import_express.default)();
  const PORT = 3e3;
  app2.disable("x-powered-by");
  app2.set("trust proxy", 1);
  app2.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app2.use(import_express.default.json({ limit: "256kb" }));
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  configureMessageDispatch(app2);
  configureSmartLinks(app2);
  app2.post("/api/analyze-marketing", limitAiRequests, async (req, res) => {
    try {
      const conteudos = readLimitedText(req.body?.conteudos, "conteudos");
      const metricas = readLimitedText(req.body?.metricas, "metricas");
      const contexto = readLimitedText(req.body?.contexto, "contexto");
      console.log(`Analyzing metrics via DeepSeek (${DEEPSEEK_MODEL})`);
      const systemPrompt = `
Voc\xEA \xE9 um Engenheiro de IA s\xEAnior e Especialista em Business Intelligence para redes de varejo e servi\xE7os locais. Sua fun\xE7\xE3o \xE9 atuar como o motor de an\xE1lise de uma aba de Marketing e Tr\xE1fego integrada a um sistema de gest\xE3o corporativo. Responda somente com JSON v\xE1lido, sem markdown ou coment\xE1rios externos.
`;
      const userPrompt = `
DADOS RECEBIDOS:

1. CRONOGRAMA DE CONTE\xDADOS:
${conteudos || "N\xE3o informado."}

2. M\xC9TRICAS DE TR\xC1FEGO PAGO:
${metricas || "N\xE3o informado."}

3. CONTEXTO OPERACIONAL:
${contexto || "N\xE3o informado."}

DIRETRIZES DE AN\xC1LISE:
1. Foco no ROAS e Custo por Aquisi\xE7\xE3o (CPA): Identifique imediatamente se o tr\xE1fego pago est\xE1 dando preju\xEDzo ou se h\xE1 espa\xE7o para escala.
2. Alinhamento Conte\xFAdo-Vendas: Cruze se o que est\xE1 sendo postado nas redes sociais resolve o problema comercial atual (ex: se h\xE1 ociosidade em servi\xE7os espec\xEDficos).
3. Resumos "Bate o Olho": Textos curtos, diretos e focados em tomada de decis\xE3o (sem jarg\xF5es excessivamente t\xE9cnicos).

Retorne EXATAMENTE este objeto JSON estrito:
{
  "status_geral_marketing": "CR\xCDTICO" | "ATEN\xC7\xC3O" | "SAUD\xC1VEL",
  "resumo_executivo": "Texto curto resumindo a sa\xFAde do marketing e tr\xE1fego da semana.",
  "metricas_chave": {
    "roas_atual": 0.0,
    "cpa_status": "BOM" | "ALTO" | "CR\xCDTICO",
    "orcamento_utilizado_porcentagem": 0
  },
  "alertas_gargalos": [
    {
      "tipo": "TRAFEGO" | "CONTEUDO" | "OPERACIONAL",
      "descricao": "Descri\xE7\xE3o clara do problema detectado nos dados brutos."
    }
  ],
  "ajustes_rapidos_sugeridos": [
    {
      "acao": "O que a ger\xEAncia deve fazer imediatamente.",
      "justificativa": "Por que essa a\xE7\xE3o \xE9 necess\xE1ria.",
      "impacto_esperado": "O resultado esperado ap\xF3s o ajuste."
    }
  ]
}
`;
      const result = await generateDeepSeekJson(systemPrompt, userPrompt, 0.2);
      res.json(result);
    } catch (error) {
      console.error("DeepSeek marketing analysis failed:", error);
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao realizar a an\xE1lise de marketing." });
    }
  });
  app2.post("/api/generate-post-idea", limitAiRequests, async (req, res) => {
    try {
      const tema = readLimitedText(req.body?.tema, "tema", true);
      const publico = readLimitedText(req.body?.publico, "publico");
      const systemPrompt = `
Voc\xEA \xE9 um diretor de conte\xFAdo e marketing para barbearias e est\xE9tica masculina. Responda somente com JSON v\xE1lido, sem markdown ou coment\xE1rios externos.
`;
      const userPrompt = `
Crie UMA (1) ideia de postagem extremamente engajadora e pr\xE1tica baseada no tema fornecido.

TEMA: "${tema}"
P\xDABLICO-ALVO: "${publico || "Homens que frequentam barbearia, buscam estilo e autocuidado"}"

Retorne o resultado estritamente neste formato JSON:
{
  "titulo": "T\xEDtulo chamativo e curto (gancho)",
  "roteiro": "Descri\xE7\xE3o detalhada do roteiro cena a cena (se v\xEDdeo) ou conte\xFAdo da legenda/texto (se imagem/carrossel). Foque em reter a aten\xE7\xE3o.",
  "plataforma": "Instagram",
  "formato": "Reels"
}
`;
      const result = await generateDeepSeekJson(systemPrompt, userPrompt, 0.8);
      res.json(result);
    } catch (error) {
      console.error("DeepSeek post generation failed:", error);
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao gerar ideia com IA." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.use((req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
