"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
// src/utils/validator.ts
class Validator {
    static isValidPinterestURL(url) {
        // Поддерживает ru.pinterest.com, www.pinterest.com, pinterest.com, pinterest.co.uk и т.д.
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
