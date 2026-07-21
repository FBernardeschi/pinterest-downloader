// src/routes/downloadApiRoutes.ts
import { Router, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import pinterestService from '../services/pinterestService';
import { urlValidationRules } from '../utils/validator';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', 
  urlValidationRules, // Общая валидация URL
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: true, message: errors.array()[0].msg });
    }

    const { url } = req.query;
    const log = (req as any).log || console;

    try {
      log.info({ url }, 'api request (json)');

      const metadata = await pinterestService.getApiMetadata(url as string);

      return res.status(200).json(metadata);

    } catch (error: any) {
      log.error({ url, err: error }, 'api metadata error');
      return res.status(500).json({ error: true, message: error.message || 'Internal Server Error' });
    }
  })
);

export default router;