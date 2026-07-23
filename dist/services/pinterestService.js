"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/services/pinterestService.ts
const axios_1 = __importDefault(require("axios"));
class PinterestService {
    /**
     * Общий метод: получает сырой JSON от convertico.com
     */
    async fetchRawData(pinUrl) {
        try {
            // 1. GET запрос для получения токенов
            const homeResponse = await axios_1.default.get('https://convertico.com/pinterest-downloader/', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                timeout: 15000,
            });
            const tokenMatch = homeResponse.data.match(/const authTokens = \{\s*t:\s*'([^']+)',\s*h:\s*'([^']+)'\s*\}/);
            if (!tokenMatch)
                throw new Error('Could not extract auth tokens');
            const t = tokenMatch[1];
            const h = tokenMatch[2];
            // 2. POST запрос
            const formData = new URLSearchParams();
            formData.append('url', pinUrl);
            formData.append('t', t);
            formData.append('h', h);
            const processResponse = await axios_1.default.post('https://convertico.com/pinterest-downloader/process.php', formData.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://convertico.com/pinterest-downloader/'
                },
                timeout: 15000,
            });
            let data = processResponse.data;
            if (typeof data === 'string')
                data = JSON.parse(data);
            return data;
        }
        catch (error) {
            throw new Error(`Failed to fetch Pinterest metadata: ${error.message}`);
        }
    }
    /**
     * Вспомогательный метод: выбирает лучшее видео (без HEVC и HLS)
     */
    extractBestVideo(videos) {
        if (!videos || videos.length === 0)
            return null;
        let bestVideo = null;
        let maxResolution = 0;
        for (const video of videos) {
            if (video.is_hls || video.url.includes('hevc') || video.url.includes('h265'))
                continue;
            const resMatch = video.url.match(/\/(\d+)p\//);
            const qualityMatch = video.quality.match(/(\d+)/);
            const resolution = resMatch ? parseInt(resMatch[1], 10) : (qualityMatch ? parseInt(qualityMatch[1], 10) : 0);
            if (resolution > maxResolution) {
                maxResolution = resolution;
                bestVideo = video;
            }
        }
        if (!bestVideo) {
            bestVideo = videos.find(v => !v.is_hls && v.url.endsWith('.mp4')) || null;
        }
        return bestVideo ? bestVideo.url : null;
    }
    /**
     * Для downloadRoutes.ts: возвращает прямую ссылку и имя файла
     */
    async getDirectDownloadLink(pinUrl) {
        const data = await this.fetchRawData(pinUrl);
        const directUrl = this.extractBestVideo(data.videos || []);
        if (!directUrl)
            throw new Error('Video URL not found. The pin might not contain a video.');
        const pinIdMatch = pinUrl.match(/\/pin\/(\d+)/);
        const pinId = pinIdMatch ? pinIdMatch[1] : 'pinterest_video';
        const filename = `${pinId}.mp4`;
        return { directUrl, filename };
    }
    /**
     * Для downloadApiRoutes.ts: возвращает JSON с метаданными
     */
    async getApiMetadata(pinUrl) {
        const data = await this.fetchRawData(pinUrl);
        const videoUrl = this.extractBestVideo(data.videos || []);
        if (!videoUrl)
            throw new Error('Video not available for this pin');
        // Ищем лучшее превью
        const thumbnail = data.images?.find((img) => img.quality === 'Original')?.url
            || data.images?.[0]?.url
            || '';
        return {
            username: "Pinterest", // В ответе convertico нет автора
            caption: `${data.title || ''}\n${data.description || ''}`.trim(),
            thumbnail: thumbnail,
            no_wm: videoUrl,
            wm: videoUrl
        };
    }
}
exports.default = new PinterestService();
