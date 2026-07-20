// src/middleware/rateLimit.ts
export const downloadLimiter = (req: any, res: any, next: any) => {
    // Здесь можно добавить express-rate-limit
    next();
};