import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { configureMessageDispatch } from "./message-dispatch-service";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const AI_WINDOW_MS = 15 * 60 * 1000;
const AI_MAX_REQUESTS_PER_WINDOW = 20;
const AI_MAX_TEXT_LENGTH = 20_000;
const aiRequestWindows = new Map<string, { count: number; resetAt: number }>();

function limitAiRequests(req: express.Request, res: express.Response, next: express.NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const current = aiRequestWindows.get(key);

  if (!current || current.resetAt <= now) {
    aiRequestWindows.set(key, { count: 1, resetAt: now + AI_WINDOW_MS });
    next();
    return;
  }

  if (current.count >= AI_MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'Limite temporário de análises atingido. Tente novamente mais tarde.' });
    return;
  }

  current.count += 1;
  next();
}

function readLimitedText(value: unknown, field: string, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`O campo ${field} é obrigatório.`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`O campo ${field} deve ser texto.`);
  if (value.length > AI_MAX_TEXT_LENGTH) throw new Error(`O campo ${field} excede o limite permitido.`);
  return value.trim();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(express.json({ limit: '256kb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  configureMessageDispatch(app);

  app.post("/api/analyze-marketing", limitAiRequests, async (req, res) => {
    try {
      const conteudos = readLimitedText(req.body?.conteudos, 'conteudos');
      const metricas = readLimitedText(req.body?.metricas, 'metricas');
      const contexto = readLimitedText(req.body?.contexto, 'contexto');

      console.log("Analyzing metrics via Gemini");
      const prompt = `
Você é um Engenheiro de IA sênior e Especialista em Business Intelligence para redes de varejo e serviços locais. Sua função é atuar como o motor de análise de uma aba de Marketing e Tráfego integrada a um sistema de gestão corporativo.

DADOS RECEBIDOS:
1. CRONOGRAMA DE CONTEÚDOS:
${conteudos || "Não informado."}

2. MÉTRICAS DE TRÁFEGO PAGO:
${metricas || "Não informado."}

3. CONTEXTO OPERACIONAL:
${contexto || "Não informado."}

DIRETRIZES DE ANÁLISE:
1. Foco no ROAS e Custo por Aquisição (CPA): Identifique imediatamente se o tráfego pago está dando prejuízo ou se há espaço para escala.
2. Alinhamento Conteúdo-Vendas: Cruze se o que está sendo postado nas redes sociais resolve o problema comercial atual (ex: se há ociosidade em serviços específicos).
3. Resumos "Bate o Olho": Textos curtos, diretos e focados em tomada de decisão (sem jargões excessivamente técnicos).

Retorne EXATAMENTE este objeto JSON estrito:
{
  "status_geral_marketing": "CRÍTICO" | "ATENÇÃO" | "SAUDÁVEL",
  "resumo_executivo": "Texto curto resumindo a saúde do marketing e tráfego da semana.",
  "metricas_chave": {
    "roas_atual": 0.0,
    "cpa_status": "BOM" | "ALTO" | "CRÍTICO",
    "orcamento_utilizado_porcentagem": 0
  },
  "alertas_gargalos": [
    {
      "tipo": "TRAFEGO" | "CONTEUDO" | "OPERACIONAL",
      "descricao": "Descrição clara do problema detectado nos dados brutos."
    }
  ],
  "ajustes_rapidos_sugeridos": [
    {
      "acao": "O que a gerência deve fazer imediatamente.",
      "justificativa": "Por que essa ação é necessária.",
      "impacto_esperado": "O resultado esperado após o ajuste."
    }
  ]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
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
      const tema = readLimitedText(req.body?.tema, 'tema', true);
      const publico = readLimitedText(req.body?.publico, 'publico');

      const prompt = `
Você é um diretor de conteúdo viral e marketing para barbearias e estética masculina.
Crie UMA (1) ideia de postagem extremamente engajadora e prática baseada no tema fornecido.

TEMA: "${tema}"
PÚBLICO-ALVO: "${publico || 'Homens que frequentam barbearia, buscam estilo e autocuidado'}"

Retorne o resultado estritamente neste formato JSON:
{
  "titulo": "Título chamativo e curto (gancho)",
  "roteiro": "Descrição detalhada do roteiro cena a cena (se vídeo) ou conteúdo da legenda/texto (se imagem/carrossel). Foque em reter a atenção.",
  "plataforma": "Instagram",
  "formato": "Reels"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.9,
        }
      });
      
      const text = response.text || "{}";
      res.json(JSON.parse(text));
    } catch (error) {
      console.error("Erro ao gerar post", error);
      res.status(500).json({ error: "Erro ao gerar ideia com IA" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
