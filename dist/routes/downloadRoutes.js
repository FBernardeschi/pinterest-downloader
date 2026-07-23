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
router.get('/', rateLimit_1.downloadLimiter, validator_1.urlValidationRules, // Общая валидация URL
(0, express_validator_1.query)('type').notEmpty().withMessage('Type parameter is required'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: true, message: errors.array()[0].msg });
    }
    const { url } = req.query;
    const log = req.log || console;
    try {
        log.info({ url }, 'download request (stream)');
        const { directUrl, filename } = await pinterestService_1.default.getDirectDownloadLink(url);
        res.set({
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Original-URL': url
        });
        const response = await axios_1.default.get(directUrl, {
            timeout: 60000,
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        response.data.on('error', (error) => {
            log.error({ err: error }, 'stream error');
            if (!res.headersSent)
                res.status(500).json({ error: true, message: 'Failed to stream file' });
        });
        response.data.pipe(res);
        req.on('close', () => {
            log.info('client disconnected during download');
            response.data.destroy();
        });
    }
    catch (error) {
        log.error({ url, err: error }, 'download error');
        if (res.headersSent)
            return res.destroy();
        return res.status(500).json({ error: true, message: error.message || 'Internal Server Error' });
    }
}));
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'pinterest-download', timestamp: new Date().toISOString() });
});
exports.default = router;
