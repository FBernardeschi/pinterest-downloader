// src/utils/validator.ts
import { query } from 'express-validator';

export class Validator {
  static isValidPinterestURL(url: string): boolean {
    const pinterestRegex = /https?:\/\/([a-z]{2}\.)?pinterest\.[a-z\.]+\/pin\/\d+/i;
    const shortRegex = /https?:\/\/pin\.it\//i;
    return pinterestRegex.test(url) || shortRegex.test(url);
  }

  static isSSRFSafe(url: string): boolean {
    return !url.includes('localhost') && !url.includes('127.0.0.1') && !url.startsWith('file://');
  }

  static isValidDownloadType(type: string): boolean {
    return ['image', 'video'].includes(type);
  }
}

// Общий массив валидации для URL
export const urlValidationRules = [
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
    })
];