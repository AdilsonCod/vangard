# Arquitetura técnica — baseline

Baseline observado em 9 de setembro de 2026. As regras de negócio pertencem ao [PRD](./prd.md); este documento descreve somente a implementação e a operação atuais.

## 1. Visão geral

```text
Navegador
  └─ React + TypeScript + Tailwind
       ├─ Firebase Authentication
       ├─ Cloud Firestore
       └─ APIs HTTP
            ├─ Express local/servidor persistente
            │    ├─ DeepSeek
            │    ├─ Baileys / WhatsApp
            │    └─ Links inteligentes
            └─ Vercel Function
                 └─ Redirecionamento público /r/:code
```

O frontend é uma SPA. `src/main.tsx` monta a aplicação e `src/App.tsx` seleciona login, redirecionamento público, painel administrativo ou painel profissional. Os painéis principais usam carregamento sob demanda.

O `StoreProvider`, em `src/store.tsx`, mantém a sessão e sincroniza dados do Firestore em tempo real. Parte das coleções privadas já utiliza consulta filtrada por unidade, mas o isolamento completo é trabalho previsto no [plano progressivo](./tasks.md).

## 2. Componentes

### 2.1 Frontend

- React 19 e React DOM 19.
- TypeScript 5.9 com alvo ES2022.
- Vite 6 como servidor de desenvolvimento e bundler.
- Tailwind CSS 4 para estilos.
- Recharts para gráficos.
- Firebase Web SDK para Auth e Firestore.
- Papa Parse e SheetJS para CSV e planilhas.
- PDF.js, jsPDF, html2canvas e html-to-image para leitura e exportação.
- Aplicação responsiva com painéis diferentes por perfil.

O build usa divisão manual para React, Firebase, gráficos, Excel, PDF e exportadores. Os artefatos são gerados em `dist/`.

### 2.2 Servidor Express

`server.ts` é o ponto de entrada do servidor local e do processo Node persistente:

- entrega a SPA compilada em produção;
- integra o middleware do Vite em desenvolvimento;
- disponibiliza `/api/health`;
- valida Firebase ID Tokens nas rotas protegidas;
- encaminha solicitações de IA para a DeepSeek;
- registra as rotas de mensagens e links inteligentes.

No baseline, a validação do token usa as chaves públicas do Google diretamente. A migração para Firebase Admin SDK está planejada na Tarefa 12.

### 2.3 Firebase

O Firebase fornece:

- autenticação de usuários;
- persistência no Cloud Firestore;
- listeners em tempo real;
- regras de segurança em `firestore.rules`.

A configuração pública do projeto fica em `firebase-applet-config.json`. Ela identifica o projeto cliente e não deve receber credenciais administrativas. O arquivo `firebase-blueprint.json` representa um esquema histórico e não substitui os tipos nem as regras atuais.

Não existe `firebase.json` no baseline. Publicação de regras utiliza o fluxo específico existente ou deve ser formalizada antes da liberação final.

### 2.4 Vercel

`vercel.json` declara uma aplicação Vite e reescreve `/r/:code` para `/api/r/:code`. A função `api/r/[code].ts` executa o redirecionamento público de links inteligentes.

O servidor Express completo não é transformado automaticamente em Vercel Function por essa configuração. Recursos que precisam de processo persistente, especialmente Baileys, não devem depender da execução efêmera da Vercel.

### 2.5 Serviço persistente de mensagens

`message-dispatch-service.ts` usa `@whiskeysockets/baileys` e mantém a autenticação no diretório configurado para a sessão do WhatsApp.

No baseline, esse serviço é carregado pelo mesmo processo Express. A arquitetura alvo, prevista na Tarefa 19, separa-o em um processo persistente com armazenamento seguro da sessão. A interface web continuará consumindo-o por API autenticada e autorizada.

### 2.6 DeepSeek

As funções de IA são chamadas exclusivamente pelo servidor. A chave não deve ser entregue ao frontend. Há limite de corpo, timeout, formato JSON esperado e limite temporário de requisições em memória.

### 2.7 Código Python legado

O diretório `backend/` e alguns scripts Python contêm motores ou protótipos auxiliares de conciliação. Eles não fazem parte do ponto de entrada `npm run dev` nem do build Node atual. Qualquer promoção desse código para produção exige decisão arquitetural e documentação próprias.

## 3. Fluxos principais

### 3.1 Autenticação

1. O navegador autentica o usuário pelo Firebase Authentication.
2. A aplicação resolve o perfil correspondente no Firestore.
3. O perfil determina painel, unidade e opções disponíveis.
4. Chamadas protegidas ao servidor devem enviar Firebase ID Token.
5. Servidor e regras do Firestore devem validar identidade e autorização.

