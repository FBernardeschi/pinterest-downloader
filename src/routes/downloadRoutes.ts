// src/routes/downloadRoutes.ts
import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import pinterestService from '../services/pinterestService';
import axios from 'axios';
import { Validator } from '../utils/validator';
import { downloadLimiter } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const validateDownloadRequest = [
  query('url')
    .notEmpty()
    .withMessage('URL parameter is required')
    .custom(async (value) => {
      if (!Validator.isValidPinterestURL(value)) {
        throw new Error('Invalid or unsupported Pinterest URL (must be /pin/... or pin.it)');
      }
      if (!Validator.isSSRFSafe(value)) {
        throw new Error('URL not allowed for security reasons');
      }
      return true;
    }),
  query('type')
    .notEmpty()
    .withMessage('Type parameter is required')
    .custom(async (value) => {
      if (!Validator.isValidDownloadType(value)) {
        throw new Error('Invalid download type. Supported types: image, video');
      }
      return true;
    })
];

router.get('/',
  downloadLimiter,
  validateDownloadRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
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
      const { directUrl, filename } = await pinterestService.fetchDirectDownloadLink(url as string);

      // Настраиваем заголовки для скачивания
      const contentType = 'video/mp4';

      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Download-Type': 'video',
        'X-Original-URL': url as string
      });

      // Стримим файл напрямую пользователю
      const response = await axios.get(directUrl, {
        timeout: 60000,
        responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      response.data.on('error', (error: any) => {
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

    } catch (error: any) {
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
  })
);

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'pinterest-download',
    timestamp: new Date().toISOString()
  });
});

export default router;