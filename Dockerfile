# Этап сборки приложения
FROM node:20-alpine AS builder

# Установка зависимостей и инструментов сборки
RUN apk add --no-cache git python3 make g++

# Рабочая директория
WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY package.json package-lock.json ./
# Чистая установка зависимостей с автоматической коррекцией lock-файла
RUN npm ci --no-cache --update-notifier=false || \
    (echo "Попытка восстановления..." && npm install --force)
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
COPY nginx.conf /etc/nginx/conf.d/

# Открываем порт 3000
EXPOSE 3000

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]

