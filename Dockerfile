# Этап сборки приложения
FROM node:20-alpine AS builder

# Установка зависимостей и инструментов сборки
RUN apk add --no-cache git python3 make g++

# Рабочая директория
WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY package.json package-lock.json .npmrc ./
COPY patches ./patches
# Устанавливаем только версии из lock-файла; ошибка останавливает сборку.
RUN npm ci --no-audit --no-fund --update-notifier=false

# Копируем исходный код
COPY . .

# Устанавливаем переменные окружения
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_ENV=production

# Сборка приложения
RUN npm run build

# Проверяем существование файлов сборки
RUN ls -la build

# Этап запуска приложения
FROM nginx:1.23-alpine

# Удаляем дефолтную конфигурацию Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Копируем собранное приложение
COPY --from=builder /app/build /usr/share/nginx/html

# Копируем конфиг Nginx
ENV BACKEND_UPSTREAM=http://host.docker.internal:8000
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Открываем порт 80 (стандартный для Nginx)
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
