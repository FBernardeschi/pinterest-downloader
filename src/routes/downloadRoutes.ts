// src/routes/downloadRoutes.ts
import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import pinterestService from '../services/pinterestService';
import axios from 'axios';
import { urlValidationRules } from '../utils/validator';
import { downloadLimiter } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/',
  downloadLimiter,
  urlValidationRules, // Общая валидация URL
  query('type').notEmpty().withMessage('Type parameter is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: true, message: errors.array()[0].msg });
    }

    const { url } = req.query;
    const log = (req as any).log || console;

    try {
      log.info({ url }, 'download request (stream)');

      const { directUrl, filename } = await pinterestService.getDirectDownloadLink(url as string);

      res.set({
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Original-URL': url as string
      });

      const response = await axios.get(directUrl, {
        timeout: 60000,
        responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      response.data.on('error', (error: any) => {
        log.error({ err: error }, 'stream error');
        if (!res.headersSent) res.status(500).json({ error: true, message: 'Failed to stream file' });
      });

      response.data.pipe(res);

      req.on('close', () => {
        log.info('client disconnected during download');
        response.data.destroy();
      });

    } catch (error: any) {
      log.error({ url, err: error }, 'download error');
      if (res.headersSent) return res.destroy();
      return res.status(500).json({ error: true, message: error.message || 'Internal Server Error' });
    }
  })
);

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'pinterest-download', timestamp: new Date().toISOString() });
});

export default router;