Limitações conhecidas do baseline, acompanhadas nas Tarefas 3 a 14:

- compatibilidade legada com ID armazenado localmente;
- documentos legados podem exigir a execução controlada da migração para apagar campos de senha antigos;
- necessidade de padronizar `users/{uid}`;
- regras e consultas ainda não cobrem todo o isolamento por perfil e unidade;
- frontend e rotas protegidas ainda precisam ser alinhados em um cliente HTTP comum.

### 3.2 Persistência

O frontend utiliza listeners do Firestore para cadastros, lançamentos, estatísticas, transações, pagamentos, avisos e configurações. Módulos especializados também acessam diretamente suas coleções.

Gravações compostas que precisam ser indivisíveis devem usar lote ou transação. Regras de atomicidade e auditoria são determinadas pelo [PRD](./prd.md).

### 3.3 Importações

O importador lê Excel, CSV, texto e PDF no navegador, identifica ou solicita o tipo do relatório, apresenta pré-visualização e persiste estatísticas e pagamentos. Parsers especializados tratam Rede, dPote e Cashbarber.

Arquivos devem ser tratados como entrada não confiável. Confirmação de substituição, fingerprint e fórmulas financeiras seguem o PRD.

### 3.4 Financeiro e conciliação

As entidades financeiras são mantidas principalmente no Firestore. Conciliação, caixa, recebimentos, despesas, pagamentos e análises compartilham dados, mas ainda existem cálculos distribuídos em componentes. A centralização progressiva está descrita nas Tarefas 15 e 16.

### 3.5 Links inteligentes

O painel persiste configurações e métricas no Firestore. A simulação é uma rota protegida do Express. O redirecionamento `/r/:code` é público por finalidade e possui uma implementação compatível com a Vercel.

### 3.6 Mensagens

O painel prepara contatos e campanhas. O servidor controla a sessão Baileys e o estado do envio. A sessão precisa de armazenamento persistente, e as operações administrativas precisam de autenticação, autorização e auditoria.

## 4. Coleções de dados observadas

As coleções abaixo foram identificadas no código. A lista registra o baseline e não concede permissão de acesso:

- Identidade e configuração: `users`, `authUsers`, `systemUnits`, `appSettings`.
- Cadastros: `catalog`, `categories`, `subcategories`, `financialCategories`, `finClassifications`, `finSubclassifications`, `suppliers`.
- Operação: `entries`, `gdvEntries`, `gdvSettings`, `targets`.
- Indicadores: `monthlyUnitStats`, `monthlyBarberStats`.
- Financeiro: `transactions`, `cashClosings`, `payments`, `commissionConfigs`.
- Conciliação e relatórios: `reconciliation_reports`, `reports_manual_weeks`, `dataImportJobs`.
- Comunicação: `announcements`, `notifications`, `message_contact_lists`, `message_dispatch_history`, `dispatch_audit`.
- Marketing: `marketing_campaigns`, `marketing_traffic`, `marketing_organic`, `social_posts`, `social_library`.
- Links: `smart_links`, `smart_link_clicks`.

O catálogo definitivo de dados, seus proprietários e políticas de retenção deve acompanhar as regras do Firestore nas tarefas de segurança.

## 5. Ambientes

### 5.1 Desenvolvimento local

- Entrada: `npm run dev`.
- Endereço padrão: `http://localhost:3000`.
- Express inicia o Vite em modo middleware.
- Variáveis locais são carregadas por `dotenv`.

### 5.2 Build e execução Node

- `npm run build` gera a SPA e empacota `server.ts` como `dist/server.cjs`.
- `npm start` executa o servidor compilado.
- O servidor entrega os arquivos estáticos de `dist/` em produção.

### 5.3 Vercel

- Framework declarado: Vite.
- O frontend é gerado a partir do código-fonte.
- A rota pública de link usa `api/r/[code].ts`.
- APIs do Express que não possuem função equivalente precisam de hospedagem Node própria ou adaptação explícita.

### 5.4 Homologação e produção

Homologação deve usar projeto, credenciais e dados separados de produção. Migrações devem possuir simulação e backup verificável. O deploy final deve ser identificável por commit.

## 6. Variáveis de ambiente

Somente nomes e finalidades são documentados. Valores reais devem permanecer nos gerenciadores de segredos dos ambientes.

