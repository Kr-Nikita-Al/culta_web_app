# Makefile для управления Docker-контейнером

# Переменные
IMAGE_NAME = cafe-staff-frontend
CONTAINER_NAME = cafe-staff-container
PORT = 3000
HOST_IP = 193.106.174.216
API_URL = http://${HOST_IP}:8000
ENV = production

.PHONY: build run stop clean

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
		-p ${HOST_IP}:${PORT}:3000 \
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