import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
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

  app.post("/api/generate-post-idea", async (req, res) => {
    try {
      const { tema, publico } = req.body;

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
