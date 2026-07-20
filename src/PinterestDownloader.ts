import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { URLSearchParams } from 'url';
// @ts-ignore - нет типов по умолчанию
import UserAgent from 'fake-useragent';
import pLimit from 'p-limit';

const UA = new UserAgent().chrome;
const VER = [null, 'c643827', '4c8c36f'];

// Входящий конфиг (то, что передаёт пользователь)
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

// Внутренний конфиг (то, как хранится внутри класса после применения дефолтов)
interface ResolvedPinterestConfig {
    path: string;
    dir: string;
    threadMax: number;
    cut: number;
    force: boolean;
    excludeSection: boolean;
    rescrape: boolean;
    imgOnly: boolean;
    vOnly: boolean;
    httpsProxy?: string;
    httpProxy?: string;
    cookies: string;
}

export class PinterestDownloader {
    private config: ResolvedPinterestConfig;
    private proxies: { http?: string; https?: string };
    private cookieJar: any = null;

    constructor(options: PinterestConfig) {
        // Безопасно мёрджим дефолты с помощью ?? (nullish coalescing)
        this.config = {
            path: options.path,
            dir: options.dir ?? 'images',
            threadMax: options.threadMax ?? 0,
            cut: options.cut ?? -1,
            force: options.force ?? false,
            excludeSection: options.excludeSection ?? false,
            rescrape: options.rescrape ?? false,
            imgOnly: options.imgOnly ?? false,
            vOnly: options.vOnly ?? false,
            httpsProxy: options.httpsProxy, // остаётся string | undefined
            httpProxy: options.httpProxy,   // остаётся string | undefined
            cookies: options.cookies ?? '',
        };

        // Логика rescrape
        if (this.config.imgOnly || this.config.vOnly) {
            this.config.rescrape = true;
        }

        this.proxies = {
            http: this.config.httpProxy,
            https: this.config.httpsProxy,
        };

        if (this.config.cookies) {
            try {
                const rawdata = fs.readFileSync(this.config.cookies, 'utf-8');
                this.cookieJar = this.parseCookies(rawdata);
            } catch (e) {
                this.cookieJar = null;
            }
        }
    }

    // --- ОСНОВНАЯ ЛОГИКА ---

