# Serviço persistente de mensagens

Implementação da Tarefa 19 de [`tasks.md`](./tasks.md), conforme a arquitetura e os requisitos do [`prd.md`](./prd.md).

## Separação dos processos

- A aplicação web continua sendo publicada na Vercel.
- O Baileys é executado separadamente por `message-service-server.ts` em um host com processo e volume persistentes (VM, Render, Railway, Fly.io ou serviço equivalente).
- O frontend acessa esse serviço pela URL definida em `VITE_MESSAGE_SERVICE_URL` e envia o Firebase ID Token em todas as requisições.
- O serviço valida o token e permite somente `ADMIN`, `MARKETING` e `RECEPTION`.

O serviço não deve ser hospedado em uma função serverless/efêmera. Reinícios e novas publicações do frontend não afetam sua conexão com o WhatsApp.

## Sessão criptografada

As credenciais do Baileys são persistidas em um único cofre AES-256-GCM. Configure:

- `WHATSAPP_AUTH_VAULT=/data/whatsapp/session.enc`
- `MESSAGE_AUTH_ENCRYPTION_KEY=<segredo aleatório com 32 ou mais caracteres>`

Monte `/data` como volume persistente. O segredo deve permanecer no cofre de segredos do provedor, nunca no Git e nunca em variável iniciada por `VITE_`. A sessão antiga de `.whatsapp-session` não é importada automaticamente; após a migração, conecte uma vez pelo QR Code.

## Implantação

1. Construa o arquivo `message-service.Dockerfile`.
2. Publique a porta `3001` (ou defina `MESSAGE_SERVICE_PORT`).
3. Configure `FIREBASE_PROJECT_ID` e `FIREBASE_SERVICE_ACCOUNT_JSON` no host persistente.
4. Configure `MESSAGE_ALLOWED_ORIGINS` com o domínio exato da aplicação Vercel.
5. Configure no build da Vercel `VITE_MESSAGE_SERVICE_URL=https://mensagens.seu-dominio`.
6. Confirme `GET /health` e então conecte o WhatsApp no painel.

Em desenvolvimento, execute `npm run dev` e `npm run dev:messages` em terminais separados. O frontend usa `http://localhost:3001` como padrão local.

## Falhas

Se o serviço estiver fora do ar, o painel mostra um aviso e desabilita as ações dependentes da conexão. Os demais módulos continuam funcionando normalmente. O polling restaura o estado automaticamente quando o serviço volta.

## Verificação

- `npm run test:message-auth-store` comprova que o arquivo persistido não contém os dados em texto claro e pode ser restaurado.
- `npm run typecheck`, `npm run lint` e `npm run build` verificam os dois processos.

