"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlValidationRules = exports.Validator = void 0;
// src/utils/validator.ts
const express_validator_1 = require("express-validator");
class Validator {
    static isValidPinterestURL(url) {
        const pinterestRegex = /https?:\/\/([a-z]{2}\.)?pinterest\.[a-z\.]+\/pin\/\d+/i;
        const shortRegex = /https?:\/\/pin\.it\//i;
        return pinterestRegex.test(url) || shortRegex.test(url);
    }
    static isSSRFSafe(url) {
        return !url.includes('localhost') && !url.includes('127.0.0.1') && !url.startsWith('file://');
    }
    static isValidDownloadType(type) {
        return ['image', 'video'].includes(type);
    }
}
exports.Validator = Validator;
// Общий массив валидации для URL
exports.urlValidationRules = [
    (0, express_validator_1.query)('url')
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
    })
];