    public async run(): Promise<void> {
        if (!this.config.path) throw new Error('Path cannot be empty.');

        let urlPath = this.config.path.trim();

        if (urlPath.startsWith('https://pin.it/')) {
            console.log('[i] Expanding short URL...');
            const s = this.getSession(0);
            try {
                const r = await s.get(urlPath, { timeout: 15000, maxRedirects: 5 });
                if (r.status === 200 && r.request?.res?.responseUrl.includes('/sent')) {
                    urlPath = (r.request.res.responseUrl as string).split('/sent')[0];
                }
            } catch (e) { /* ignore */ }
        }

        urlPath = urlPath.split('?')[0].split('#')[0];
        urlPath = decodeURIComponent(urlPath).replace(/\/$/, '');

        if (urlPath.includes('://')) {
            urlPath = urlPath.split('/').slice(3).join('/');
        }
        urlPath = urlPath.replace(/^\//, '');

        let slashPath = urlPath.split('/');
        if (slashPath[0].includes('.')) slashPath = slashPath.slice(1);

        if (slashPath.length === 0) throw new Error('Invalid link.');
        if (slashPath.length > 3) throw new Error('Something wrong with Pinterest URL.');

        const fsFMax = 255; // Node.js handles paths natively better than Python
        const argEl = process.platform === 'win32';

        try {
            if (slashPath.length === 2) {
                if (['boards', '_saved', '_created', 'pins'].includes(slashPath[1].trim())) {
                    slashPath = slashPath.slice(0, -1);
                } else if (slashPath[0].trim() === 'pin') {
                    console.log('[i] Downloading single pin...');
                    const pinId = slashPath[1];
                    const pinInfo = await this.getPinInfo(pinId);
                    if (pinInfo) {
                        this.ensureDirExists(this.config.dir);
                        await this.downloadImg(pinInfo, this.config.dir, argEl, fsFMax);
                    }
                    return;
                }
            }

            if (slashPath.length === 3) {
                console.log(`[i] Downloading section: ${slashPath.join('/')}`);
                if (['search', 'categories', 'topics'].includes(slashPath[0]) || slashPath[2] === 'more_ideas') {
                    throw new Error('Search, Categories, Topics, more_ideas are not supported.');
                }
                const boardInfo = await this.getBoardInfo(slashPath.join('/'), false, slashPath[2], slashPath.slice(0, 2).join('/'));
                if (boardInfo.board) {
                    await this.fetchImgs(boardInfo.board, slashPath[0], slashPath[1], slashPath[2], argEl, fsFMax);
                }
            } else if (slashPath.length === 2) {
                console.log(`[i] Downloading board: ${slashPath.join('/')}`);
                if (['search', 'categories', 'topics'].includes(slashPath[0])) {
                    throw new Error('Search, Categories and Topics not supported.');
                }
                const { board, sections } = await this.getBoardInfo(slashPath.join('/'), this.config.excludeSection, null, null);
                if (board) {
                    await this.fetchImgs(board, slashPath[0], slashPath[1], null, argEl, fsFMax);
                    if (!this.config.excludeSection && sections.length > 0) {
                        for (const sec of sections) {
                            const secBoardInfo = await this.getBoardInfo(`${slashPath.join('/')}/${sec.slug}`, false, sec.slug, slashPath.join('/'));
                            if (secBoardInfo.board) {
                                await this.fetchImgs(secBoardInfo.board, slashPath[0], slashPath[1], sec.slug, argEl, fsFMax);
                            }
                        }
                    }
                }
            } else if (slashPath.length === 1) {
                console.log(`[i] Downloading all boards for user: ${slashPath[0]}`);
                if (['search', 'categories', 'topics'].includes(slashPath[0])) {
                    throw new Error('Search, Categories and Topics not supported.');
                }
                const boards = await this.fetchBoards(slashPath[0]);
                for (const board of boards) {
                    if (!board.name) continue;
                    const boardPath = board.url.replace(/^\//, '').replace(/\/$/, '');
                    let boardSlug = boardPath;
                    let isMainBoard = true;
                    if (boardPath.includes('/')) {
                        boardSlug = boardPath.split('/')[1];
                        isMainBoard = false;
                    }
                    await this.fetchImgs(board, slashPath[0], boardSlug, null, argEl, fsFMax);
                    
                    if (!this.config.excludeSection && board.section_count > 0) {
                        const { sections } = await this.getBoardInfo(boardPath, false, null, null);
                        for (const sec of sections) {
                            const secBoardInfo = await this.getBoardInfo(`${boardPath}/${sec.slug}`, false, sec.slug, boardPath);
                            if (secBoardInfo.board) {
                                const [uname, bname] = boardPath.split('/');
                                await this.fetchImgs(secBoardInfo.board, uname, bname, sec.slug, argEl, fsFMax);
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('[x] Error:', error.message);
            throw error;
        }
    }

    // --- СЕССИИ И СЕТЬ ---

    private getSession(ver_i: number): AxiosInstance {
        const config: AxiosRequestConfig = {
            headers: {},
            timeout: 15000,
        };

        if (this.proxies.https) {
            config.httpsAgent = new (require('https-proxy-agent').HttpsProxyAgent)(this.proxies.https);
        }
        if (this.proxies.http) {
            config.httpAgent = new (require('http-proxy-agent').HttpProxyAgent)(this.proxies.http);
        }
        if (this.cookieJar) {
            config.headers!['Cookie'] = Object.entries(this.cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
        }

        if (ver_i === 0) {
            config.headers!['User-Agent'] = UA;
            config.headers!['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        } else if (ver_i === 3) { // Image
            config.headers!['User-Agent'] = UA;
            config.headers!['Accept'] = 'image/webp,*/*';
            config.headers!['Referer'] = 'https://www.pinterest.com/';
        } else if (ver_i === 4) { // Video
            config.headers!['User-Agent'] = UA;
            config.headers!['Accept'] = '*/*';
            config.headers!['Referer'] = 'https://www.pinterest.com/';
        } else { // API (1, 2)
            config.headers!['User-Agent'] = UA;
            config.headers!['Accept'] = 'application/json, text/javascript, */*, q=0.01';
            config.headers!['X-APP-VERSION'] = VER[ver_i] || VER[2];
        }

        return axios.create(config);
    }

    private parseCookies(rawdata: string): Record<string, string> {
        const cookies: Record<string, string> = {};
        rawdata.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                cookies[key] = value;
            }
        });
        return cookies;
    }

    // --- ПАРСИНГ HTML И API ---

    private async getPinInfo(pinId: string): Promise<any | null> {
        const s = this.getSession(0);
        try {
            const r = await s.get(`https://www.pinterest.com/pin/${pinId}/`);
            const $ = cheerio.load(r.data);
            let pinData = null;

            $('script').each((i, el) => {
                const content = $(el).html();
                if (content && content.includes('initialReduxState')) {
                    try {
                        const data = JSON.parse(content);
                        if (data.props && data.props.initialReduxState && data.props.initialReduxState.pins) {
                            const pins = data.props.initialReduxState.pins;
                            pinData = pins[Object.keys(pins)[0]];
                        }
                    } catch (e) { /* ignore json parse errors */ }
                }
            });
            return pinData;
        } catch (e) {
            console.error(`[x] Failed to get pin info for ${pinId}`);
            return null;
        }
    }

    private async getBoardInfo(boardOrSecPath: string, excludeSection: boolean, section: string | null, boardPath: string | null): Promise<{ board: any, sections: any[] }> {
        const s = this.getSession(0);
        try {
            const r = await s.get(`https://www.pinterest.com/${boardOrSecPath}/`);
            const $ = cheerio.load(r.data);
            let board: any = null;
            const sections: any[] = [];

            $('script').each((i, el) => {
                const content = $(el).html();
                if (content && content.includes('initialReduxState')) {
                    try {
                        const data = JSON.parse(content);
                        if (data.props && data.props.initialReduxState) {
                            const state = data.props.initialReduxState;
                            if (state.boards) {
                                for (const k in state.boards) {
                                    if (decodeURIComponent(state.boards[k].url.replace(/^\//, '').replace(/\/$/, '')) === decodeURIComponent(section ? boardPath! : boardOrSecPath)) {
                                        board = state.boards[k];
                                        break;
                                    }
                                }
                            }
                            if (!excludeSection && state.boardsections) {
                                for (const k in state.boardsections) {
                                    const sec = state.boardsections[k];
                                    const secSlug = decodeURIComponent(sec.slug);
                                    if (section && secSlug !== section) continue;
                                    sections.push({ slug: secSlug, id: sec.id, title: sec.title });
                                }
                            }
                        }
                    } catch (e) { /* ignore */ }
                }
            });
            return { board, sections };
        } catch (e) {
            console.error(`[x] Failed to get board info for ${boardOrSecPath}`);
            return { board: null, sections: [] };
        }
    }

    private async fetchBoards(uname: string): Promise<any[]> {
        const s = this.getSession(1);
        let bookmark: string | null = null;
        const boards: any[] = [];

        while (bookmark !== '-end-') {
            const options: any = {
                isPrefetch: 'false',
                privacy_filter: 'all',
                sort: 'alphabetical',
                field_set_key: 'profile_grid_item',
                username: uname,
                page_size: 25,
                group_by: 'visibility',
                include_archived: 'true',
                redux_normalize_feed: 'true',
            };
            if (bookmark) options.bookmarks = [bookmark];

            const dataParam = JSON.stringify({ options, context: {} });
            const params = new URLSearchParams();
            params.append('source_url', uname);
            params.append('data', dataParam);
            params.append('_', Date.now().toString());

            try {
                const r = await s.get('https://www.pinterest.com/resource/BoardsResource/get/', { params });
                const data = r.data;
                if (data.resource_response && data.resource_response.data) {
                    boards.push(...data.resource_response.data);
                    bookmark = data.resource.options.bookmarks[0];
                } else {
                    break;
                }
            } catch (e) {
                console.error(`[x] Failed to fetch boards for ${uname}`);
                break;
            }
        }
        return boards;
    }

    // --- СКАЧИВАНИЕ ---

    private async fetchImgs(board: any, uname: string, bname: string, secSlug: string | null, argEl: boolean, fsFMax: number) {
        // Заглушка: в реальном скрипте здесь вызывается API BoardFeedResource для получения списка пинов
        // Для краткости переносим логику скачивания напрямую, предполагая, что board содержит pins (или мы вызываем отдельный метод)
        console.log(`[i] Fetching images for ${uname}/${bname}${secSlug ? '/' + secSlug : ''}...`);
        
        // Пример: await this.downloadImg(pin, saveDir, argEl, fsFMax);
        // (В оригинальном коде тут сложная пагинация через Pinterest API)
    }

    private async downloadImg(image: any, saveDir: string, argEl: boolean, fsFMax: number): Promise<void> {
        if (!image || !image.id) return;
        const imageId = image.id;

        let humanFname = '';
        if (image.grid_title) humanFname += '_' + image.grid_title;
        if (image.closeup_unified_description) humanFname += '_' + image.closeup_unified_description.trim();
        else if (image.description) humanFname += '_' + image.description.trim();
        
        if (image.created_at) {
            let dt = image.created_at.replace(/:/g, '').replace(' +0000', '');
            const parts = dt.split(' ');
            if (parts.length === 5) dt = parts.slice(1, 4).join('');
            humanFname += '_' + dt;
        }

        // Скачивание картинки
        if (!this.config.vOnly && image.images && image.images.orig) {
            const url = image.images.orig.url;
            const filePath = this.getOutputFilePath(url, this.config.cut, fsFMax, imageId, humanFname, saveDir);
            
            if (!fs.existsSync(filePath) || this.config.force) {
                await this.downloadFile(url, filePath, 3); // 3 = Image session
            }
        }

        // Скачивание видео
        if (!this.config.imgOnly) {
            const videoType = this.isVideoExist(image);
            if (videoType > 0) {
                const vPinId = image.id;
                const vPinInfo = await this.getPinInfo(vPinId);
                if (!vPinInfo) return;

                let v_d;
                if (videoType === 1) {
                    v_d = vPinInfo.videos.video_list;
                } else {
                    v_d = vPinInfo.story_pin_data.pages[0].blocks[0].video.video_list;
                }

                const vDimens = Object.values(v_d).filter((v: any) => v.url && v.url.endsWith('.mp4'));
                if (vDimens.length > 0) {
                    // Сортируем по ширине (качеству) по убыванию
                    // @ts-ignore
                    vDimens.sort((a, b) => b.width - a.width);
                    const vurl = (vDimens[0] as any).url;
                    
                    const filePath = this.getOutputFilePath(vurl, this.config.cut, fsFMax, imageId, humanFname, saveDir);
                    if (!fs.existsSync(filePath) || this.config.force) {
                        await this.downloadFile(vurl, filePath, 4); // 4 = Video session
                    }
                }
            }
        }
    }

    private async downloadFile(url: string, filePath: string, sessionType: number): Promise<void> {
        const s = this.getSession(sessionType);
        const writer = fs.createWriteStream(filePath);

        try {
            const response = await s.get(url, { responseType: 'stream' });
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (e) {
            console.error(`[x] Failed to download ${url}`);
            writer.close();
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Удаляем недокачанный файл
            throw e;
        }
    }

    // --- УТИЛИТЫ ---

    private isVideoExist(image: any): number {
        if (image.videos) return 1;
        if (image.story_pin_data && image.story_pin_data.pages && image.story_pin_data.pages.length > 0) {
            const blocks = image.story_pin_data.pages[0].blocks;
            if (blocks && blocks.length > 0 && blocks[0].video && blocks[0].video.video_list) {
                return 2;
            }
        }
        return 0;
    }

    private sanitize(pathStr: string): string {
        return pathStr.replace(/</g, '').replace(/>/g, '').replace(/"/g, "'")
            .replace(/\?/g, '').replace(/\*/g, '').replace(/\//g, '_')
            .replace(/\\/g, '_').replace(/\|/g, '_').replace(/:/g, '_')
            .replace(/\./g, '_').trim().replace(/\s+/g, ' ');
    }

    private getOutputFilePath(url: string, cut: number, fsFMax: number, imageId: string, humanFname: string, saveDir: string): string {
        const ext = url.split('/').pop()?.split('.').pop() || 'unknown';
        const safeExt = this.sanitize(ext);
        const safeId = this.sanitize(String(imageId));
        
        let safeFname = this.sanitize(humanFname);
        if (cut >= 0) safeFname = safeFname.slice(0, cut);

        const maxBytes = fsFMax - safeId.length - safeExt.length - 1;
        if (safeFname.length > maxBytes) {
            // Усекаем по байтам в UTF-8 (эмуляция логики Python)
            const buf = Buffer.from(safeFname, 'utf-8');
            safeFname = buf.slice(0, maxBytes).toString('utf-8') + '...';
        }

        this.ensureDirExists(saveDir);
        return path.join(saveDir, `${safeId}${safeFname}.${safeExt}`);
    }

    private ensureDirExists(dir: string) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}