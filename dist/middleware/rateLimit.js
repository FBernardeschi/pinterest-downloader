"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadLimiter = void 0;
const downloadLimiter = (req, res, next) => {
    next();
};
exports.downloadLimiter = downloadLimiter;
