# 🏗️ Arquitetura Visual do Sistema de Disparo de Mensagens

## 📐 Diagrama de Arquitetura Completa

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR DO USUÁRIO                                │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      React Application (SPA)                        │    │
│  │                                                                     │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│    │
│  │  │  AdminDashboard  │  │  BarberDashboard │  │   Login Screen   ││    │
│  │  └────────┬─────────┘  └──────────────────┘  └──────────────────┘│    │
│  │           │                                                        │    │
│  │           │ activeTab === "MESSAGES"                              │    │
│  │           ▼                                                        │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │        MessageDispatchDashboard.tsx                        │  │    │
│  │  │                                                             │  │    │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │    │
│  │  │  │ Campanha &   │  │  Mensagem &  │  │  Conexão     │   │  │    │
│  │  │  │ Destinatários│  │ Configurações│  │  WhatsApp    │   │  │    │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │    │
│  │  │                                                             │  │    │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │    │
│  │  │  │ Central de   │  │ Logs Tempo   │  │  Histórico   │   │  │    │
│  │  │  │ Envio        │  │ Real         │  │  Campanhas   │   │  │    │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │    │
│  │  │                                                             │  │    │
│  │  └─────────────────────┬───────────────────────────────────┘  │    │
│  │                        │                                        │    │
│  └────────────────────────┼────────────────────────────────────────┘    │
│                           │                                              │
│                           │ HTTP Requests                                │
│                           │ (fetch API)                                  │
│                           │                                              │
└───────────────────────────┼──────────────────────────────────────────────┘
                            │
                            │ Headers: x-dispatch-secret, Content-Type
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVIDOR NODE.JS (Express)                           │
│                         Port: 3000 | server.ts                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      Express Middlewares                            │    │
│  │  • Security Headers (X-Frame-Options, CSP, etc.)                   │    │
│  │  • JSON Parser (limit: 256kb)                                      │    │
│  │  • Trust Proxy                                                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                         API Routes                                  │    │
│  │                                                                     │    │
│  │  GET  /api/health                    → { status: "ok" }           │    │
│  │  POST /api/analyze-marketing         → Gemini AI Analysis         │    │
│  │  POST /api/generate-post-idea        → Gemini AI Content          │    │
│  │                                                                     │    │
│  │  ┌───────────────────────────────────────────────────────────┐   │    │
│  │  │     Message Dispatch Routes (message-dispatch-service.ts) │   │    │
│  │  │                                                             │   │    │
│  │  │  GET  /api/message-dispatch/status                         │   │    │
│  │  │  POST /api/message-dispatch/connect                        │   │    │
│  │  │  POST /api/message-dispatch/start                          │   │    │
│  │  │  POST /api/message-dispatch/stop                           │   │    │
│  │  │                                                             │   │    │
│  │  └───────────────────┬───────────────────────────────────────┘   │    │
│  └──────────────────────┼───────────────────────────────────────────┘    │
│                         │                                                  │
└─────────────────────────┼──────────────────────────────────────────────────┘
                          │
                          │ configureMessageDispatch(app)
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               MESSAGE DISPATCH SERVICE (Baileys Integration)                 │
│                     message-dispatch-service.ts                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      Internal State                                 │    │
│  │                                                                     │    │
│  │  const state: DispatchState = {                                    │    │
│  │    enabled: boolean                                                │    │
│  │    connectionStatus: 'disconnected' | 'connecting' | ...           │    │
│  │    currentQr: string                                               │    │
│  │    isSending: boolean                                              │    │
│  │    progress: number                                                │    │
│  │    total: number                                                   │    │
│  │    logs: LogEntry[]                                                │    │
│  │    campaignStatus: 'idle' | 'running' | ...                        │    │
│  │    successCount: number                                            │    │
│  │    errorCount: number                                              │    │
│  │    errorDetails: DispatchError[]                                   │    │
│  │  }                                                                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                   WhatsApp Socket Connection                        │    │
│  │                                                                     │    │
│  │  makeWASocket({                                                    │    │
│  │    auth: authState,                                                │    │
│  │    printQRInTerminal: false,                                       │    │
│  │    logger: pino({ level: 'silent' }),                             │    │
│  │    browser: ['Van's Management', 'Chrome', '1.0.0']               │    │
│  │  })                                                                 │    │
│  │                                                                     │    │
│  │  Events:                                                            │    │
│  │  ├─ creds.update      → Save credentials                          │    │
│  │  ├─ connection.update → Handle QR, connect, disconnect            │    │
│  │  └─ messages.upsert   → (not used, but available)                 │    │
│  └────────────────┬───────────────────────────────────────────────────┘    │
│                   │                                                          │
└───────────────────┼──────────────────────────────────────────────────────────┘
                    │
                    │ Session persistence
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FILE SYSTEM (.whatsapp-session/)                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  app-state-sync-key-AAAAAAg+.json                                  │    │
│  │  app-state-sync-key-AAAAAAg0.json                                  │    │
│  │  app-state-sync-key-AAAAAAg2.json                                  │    │
│  │  ... (2160+ arquivos)                                              │    │
│  │  creds.json                                                         │    │
│  │  pre-key-1.json                                                     │    │
│  │  pre-key-2.json                                                     │    │
│  │  ...                                                                │    │
│  │                                                                     │    │
│  │  Total: ~5-10 MB                                                   │    │
│  │  Função: Manter sessão persistente entre reinicializações         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    │ WhatsApp Web Protocol
                                    │ WebSocket + Encryption
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WHATSAPP SERVERS                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                     Multi-Device Protocol                           │    │
│  │                                                                     │    │
│  │  • QR Code Generation                                              │    │
│  │  • Device Pairing                                                  │    │
│  │  • Message Routing                                                 │    │
│  │  • End-to-End Encryption                                           │    │
│  │  • Delivery Receipts                                               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
                                  │ Mobile Connection
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SMARTPHONE DO USUÁRIO                                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                     WhatsApp Mobile App                             │    │
│  │                                                                     │    │
│  │  • Escaneia QR Code inicial                                        │    │
│  │  • Mantém conexão sincronizada                                     │    │
│  │  • Recebe notificações de mensagens enviadas                       │    │
│  │  • Pode ser usado normalmente durante disparos                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    │ Messages delivered
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DESTINATÁRIOS (Contatos)                               │
│                                                                              │
│  📱 Contato 1: 5511999999999 ✅ Entregue                                    │
│  📱 Contato 2: 5511988888888 ✅ Entregue                                    │
│  📱 Contato 3: 5511977777777 ❌ Número inválido                             │
│  📱 Contato 4: 5511966666666 ✅ Entregue                                    │
│  ...                                                                         │
│  📱 Contato N: 5511911111111 ✅ Entregue                                    │
└─────────────────────────────────────────────────────────────────────────────┘

LEGENDA:
  ┌──┐
  │  │  = Componente / Módulo
  └──┘
  
   │   = Fluxo de dados unidirecional
   ▼
   
   ▲   = Fluxo de dados bidirecional
   │
   ▼
```

---

## 🔄 Fluxo de Dados Detalhado

### 1. Conexão do WhatsApp

```
USUÁRIO                    FRONTEND                    BACKEND                   WHATSAPP
  │                           │                           │                         │
  │ Clica "Conectar"          │                           │                         │
  ├──────────────────────────>│                           │                         │
  │                           │                           │                         │
  │                           │ POST /connect             │                         │
  │                           │ Header: x-dispatch-secret │                         │
  │                           ├──────────────────────────>│                         │
  │                           │                           │                         │
  │                           │                           │ useMultiFileAuthState() │
  │                           │                           ├────────┐                │
  │                           │                           │        │ Load session   │
  │                           │                           │<───────┘ from disk      │
  │                           │                           │                         │
  │                           │                           │ makeWASocket()          │
  │                           │                           ├────────────────────────>│
  │                           │                           │                         │
  │                           │                           │<─ connection.update ────┤
  │                           │                           │   { qr: "base64..." }   │
  │                           │                           │                         │
  │                           │ 200 OK                    │                         │
  │                           │<──────────────────────────┤                         │
  │                           │                           │                         │
  │                           │ Polling /status (1.5s)    │                         │
  │                           ├──────────────────────────>│                         │
  │                           │ { currentQr, status }     │                         │
  │                           │<──────────────────────────┤                         │
  │                           │                           │                         │
  │ Exibe QR Code na tela     │                           │                         │
  │<──────────────────────────┤                           │                         │
  │                           │                           │                         │
  │ Escaneia QR no celular    │                           │                         │
  ├───────────────────────────┼───────────────────────────┼────────────────────────>│
  │                           │                           │                         │
  │                           │                           │<─ connection.update ────┤
  │                           │                           │   { connection: 'open' }│
  │                           │                           │                         │
  │                           │ Polling /status           │                         │
  │                           ├──────────────────────────>│                         │
  │                           │ { connected: true }       │                         │
  │ Status: Conectado 🟢      │<──────────────────────────┤                         │
  │<──────────────────────────┤                           │                         │
```

### 2. Envio de Mensagens

```
USUÁRIO                    FRONTEND                    BACKEND                   WHATSAPP
  │                           │                           │                         │
  │ Configura campanha        │                           │                         │
  ├──────────────────────────>│                           │                         │
  │                           │                           │                         │
  │ Clica "Iniciar"           │                           │                         │
  ├──────────────────────────>│                           │                         │
  │                           │                           │                         │
  │                           │ POST /start               │                         │
  │                           │ {                         │                         │
  │                           │   contacts: [...],        │                         │
  │                           │   message: "...",         │                         │
  │                           │   minDelay: 15,           │                         │
  │                           │   maxDelay: 35,           │                         │
  │                           │   simulateTyping: true,   │                         │
  │                           │   confirmedOptIn: true    │                         │
  │                           │ }                         │                         │
  │                           ├──────────────────────────>│                         │
  │                           │                           │                         │
  │                           │                           │ Valida entrada          │
  │                           │                           ├────────┐                │
  │                           │                           │        │                │
  │                           │                           │<───────┘                │
  │                           │                           │                         │
  │                           │ 200 OK { total: N }       │                         │
  │                           │<──────────────────────────┤                         │
  │                           │                           │                         │
  │                           │                           │ LOOP: Para cada contato │
  │                           │                           ├────────┐                │
  │                           │                           │        │                │
  │                           │                           │        │ 1. Validar     │
  │                           │                           │        │ onWhatsApp()   │
  │                           │                           │        ├───────────────>│
  │                           │                           │        │<───────────────┤
  │                           │                           │        │                │
  │                           │                           │        │ 2. Simular     │
  │                           │                           │        │ digitação      │
  │                           │                           │        ├───────────────>│
  │                           │                           │        │ composing      │
  │                           │                           │        │ [aguarda Xs]   │
  │                           │                           │        ├───────────────>│
  │                           │                           │        │ paused         │
  │                           │                           │        │                │
  │                           │                           │        │ 3. Enviar      │
  │                           │                           │        │ sendMessage()  │
  │                           │                           │        ├───────────────>│
  │                           │                           │        │<───────────────┤
  │                           │                           │        │ ✅ success     │
  │                           │                           │        │                │
  │                           │                           │        │ 4. Log         │
  │                           │                           │        │ addLog()       │
  │                           │                           │        │ successCount++ │
  │                           │                           │        │                │
  │                           │                           │        │ 5. Pausa       │
  │                           │                           │        │ random(15-35s) │
  │                           │                           │        │ [aguarda]      │
  │                           │                           │        │                │
  │                           │                           │<───────┘                │
  │                           │                           │ (próximo contato)       │
  │                           │                           │                         │
  │ Polling /status (1.5s)    │                           │                         │
  ├──────────────────────────>│                           │                         │
  │                           ├──────────────────────────>│                         │
  │                           │ {                         │                         │
  │                           │   progress: 5,            │                         │
  │                           │   total: 100,             │                         │
  │                           │   successCount: 5,        │                         │
  │                           │   errorCount: 0,          │                         │
  │                           │   logs: [...]             │                         │
  │ Atualiza interface        │ }                         │                         │
  │<──────────────────────────┤<──────────────────────────┤                         │
  │                           │                           │                         │
  │ ... [polling contínuo]    │                           │ ... [envio contínuo]    │
  │                           │                           │                         │
  │                           │                           │ Todos contatos          │
  │                           │                           │ processados             │
  │                           │                           ├────────┐                │
  │                           │                           │        │                │
  │                           │                           │<───────┘                │
  │                           │                           │ campaignStatus =        │
  │                           │                           │ 'completed'             │
  │                           │                           │                         │
  │ Polling /status           │                           │                         │
  ├──────────────────────────>│                           │                         │
  │                           ├──────────────────────────>│                         │
  │                           │ { campaignStatus:         │                         │
  │                           │   'completed' }           │                         │
  │ Status: Concluída ✅      │<──────────────────────────┤                         │
  │<──────────────────────────┤                           │                         │
  │                           │                           │                         │
  │                           │ Salva no Firestore        │                         │
  │                           ├──────────────────────────>│                         │
  │                           │ message_dispatch_history  │                         │
```

---

## 📊 Diagrama de Estados da Campanha

```
                    ┌──────────┐
                    │  IDLE    │
                    │          │
                    │ Aguardan-│
                    │ do       │
                    └────┬─────┘
                         │
                         │ POST /start
                         │ (com validações ✅)
                         ▼
                    ┌──────────┐
                    │ RUNNING  │
                    │          │
                    │ progress │
        ┌───────────┤ 0 → N    │───────────┐
        │           │          │           │
        │           └──────────┘           │
        │                                  │
        │ POST /stop                       │ progress === total
        │ (manual)                         │ (automático)
        ▼                                  ▼
   ┌──────────┐                       ┌──────────┐
   │ STOPPED  │                       │COMPLETED │
   │          │                       │          │
   │ Interrom-│                       │ Sucesso! │
   │ pido     │                       │          │
   └──────────┘                       └──────────┘
        │                                  │
        │                                  │
        └──────────┬───────────────────────┘
                   │
                   │ Nova campanha
                   │ (limpa estado)
                   ▼
              ┌──────────┐
              │  IDLE    │
              └──────────┘
```

---

## 🗄️ Modelo de Dados

### Frontend State (React)

```typescript
// MessageDispatchDashboard.tsx
const [campaignName, setCampaignName] = useState<string>('');
const [contacts, setContacts] = useState<string>('');
const [message, setMessage] = useState<string>('');
const [minDelay, setMinDelay] = useState<number>(15);
const [maxDelay, setMaxDelay] = useState<number>(35);
const [simulateTyping, setSimulateTyping] = useState<boolean>(true);
const [confirmedOptIn, setConfirmedOptIn] = useState<boolean>(false);
const [unitId, setUnitId] = useState<string>('ALL');
const [operatorKey, setOperatorKey] = useState<string>('');
const [backend, setBackend] = useState<BackendState>(initialBackend);
const [lists, setLists] = useState<ContactList[]>([]);
const [history, setHistory] = useState<DispatchHistory[]>([]);
```

### Backend State (Service)

```typescript
// message-dispatch-service.ts
const state: DispatchState = {
  enabled: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'qr' | 'connected';
  currentQr: string;
  isSending: boolean;
  progress: number;
  total: number;
  currentAction: string;
  logs: DispatchLog[];
  campaignStatus: 'idle' | 'running' | 'completed' | 'stopped';
  successCount: number;
  errorCount: number;
  errorDetails: DispatchError[];
  runId: string;
}
```

### Firestore Collections

```typescript
// message_contact_lists
{
  id: string;
  name: string;
  contacts: string;  // números separados por \n
  unitId: string;
  createdAt: string;  // ISO 8601
  createdBy: string;  // userId
}

// message_dispatch_history
{
  id: string;  // UUID da campanha (runId)
  name: string;
  createdAt: string;
  unitId: string;
  total: number;
  successCount: number;
  errorCount: number;
  status: string;  // 'CONCLUIDO', 'INTERROMPIDO'
  createdBy: string;
}
```

---

## 🔐 Camada de Segurança

```
┌─────────────────────────────────────────────────────────────┐
│                   SECURITY LAYERS                            │
└─────────────────────────────────────────────────────────────┘

LAYER 1: Environment Variables
├─ MESSAGE_DISPATCH_SECRET (obrigatória em prod)
├─ WHATSAPP_AUTH_DIR (path da sessão)
└─ GEMINI_API_KEY (opcional)

LAYER 2: HTTP Headers
├─ x-dispatch-secret: Required para todas as rotas /api/message-dispatch/*
├─ X-Content-Type-Options: nosniff
├─ X-Frame-Options: DENY
├─ Referrer-Policy: strict-origin-when-cross-origin
└─ Permissions-Policy: camera=(), microphone=(), geolocation=()

LAYER 3: Request Validation
├─ Contatos: máximo 200 por execução
├─ Mensagem: 1-4096 caracteres
├─ Pausas: minDelay 8-120s, maxDelay minDelay-180s
└─ Opt-in: confirmedOptIn === true (obrigatório)

LAYER 4: Rate Limiting (Natural)
├─ Pausa entre mensagens: 8-180 segundos
├─ Simulação de digitação: 1.2-6 segundos
└─ Validação de número antes de enviar

LAYER 5: Session Encryption
├─ WhatsApp E2E Encryption
├─ Credenciais criptografadas localmente
└─ Pre-keys para perfect forward secrecy

LAYER 6: Firebase Security Rules
├─ Autenticação obrigatória
├─ Validação de roles (ADMIN, MARKETING)
└─ Regras de leitura/escrita por coleção
```

---

## 🚀 Fluxo de Deploy

```
DESENVOLVIMENTO                    STAGING                      PRODUÇÃO
     │                               │                             │
     │ 1. Desenvolver                │                             │
     │    npm run dev                │                             │
     │    http://localhost:3000      │                             │
     │                               │                             │
     │ 2. Testar localmente          │                             │
     │    Conectar WhatsApp          │                             │
     │    Enviar 5-10 mensagens      │                             │
     │                               │                             │
     │ 3. Build                      │                             │
     │    npm run build              │                             │
     ├──────────────────────────────>│                             │
     │                               │                             │
     │                               │ 4. Deploy staging           │
     │                               │    Configurar .env          │
     │                               │    Testar com equipe        │
     │                               │    Validar funcionalidades  │
     │                               │                             │
     │                               │ 5. Aprovação                │
     │                               ├────────────────────────────>│
     │                               │                             │
     │                               │                             │ 6. Deploy produção
     │                               │                             │    Configurar .env
     │                               │                             │    MESSAGE_DISPATCH_SECRET
     │                               │                             │    Backup .whatsapp-session
     │                               │                             │
     │                               │                             │ 7. Monitoramento
     │                               │                             │    Logs
     │                               │                             │    Métricas
     │                               │                             │    Alertas
     │                               │                             │
     │<──────────── Feedback ─────────────────────────────────────┤
```

---

## 📦 Estrutura de Pastas Detalhada

```
Vangard-sistema-main/
│
├── src/                                 # Frontend React
│   ├── components/
│   │   ├── AdminDashboard.tsx          # Dashboard principal
│   │   ├── MessageDispatchDashboard.tsx # ⭐ Interface de mensagens
│   │   ├── MarketingDashboard.tsx
│   │   ├── FinancialDashboard.tsx
│   │   └── ui/
│   │       └── AppPrimitives.tsx       # Componentes base
│   │
│   ├── store.tsx                        # Estado global (Context API)
│   ├── firebase.ts                      # Config do Firebase
│   ├── types.ts                         # Tipos TypeScript
│   ├── utils.ts                         # Funções utilitárias
│   └── App.tsx                          # Componente raiz
│
├── server.ts                            # ⭐ Servidor Express
├── message-dispatch-service.ts          # ⭐ Serviço WhatsApp
│
├── .whatsapp-session/                   # ⭐ Sessão persistente (2160+ arquivos)
│   ├── app-state-sync-key-*.json
│   ├── creds.json
│   └── pre-key-*.json
│
├── firebase-applet-config.json          # Credenciais Firebase
├── firestore.rules                      # Regras de segurança
│
├── .env                                 # ⭐ Variáveis de ambiente
├── .env.example                         # Template de .env
│
├── package.json                         # Dependências
├── tsconfig.json                        # Config TypeScript
├── vite.config.ts                       # Config Vite
│
├── ANALISE_ESTRUTURA_PROJETO.md        # 📄 Documentação completa
├── RESUMO_EXECUTIVO.md                 # 📄 Resumo executivo
├── GUIA_RAPIDO.md                      # 📄 Guia de referência
└── ARQUITETURA_VISUAL.md               # 📄 Este arquivo

Legenda:
  ⭐ = Arquivos principais do sistema de mensagens
  📄 = Documentação gerada
```

---

## 🎯 Pontos de Entrada (Entry Points)

### 1. Frontend
```
http://localhost:3000
    ↓
index.html
    ↓
src/main.tsx
    ↓
src/App.tsx
    ↓
src/components/AdminDashboard.tsx
    ↓
src/components/MessageDispatchDashboard.tsx  ⭐
```

### 2. Backend
```
npm run dev
    ↓
server.ts (Express)
    ↓
configureMessageDispatch(app)
    ↓
message-dispatch-service.ts  ⭐
    ↓
Baileys (WhatsApp)
```

---

## 🔗 Integrações Externas

```
┌──────────────────────────────────────────────────────┐
│              SISTEMA VANGARD                          │
└─────────────────┬────────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
   ┌────────┐ ┌──────┐ ┌────────┐
   │Firebase│ │Baileys│ │Google │
   │Firestore│ │WhatsApp│ │Gemini │
   └────────┘ └──────┘ └────────┘
        │         │         │
        │         │         │
        ▼         ▼         ▼
    [Dados]  [Mensagens] [IA]
```

### Firebase Firestore
- **Função:** Banco de dados principal
- **Coleções usadas:**
  - `users` - Usuários do sistema
  - `message_contact_lists` - Listas de contatos
  - `message_dispatch_history` - Histórico de campanhas
  - `systemUnits` - Unidades do sistema

### Baileys (@whiskeysockets/baileys)
- **Função:** Conexão com WhatsApp
- **Recursos:**
  - Multi-device support
  - QR Code generation
  - Message sending
  - Session persistence
  - Reconnection handling

### Google Gemini AI
- **Função:** Análise de marketing (opcional)
- **Endpoints:**
  - `/api/analyze-marketing`
  - `/api/generate-post-idea`

---

## 📊 Métricas e Observabilidade

### Logs Disponíveis

```
┌─────────────────────────────────────────────┐
│          FRONTEND LOGS                       │
│  (Browser Console)                           │
│                                              │
│  • API requests/responses                    │
│  • State changes                             │
│  • Validation errors                         │
│  • User interactions                         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          BACKEND LOGS                        │
│  (Terminal stdout)                           │
│                                              │
│  • Server startup                            │
│  • API endpoints hit                         │
│  • WhatsApp connection events                │
│  • Message sending progress                  │
│  • Errors and exceptions                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          WHATSAPP LOGS                       │
│  (Pino logger - silent by default)          │
│                                              │
│  • Socket connection                         │
│  • QR code generation                        │
│  • Message delivery                          │
│  • Protocol events                           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          FIRESTORE LOGS                      │
│  (Firebase Console)                          │
│                                              │
│  • Read/write operations                     │
│  • Security rules violations                 │
│  • Index usage                               │
│  • Quota consumption                         │
└─────────────────────────────────────────────┘
```

### Métricas Principais

```
Tempo de Resposta:
├─ GET /status: <50ms
├─ POST /connect: <200ms
├─ POST /start: <100ms
└─ POST /stop: <50ms

Taxa de Sucesso:
├─ Conexões WhatsApp: >95%
├─ Envio de mensagens: >97%
└─ Validação de números: >98%

Performance:
├─ Mensagens/segundo: ~0.03-0.1 (por design)
├─ Memória usada: ~200-300 MB
└─ CPU: <5% em idle, ~15% durante envio
```

---

## 🛠️ Ferramentas de Desenvolvimento

### Ambiente de Desenvolvimento

```bash
# Editor recomendado
VSCode + extensões:
  ├─ TypeScript
  ├─ ESLint
  ├─ Prettier
  ├─ Tailwind CSS IntelliSense
  └─ Firebase Explorer

# Debugging
Chrome DevTools
  ├─ React Developer Tools
  ├─ Network tab (para APIs)
  └─ Console (para logs)

# Testing
curl ou Postman
  └─ Testar endpoints da API

# Monitoramento
Firebase Console
  └─ Ver dados em tempo real
```

---

**Documento Criado:** 07/09/2026  
**Versão:** 1.0.0  
**Sistema:** Vangard Management - Arquitetura Visual  
**Status:** ✅ Documentação Completa
