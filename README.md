# Culta: проверка REST API заказов

## Локальный запуск

```bash
npm ci
npm start
```

Откройте http://localhost:3000/profile/orders и войдите обычным способом.
В режиме разработки API по умолчанию: http://localhost:8000.
Для другого адреса скопируйте `.env.example` в `.env.local`, задайте
`REACT_APP_API_BASE_URL` и перезапустите frontend. Для сборки тот же параметр
нужно задать **до** `npm run build`. Runtime-настройка `window.config`, если
она задана в окружении развёртывания, имеет приоритет.

Backend необходимо запустить отдельно с его `.env`, PostgreSQL и миграциями.
Веб-приложение не создаёт пользователей, роли и товары для тестов автоматически.
Нужны существующий клиент, карточка товара и сотрудник с ролью владельца,
администратора или официанта в выбранном заведении. Повар может просматривать
заказы и менять доступные ему статусы. Сама роль суперадмина не даёт права
управлять заказами в текущем backend.

## Сценарии проверки первого исправления backend

1. Выберите заведение, перейдите в «Заказы». Создайте заказ, указав UUID клиента
   и товара этого заведения, затем откройте его по ID. Можно использовать готовый заказ.
2. Измените комментарий, время или количество и сохраните. Ожидается успешный
   ответ и предложение обновить заказ. Сбой WebSocket не должен давать HTTP 500.
3. Введите случайный, но корректный UUID в «ID заказа»: ожидается HTTP 404.
   Введите `not-a-uuid`: ожидается HTTP 422 с описанием поля.
4. Выберите другое заведение, где у аккаунта тоже есть роль сотрудника, и
   откройте прежний заказ по ID: ожидается HTTP 403. Для клиента чужой заказ
   также недоступен; собственные заказы видны в личном режиме.
5. Откройте один созданный заказ в двух вкладках сотрудника. В первой закройте
   или отмените его. Во второй сохраните изменённый комментарий: ожидается
   HTTP 409. Черновик остаётся виден; редактирование блокируется до обновления.
6. Обновите закрытый заказ: поля и кнопка сохранения должны быть заблокированы.
   Переходы статуса соответствуют ролям пользователя в текущем заведении.
7. Нажмите «Обновить список» и проверьте фильтры «Готов», «Закрыт», «Отменён».

Список обновляется вручную: WebSocket — следующий пункт плана. Стоимость
показывается как получена из API; серверный расчёт суммы пока не реализован.
После ошибки отправки не повторяйте создание вслепую: создание заказа и его
позиций в текущем backend ещё не атомарно, поэтому проверьте список заказов.

## Автоматические проверки

```bash
npm test -- --watchAll=false --runInBand
npx tsc --noEmit
npm run build
```

Тесты UI подменяют API и проверяют права интерфейса, обработку ошибок,
формирование PATCH, обновление после конфликта и смену компании.
Они не заменяют проверку с PostgreSQL по сценариям выше.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
