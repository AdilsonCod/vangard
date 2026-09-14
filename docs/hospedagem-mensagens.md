# Frontend e mensagens em hospedagens separadas

O frontend permanece na Vercel, com o domínio atual. O serviço de campanhas roda em outro servidor usando `message-service.Dockerfile`. As APIs existentes de links e demais funções da Vercel permanecem como estão.

## Backend de mensagens

- Build Docker: `docker build -f message-service.Dockerfile -t vangard-messages .`
- Executar uma única instância continuamente, com volume persistente montado em `/data`.
- Disponibilizar HTTPS público. A aplicação escuta em `PORT` (fornecida pela plataforma) ou `MESSAGE_SERVICE_PORT`, com padrão 3001.
- Health check: `GET /health`, resposta esperada `{"status":"ok","service":"message-dispatch"}`.
- Configurar `MESSAGE_ALLOWED_ORIGINS=https://sistema.barbeariavangard.com.br,https://vangard-sistema.vercel.app`.
- Configurar `FIREBASE_SERVICE_ACCOUNT_JSON` como segredo do backend, com a credencial do projeto existente.
- Configurar `MESSAGE_AUTH_ENCRYPTION_KEY` como segredo aleatório de pelo menos 32 caracteres. Preservar a mesma chave entre deploys para abrir a sessão salva.
- Configurar `WHATSAPP_AUTH_VAULT=/data/whatsapp/session.enc` e `MESSAGE_AUTO_CONNECT=true`.
- Não colocar segredos em variáveis com prefixo `VITE_`, imagem Docker ou Git.

## Frontend Vercel

Definir `VITE_MESSAGE_SERVICE_URL` com a URL HTTPS pública do backend, sem barra final, e reconstruir/publicar o frontend. Esta variável é incorporada durante o build.

## Validação após publicar

1. Conferir `/health` no backend.
2. Abrir Disparo de mensagens no domínio do sistema e confirmar Serviço online.
3. Conectar via QR Code com o operador autorizado.
4. Validar campanha com destinatário de teste autorizado, incluindo pausa, retomada e cancelamento.

A sessão do WhatsApp fica no volume criptografado. A fila de campanha ainda fica em memória: reiniciar o backend durante uma campanha interrompe seu processamento, sem retomada automática. Evitar deploys durante envios. Não configurar múltiplas réplicas para a mesma sessão.
