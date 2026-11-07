# Адреса приложения

Production UI по умолчанию использует API на своём origin по пути `/api`.
nginx удаляет этот префикс перед отправкой backend и переписывает пути cookie
с `/login/...` на `/api/login/...`. Обработчики OAuth в UI остаются по
`/auth/google/callback`, `/auth/yandex/callback`, `/auth/telegram/callback`.

Передайте `BACKEND_UPSTREAM=http://backend:8000` при запуске frontend-контейнера,
если сервис backend называется `backend` и подключён к той же сети.
Не добавляйте завершающий `/`. Для backend на хосте Compose по умолчанию
использует `http://host.docker.internal:8000`. Backend должен быть доступен
из контейнерной сети; публично открывать порт 8000 не требуется.

HTTPS завершается на внешнем reverse proxy с сертификатом вашего домена.
Этот proxy направляет весь трафик в frontend nginx. Настройте в backend
`CORS_ALLOWED_ORIGINS=https://ваш-домен` и точные HTTPS callback URL провайдеров.
Те же callback URL зарегистрируйте у провайдеров. Секреты храните только в backend.
Публичный домен, DNS и сертификат этим изменением не создаются.

Локальная разработка: API использует hostname текущей страницы и порт 8000.
При необходимости задайте `REACT_APP_API_BASE_URL` перед сборкой UI или запуском
dev-сервера. Переменные `REACT_APP_*` не меняют уже собранный образ при запуске.
Абсолютный внешний API допустим как override, но требует корректных CORS и cookie.