| Variável | Ambiente | Finalidade |
|---|---|---|
| `DEEPSEEK_API_KEY` | Servidor | Autenticar solicitações de IA. Obrigatória para recursos DeepSeek. |
| `DEEPSEEK_MODEL` | Servidor | Selecionar o modelo compatível utilizado pela integração. |
| `DEEPSEEK_API_URL` | Servidor | Sobrescrever o endpoint compatível da API. |
| `WHATSAPP_AUTH_DIR` | Servidor persistente | Definir o diretório persistente da sessão Baileys. |
| `NODE_ENV` | Servidor/build | Alternar desenvolvimento e produção. |
| `GENERATE_SOURCEMAP` | Build | Habilitar sourcemaps quando explicitamente necessário. |
| `DISABLE_HMR` | Desenvolvimento | Desabilitar HMR e observação de arquivos em ambientes especiais. |
| `VITE_ENABLE_DATABASE_SEED` | Frontend/build | Chave histórica para impedir carga automática de dados de exemplo em bancos reais. Deve permanecer desativada fora de ambientes controlados. |

`MESSAGE_DISPATCH_SECRET` ainda aparece no `.env.example`, mas não é consumida pelo servidor atual. Ela pertence ao fluxo legado de chave operacional e deve ser removida quando a autenticação das APIs for concluída nas Tarefas 10 e 11.

## 7. Versões do baseline

Versões declaradas ou observadas no ambiente desta validação:

| Componente | Versão |
|---|---|
| Node.js | 24.20.0 |
| npm | 11.19.0 |
| React / React DOM | 19.0.0 |
| TypeScript | 5.9.3 |
| Vite | 6.4.3 |
| Tailwind CSS | 4.3.3 |
| Express | 5.2.1 |
| Firebase Web SDK | 12.13.0 |
| Baileys | 7.0.0-rc14 |
| Recharts | 3.8.1 |
| PDF.js | 6.3.289 |
| SheetJS | 0.20.3, distribuição indicada no `package.json` |

Para builds reproduzíveis, a referência efetiva é o `package-lock.json`. Atualizações de dependências devem ser revisadas e validadas antes do deploy.

## 8. Comandos operacionais

| Comando | Finalidade |
|---|---|
| `npm run dev` | Iniciar Express e Vite localmente. |
| `npm run typecheck` | Validar tipos sem emitir arquivos. |
| `npm run lint` | Executar ESLint no projeto. |
| `npm run build` | Validar tipos, compilar frontend e empacotar servidor. |
| `npm start` | Executar o servidor compilado. |
| `npm run preview` | Visualizar somente o build Vite. |
| `npm run test:commission` | Testar cálculo de comissão e isolamento previsto pelo módulo. |
| `npm run test:rede-parser` | Testar o parser do relatório Rede. |
| `npm run firestore:import:dry` | Simular importação de backup do Firestore. |
| `npm run firestore:import:apply` | Aplicar importação de backup após validação. |
| `npm run auth:migrate:dry` | Simular migração para Firebase Authentication. |
| `npm run auth:migrate:apply` | Aplicar migração de autenticação após validação. |

Comandos `*:apply` alteram dados externos e só devem ser executados com ambiente, backup e autorização confirmados.

## 9. Validação mínima antes de commit ou deploy

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:commission
npm run test:rede-parser
```

Além dos comandos, alterações de segurança exigem Firebase Emulator; alterações visuais exigem os tamanhos de tela definidos no PRD; alterações de persistência exigem recarga e nova sessão.

## 10. Segredos e arquivos locais

- `.env` é local e não deve ser versionado.
- `.env.example` deve conter apenas exemplos não funcionais.
- Sessões Baileys não devem ser versionadas.
- Credenciais administrativas do Firebase não podem entrar no repositório ou no bundle do navegador.
- `dist/` é artefato de build e sua remoção do Git está prevista na Tarefa 22.
- Logs, backups, capturas e arquivos temporários devem ser revisados antes de qualquer commit.

## 11. Limitações conhecidas

- Autenticação e perfil ainda possuem caminhos legados de sessão e identificação; modelos e formulários da aplicação já não persistem senha.
- Regras do Firestore não cobrem com segurança todas as coleções ativas.
- A autorização por função ainda não está centralizada no servidor.
- Algumas chamadas do frontend não enviam o token exigido pelas APIs.
- O servidor ainda não usa Firebase Admin SDK.
- O serviço Baileys ainda compartilha o processo Express e requer hospedagem persistente.
- Parte dos cálculos financeiros permanece distribuída nas telas.
- Componentes críticos ainda são extensos.
- A cobertura automatizada não representa todos os fluxos do PRD.
- `dist/` ainda está em processo de remoção do controle de versão.

Essas limitações correspondem às tarefas ainda abertas em [tasks.md](./tasks.md) e não devem ser interpretadas como comportamento aprovado pelo PRD.

## 12. Documentos relacionados

- [PRD](./prd.md)
- [Plano progressivo](./tasks.md)
- [Cálculo de Comissão](./CALCULO_COMISSAO.md)
- [Relatório de testes de comissão](./RELATORIO_TESTES_COMISSAO.md)
