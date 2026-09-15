# ============================================================
# Dockerfile для Node.js приложения
# ============================================================

FROM node:24-alpine

WORKDIR /usr/src/app

# Копируем ВСЁ, кроме того, что в .dockerignore
# Важно: node_modules должен быть в .dockerignore
COPY . .

# Ставим зависимости
RUN npm install --omit=dev

# Проверка, что критичные модули на месте
RUN test -d /usr/src/app/node_modules/dotenv && \
    test -d /usr/src/app/node_modules/express && \
    echo "✅ Critical modules OK" || \
    (echo "❌ dotenv or express NOT FOUND" && exit 1)

EXPOSE 3000

CMD ["node", "index.js"]