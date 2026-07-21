export interface PinterestConfig {
    path: string;
    dir?: string;
    threadMax?: number;
    cut?: number;
    force?: boolean;
    excludeSection?: boolean;
    rescrape?: boolean;
    imgOnly?: boolean;
    vOnly?: boolean;
    httpsProxy?: string;
    httpProxy?: string;
    cookies?: string;
}
export declare class PinterestDownloader {
    private config;
    private proxies;
    private cookieJar;
    constructor(options: PinterestConfig);
    run(): Promise<void>;
    private getSession;
    private parseCookies;
    private getPinInfo;
    private getBoardInfo;
    private fetchBoards;
    private fetchImgs;
    private downloadImg;
    private downloadFile;
    private isVideoExist;
    private sanitize;
    private getOutputFilePath;
    private ensureDirExists;
}
//# sourceMappingURL=PinterestDownloader.d.ts.map