# ============================================================
# Dockerfile для Node.js приложения
# ============================================================
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

WORKDIR /usr/src/app

# Копируем только манифесты — кэш слоя
COPY package.json package-lock.json ./

# Ставим production-зависимости строго по lock-файлу
RUN npm ci --omit=dev && npm cache clean --force

# Убираем npm / corepack / yarn из runtime — они не нужны
# Это уменьшает образ и убирает источники CVE (brace-expansion, tar, ip-address внутри npm)
RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /opt/yarn-v1.22.22 \
      /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg

# Копируем код приложения с правильным владельцем
COPY --chown=node:node . .

# На всякий случай — .env не должен попасть в образ
RUN rm -f .env .env.* || true

# Non-root пользователь
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "index.js"]