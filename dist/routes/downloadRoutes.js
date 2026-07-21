"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/downloadRoutes.ts
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const pinterestService_1 = __importDefault(require("../services/pinterestService"));
const axios_1 = __importDefault(require("axios"));
const validator_1 = require("../utils/validator");
const rateLimit_1 = require("../middleware/rateLimit");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const validateDownloadRequest = [
    (0, express_validator_1.query)('url')
        .notEmpty()
        .withMessage('URL parameter is required')
        .custom(async (value) => {
        if (!validator_1.Validator.isValidPinterestURL(value)) {
            throw new Error('Invalid or unsupported Pinterest URL (must be /pin/... or pin.it)');
        }
        if (!validator_1.Validator.isSSRFSafe(value)) {
            throw new Error('URL not allowed for security reasons');
        }
        return true;
    }),
    (0, express_validator_1.query)('type')
        .notEmpty()
        .withMessage('Type parameter is required')
        .custom(async (value) => {
        if (!validator_1.Validator.isValidDownloadType(value)) {
            throw new Error('Invalid download type. Supported types: image, video');
        }
        return true;
    })
];
router.get('/', rateLimit_1.downloadLimiter, validateDownloadRequest, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: true,
            message: errors.array()[0].msg
        });
    }
    const { url, type } = req.query;
    const log = req.log || console; // Используем console если нет кастомного логгера
    try {
        log.info({ url, type }, 'download request');
        // Получаем прямую ссылку через сервис
        const { directUrl, filename } = await pinterestService_1.default.fetchDirectDownloadLink(url);
        // Настраиваем заголовки для скачивания
        const contentType = 'video/mp4';
        res.set({
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Download-Type': 'video',
            'X-Original-URL': url
        });
        // Стримим файл напрямую пользователю
        const response = await axios_1.default.get(directUrl, {
            timeout: 60000,
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        response.data.on('error', (error) => {
            log.error({ err: error }, 'stream error');
            if (!res.headersSent) {
                res.status(500).json({
                    error: true,
                    message: 'Failed to stream file'
                });
            }
        });
        response.data.pipe(res);
        log.info({ filename }, 'streaming started');
        req.on('close', () => {
            log.info('client disconnected during download');
            response.data.destroy();
        });
    }
    catch (error) {
        log.error({ url, type, err: error }, 'download error');
        if (res.headersSent) {
            return res.destroy();
        }
        if (error.message.includes('Invalid or unsupported Pinterest URL')) {
            return res.status(400).json({ error: true, message: 'Invalid or unsupported Pinterest URL' });
        }
        if (error.message.includes('Invalid download type')) {
            return res.status(400).json({ error: true, message: 'Invalid download type. Supported types: image, video' });
        }
        // Прочие ошибки
        return res.status(500).json({ error: true, message: error.message || 'Internal Server Error' });
    }
}));
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'pinterest-download',
        timestamp: new Date().toISOString()
    });
});
exports.default = router;
