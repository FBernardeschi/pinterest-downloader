// src/utils/validator.ts
export class Validator {
  static isValidPinterestURL(url: string): boolean {
    // Поддерживает ru.pinterest.com, www.pinterest.com, pinterest.com, pinterest.co.uk и т.д.
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