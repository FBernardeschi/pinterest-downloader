"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class PinterestService {
    /**
     * Получает прямую ссылку на видео через сторонний сервис convertico.com
     */
    async fetchDirectDownloadLink(pinUrl) {
        try {
            const homeResponse = await axios_1.default.get('https://convertico.com/pinterest-downloader/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                timeout: 15000,
            });
            const homeHtml = homeResponse.data;
            const tokenMatch = homeHtml.match(/const authTokens = \{\s*t:\s*'([^']+)',\s*h:\s*'([^']+)'\s*\}/);
            if (!tokenMatch) {
                throw new Error('Could not extract auth tokens from convertico.com');
            }
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
            let responseData = processResponse.data;
            if (typeof responseData === 'string') {
                responseData = JSON.parse(responseData);
            }
            if (!responseData.videos || responseData.videos.length === 0) {
                throw new Error('Videos array is empty.');
            }
            let bestVideo = null;
            let maxResolution = 0;
            for (const video of responseData.videos) {
                if (video.is_hls || video.url.includes('hevc') || video.url.includes('h265')) {
                    continue;
                }
                const resMatch = video.url.match(/\/(\d+)p\//);
                const qualityMatch = video.quality.match(/(\d+)/);
                const resolution = resMatch ? parseInt(resMatch[1], 10) : (qualityMatch ? parseInt(qualityMatch[1], 10) : 0);
                if (resolution > maxResolution) {
                    maxResolution = resolution;
                    bestVideo = video;
                }
            }
            if (!bestVideo) {
                bestVideo = responseData.videos.find(v => !v.is_hls && v.url.endsWith('.mp4')) || null;
            }
            if (!bestVideo) {
                throw new Error('Video URL not found in the response. The pin might not contain a video.');
            }
            const directUrl = bestVideo.url;
            const pinIdMatch = pinUrl.match(/\/pin\/(\d+)/);
            const pinId = pinIdMatch ? pinIdMatch[1] : 'pinterest_video';
            const filename = `${pinId}.mp4`;
            return { directUrl, filename };
        }
        catch (error) {
            console.error('[DEBUG] Convertico error:', error.message);
            throw new Error(`Failed to fetch video link: ${error.message}`);
        }
    }
}
exports.default = new PinterestService();
