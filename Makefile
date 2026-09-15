# Makefile для управления Docker-контейнером фронтенда

# Переменные
IMAGE_NAME = cafe-staff-frontend
CONTAINER_NAME = cafe-staff-frontend
PORT = 80
HOST_IP = 84.201.185.28
API_URL = http://${HOST_IP}:8000
ENV = production

.PHONY: build run stop clean deploy logs check-files status restart

# Собрать Docker-образ
build:
	docker build \
		--build-arg REACT_APP_API_BASE_URL=${API_URL} \
		--build-arg REACT_APP_ENV=${ENV} \
		-t ${IMAGE_NAME} .

# Запустить контейнер
run:
	docker run -d \
		--name ${CONTAINER_NAME} \
		-p ${PORT}:80 \
		--restart unless-stopped \
		${IMAGE_NAME}

# Остановить и удалить контейнер
stop:
	docker stop ${CONTAINER_NAME} || true
	docker rm ${CONTAINER_NAME} || true

# Очистка: остановить контейнер и удалить образ
clean: stop
	docker rmi ${IMAGE_NAME} || true

# Полный деплой: сборка + запуск
deploy: build run

# Просмотр логов
logs:
	docker logs -f ${CONTAINER_NAME}

# Проверка файлов в контейнере
check-files:
	docker exec -it ${CONTAINER_NAME} ls -la /usr/share/nginx/html

# Проверка статуса контейнера
status:
	docker ps -a | grep ${CONTAINER_NAME} || echo "Container not found"

# Перезапуск
restart: stop run
