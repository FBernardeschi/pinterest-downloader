"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// example.ts
const PinterestDownloader_1 = require("./PinterestDownloader");
async function start() {
    const downloader = new PinterestDownloader_1.PinterestDownloader({
        path: 'https://www.pinterest.com/username/boardname/', // URL или username
        dir: './pinterest_downloads',
        vOnly: true, // Скачать только видео
        force: true, // Переписывать существующие
        cookies: './my_cookies.txt', // Файл с куками (строка формата key=val; key2=val2)
        // httpProxy: 'http://127.0.0.1:8080'
    });
    try {
        await downloader.run();
        console.log('Скачивание завершено!');
    }
    catch (error) {
        console.error('Ошибка:', error);
    }
}
start();
