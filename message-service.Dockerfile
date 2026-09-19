FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# Os módulos do worker evoluem em conjunto e possuem imports cruzados. Copiar
# todos os arquivos TypeScript da raiz evita que um novo módulo fique fora da
# imagem enquanto o .dockerignore continua protegendo credenciais e dados locais.
COPY tsconfig.json firebase-applet-config.json ./
COPY *.ts ./
COPY src/services/messageCampaignSchema.ts ./src/services/
RUN npm run build:messages

FROM node:22-bookworm-slim
ENV NODE_ENV=production
ENV WHATSAPP_AUTH_VAULT=/data/whatsapp/session.enc
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/message-service.cjs ./dist/message-service.cjs
EXPOSE 3001
CMD ["node", "dist/message-service.cjs"]
