FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json message-service-server.ts message-dispatch-service.ts message-auth-store.ts server-auth.ts server-firebase-admin.ts firebase-applet-config.json ./
RUN npm run build:messages

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/message-service.cjs ./dist/message-service.cjs
VOLUME ["/data"]
EXPOSE 3001
CMD ["node", "dist/message-service.cjs"]
