# 📥 Pinterest Downloader API

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey)](https://expressjs.com/)
[![License](https://img.shields.io/badge/license-MIT-red)](LICENSE)

REST API для получения прямых ссылок и скачивания медиафайлов (видео и изображений) с Pinterest. Сервер выступает в роли парсера, обходя блокировки Pinterest и возвращая клиенту готовый потоковый файл. 

API автоматически извлекает максимально доступное качество видео (720p, 1080p и т.д.), отфильтровывает неподдерживаемые браузерами кодеки (HEVC/H.265) и потоки HLS (`.m3u8`), возвращая стандартный MP4 (H.264).

## 📦 Требования

- **Node.js** версии 18 или выше
- **npm** (устанавливается вместе с Node.js)
- **Git** (для клонирования репозитория)

## 🚀 Установка

### 1. Клонирование и установка зависимостей

```bash
git clone https://github.com/FBernardeschi/pinterest-downloader.git
cd pinterest-downloader
npm install
```

### 2. Запуск сервера

```bash
npm run start
```

Сервер поднимется на `http://localhost:3000`.

## 🔗 API Эндпоинты

### Скачивание медиафайла

Метод принимает GET-запрос с параметрами `url` и `type`, обращается к Pinterest, извлекает прямую ссылку и начинает стримить файл обратно клиенту.

**Запрос:**
```http
GET http://localhost:3000/api/download?url=<PINTEREST_URL>&type=video
```

**Параметры строки запроса (Query):**

| Параметр | Тип     | Обязательный | Описание                                          |
| :------- | :------ | :----------- | :------------------------------------------------ |
| `url`    | string  | Да           | URL-адрес пина в Pinterest (поддерживаются `pin.it` и локализованные домены). |
| `type`   | string  | Да           | Тип скачиваемого файла. Доступные значения: `video`, `image`. |

**Пример использования (cURL):**
```bash
curl -OJ "http://localhost:3000/api/download?url=<PINTEREST_URL>&type=video"
```

## ⚙️ Как это работает

1. Сервер получает URL пина от клиента.
2. Происходит валидация URL на соответствие доменам Pinterest и защита от SSRF.
3. Сервер обращается к стороннему сервису-прокси для обхода антибот-защиты Pinterest и получения JSON с метаданными пина.
4. Из полученного JSON извлекается массив доступных видеоформатов.
5. Скрипт отфильтровывает потоки `.m3u8` и кодеки `hevc/h265`, затем сортирует оставшиеся `.mp4` файлы по разрешению и выбирает максимальное.
6. Сервер делает запрос к CDN Pinterest (`v.pinimg.com`) с `responseType: 'stream'` и передает поток напрямую в HTTP-ответ клиенту с заголовком `Content-Disposition: attachment`.

## 📂 Структура проекта

```
├── src
│   ├── middleware
│   │   ├── errorHandler.ts   # Обработчик ошибок (asyncHandler)
│   │   └── rateLimit.ts      # Заглушка для rate лимитера
│   ├── routes
│   │   └── downloadRoutes.ts # Основной роутер с валидацией
│   ├── services
│   │   └── pinterestService.ts# Логика парсинга и извлечения прямых ссылок
│   └── utils
│       └── validator.ts      # Утилиты валидации URL и типов
├── server.ts                 # Точка входа Express
├── package.json
└── tsconfig.json
```