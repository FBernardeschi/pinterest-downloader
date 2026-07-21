declare class PinterestService {
    /**
     * Получает прямую ссылку на видео через сторонний сервис convertico.com
     */
    fetchDirectDownloadLink(pinUrl: string): Promise<{
        directUrl: string;
        filename: string;
    }>;
}
declare const _default: PinterestService;
export default _default;
//# sourceMappingURL=pinterestService.d.ts.map