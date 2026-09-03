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
var ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/analyze-marketing", async (req, res) => {
    try {
      const {
        conteudos,
        metricas,
        contexto
      } = req.body;
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
  app.post("/api/generate-post-idea", async (req, res) => {
    try {
      const { tema, publico } = req.body;
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
//# sourceMappingURL=server.cjs.map
