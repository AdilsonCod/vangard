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
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");

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
function configureMessageDispatch(app) {
  app.get("/api/message-dispatch/status", (req, res) => {
    if (!guard(req, res)) return;
    res.json(publicState());
  });
  app.post("/api/message-dispatch/connect", async (req, res) => {
    if (!guard(req, res)) return;
    void connect();
    res.json({ success: true });
  });
  app.post("/api/message-dispatch/stop", (req, res) => {
    if (!guard(req, res)) return;
    state.isSending = false;
    state.campaignStatus = "stopped";
    state.currentAction = "Envio interrompido pelo operador.";
    addLog("Campanha interrompida manualmente.", "warning");
    res.json({ success: true });
  });
  app.post("/api/message-dispatch/start", async (req, res) => {
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

// server.ts
var ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.use(import_express.default.json({ limit: "256kb" }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  configureMessageDispatch(app);
  app.post("/api/analyze-marketing", limitAiRequests, async (req, res) => {
    try {
      const conteudos = readLimitedText(req.body?.conteudos, "conteudos");
      const metricas = readLimitedText(req.body?.metricas, "metricas");
      const contexto = readLimitedText(req.body?.contexto, "contexto");
      console.log("Analyzing metrics via Gemini");
      const prompt = `
Voc\xEA \xE9 um Engenheiro de IA s\xEAnior e Especialista em Business Intelligence para redes de varejo e servi\xE7os locais. Sua fun\xE7\xE3o \xE9 atuar como o motor de an\xE1lise de uma aba de Marketing e Tr\xE1fego integrada a um sistema de gest\xE3o corporativo.

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
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const responseText = response.text || "{}";
      const result = JSON.parse(responseText);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to perform marketing analysis." });
    }
  });
  app.post("/api/generate-post-idea", limitAiRequests, async (req, res) => {
    try {
      const tema = readLimitedText(req.body?.tema, "tema", true);
      const publico = readLimitedText(req.body?.publico, "publico");
      const prompt = `
Voc\xEA \xE9 um diretor de conte\xFAdo viral e marketing para barbearias e est\xE9tica masculina.
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
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.9
        }
      });
      const text = response.text || "{}";
      res.json(JSON.parse(text));
    } catch (error) {
      console.error("Erro ao gerar post", error);
      res.status(500).json({ error: "Erro ao gerar ideia com IA" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.use((req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
