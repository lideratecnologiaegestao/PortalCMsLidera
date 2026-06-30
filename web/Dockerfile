# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_* são inlined no build (não lidos em runtime). O host de plataforma
# (super_admin) precisa ser conhecido no build para o middleware reescrever "/"
# -> "/plataforma" no host certo. Default mantém compat com a prefeitura.
ARG NEXT_PUBLIC_PLATFORM_HOST=prefeitura.lidera.app.br
ENV NEXT_PUBLIC_PLATFORM_HOST=$NEXT_PUBLIC_PLATFORM_HOST
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# saída standalone do Next (next.config.mjs: output: 'standalone')
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# cache de ISR/fetch precisa ser gravável pelo usuário 'node'
RUN mkdir -p .next/cache && chown -R node:node .next
USER node
EXPOSE 3000
CMD ["node", "server.js"]
