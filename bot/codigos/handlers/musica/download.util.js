// 🛡️ YT-DLP COM ANTI-DETECÇÃO (SEM COOKIES)
import pkg from 'yt-dlp-wrap';
const { default: YTDlpWrap } = pkg;
import ytSearch from 'yt-search';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let ytDlp = null;
let isInitialized = false;
const urlCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

// 🕐 DELAY HUMANO
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let lastDownloadTime = 0;

// 📊 ESTATÍSTICAS
let stats = {
    ytDlpSuccess: 0,
    ytDlpFail: 0,
    totalDownloads: 0
};

async function initYtDlp() {
    if (isInitialized && ytDlp) {
        return ytDlp;
    }
    
    try {
        const isLinux = process.platform === 'linux' || process.platform === 'android';
        
        if (isLinux) {
            try {
                await execFileAsync('which', ['yt-dlp']);
                ytDlp = new YTDlpWrap('yt-dlp');
                console.log('🐧 [LINUX] yt-dlp encontrado via pip');
            } catch {
                throw new Error('yt-dlp não instalado. Execute: pip install -U yt-dlp');
            }
        } else {
            const localBinPath = join(__dirname, "../../../../yt-dlp.exe");
            try {
                await fs.access(localBinPath);
                ytDlp = new YTDlpWrap(localBinPath);
            } catch {
                const downloadedPath = await YTDlpWrap.downloadFromGithub();
                ytDlp = new YTDlpWrap(downloadedPath);
            }
        }
        
        // 🔄 ATUALIZA YT-DLP AUTOMATICAMENTE
        try {
            console.log('🔄 Verificando atualizações do yt-dlp...');
            await ytDlp.execPromise(['-U']);
            console.log('✅ yt-dlp atualizado!');
        } catch (err) {
            console.warn('⚠️ Não foi possível atualizar yt-dlp:', err.message);
        }
        
        isInitialized = true;
        return ytDlp;
    } catch (err) {
        throw new Error(`Falha ao inicializar yt-dlp: ${err.message}`);
    }
}

function isYouTubeUrl(url) {
    return url.includes('youtube.com') || url.includes('youtu.be');
}

export async function buscarUrlPorNome(termo) {
    const cacheKey = termo.toLowerCase().trim();
    const cached = urlCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`⚡ [CACHE] "${termo}"`);
        return { url: cached.url, info: cached.info };
    }
    
    try {
        console.log(`🔍 [BUSCA] "${termo}"`);
        const inicio = Date.now();
        const resultados = await ytSearch(termo);
        
        if (!resultados?.videos?.length) {
            throw new Error('Nenhum vídeo encontrado.');
        }
        
        const video = resultados.videos[0];
        const url = video.url;
        
        const info = {
            titulo: video.title,
            autor: video.author?.name || video.author || 'Desconhecido',
            duracao: video.duration?.seconds || video.timestamp || 0,
            thumbnailUrl: video.thumbnail || video.image,
            url: url
        };
        
        urlCache.set(cacheKey, { url, info, timestamp: Date.now() });
        console.log(`✅ [BUSCA] ${Date.now() - inicio}ms`);
        return { url, info };
    } catch (err) {
        throw new Error(`Não foi possível encontrar: ${termo}`);
    }
}

async function resolverUrl(input) {
    if (isYouTubeUrl(input)) {
        return { url: input, info: null };
    }
    return await buscarUrlPorNome(input);
}

export async function obterDadosMusica(url) {
    try {
        const inicio = Date.now();
        let urlResolvida, infoCache;
        
        if (typeof url === 'string') {
            const resultado = await resolverUrl(url);
            urlResolvida = resultado.url;
            infoCache = resultado.info;
        } else {
            urlResolvida = url.url;
            infoCache = url.info;
        }
        
        if (infoCache) {
            console.log(`✅ [INFO-CACHE] ${Date.now() - inicio}ms`);
            return infoCache;
        }
        
        const ytDlp = await initYtDlp();
        
        const args = [
            urlResolvida,
            '--dump-json',
            '--no-warnings',
            '--no-playlist',
            '--skip-download',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/'
        ];
        
        const info = await ytDlp.execPromise(args);
        const data = JSON.parse(info);
        console.log(`✅ [INFO-YTDLP] ${Date.now() - inicio}ms`);
        return {
            titulo: data.title,
            autor: data.uploader || data.channel || 'Desconhecido',
            duracao: data.duration || 0,
            url: data.webpage_url,
            thumbnailUrl: data.thumbnail
        };
    } catch (err) {
        throw new Error(`Erro ao obter informações: ${err.message}`);
    }
}

// 🎵 DOWNLOAD COM ANTI-DETECÇÃO
async function baixarComYtDlp(urlResolvida, tentativa = 1) {
    let tempFile = null;
    
    try {
        // 🕐 RATE LIMITING
        const now = Date.now();
        const timeSinceLastDownload = now - lastDownloadTime;
        if (timeSinceLastDownload < 3000) {
            const delayNeeded = 3000 - timeSinceLastDownload;
            console.log(`⏳ Aguardando ${(delayNeeded/1000).toFixed(1)}s (anti-detecção)...`);
            await sleep(delayNeeded);
        }
        lastDownloadTime = Date.now();
        
        const inicioYtDlp = Date.now();
        console.log(`🔄 [YT-DLP] Tentativa ${tentativa}/3 - Iniciando download...`);
        
        const ytDlp = await initYtDlp();
        const randomId = randomBytes(8).toString('hex');
        tempFile = join(tmpdir(), `music_${randomId}.opus`);

        // 🎵 ESTRATÉGIA DE FORMATO (COM FALLBACK)
        const formatStrategies = [
            'bestaudio[ext=webm][acodec=opus]/bestaudio[acodec=opus]',
            'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
            'bestaudio/best'
        ];
        
        const formatStrategy = formatStrategies[Math.min(tentativa - 1, formatStrategies.length - 1)];
        console.log(`🎵 [FORMATO] Estratégia ${tentativa}: ${formatStrategy}`);

        const args = [
            urlResolvida,
            '--format', formatStrategy,
            '--no-playlist',
            '--no-warnings',
            '--extractor-retries', '10',
            '--retries', '10',
            '--fragment-retries', '10',
            
            // 🛡️ ANTI-DETECÇÃO
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/',
            
            // 🌐 BYPASS
            '--geo-bypass',
            '--geo-bypass-country', 'US',
            
            // 🎧 CONVERSÃO AUTOMÁTICA PARA OPUS
            '--audio-format', 'opus',
            '--audio-quality', '96K',
            '--postprocessor-args', 'ffmpeg:-ac 2 -ar 48000',
            
            // ⚡ PERFORMANCE
            '--concurrent-fragments', '5',
            '--buffer-size', '512K',
            '--http-chunk-size', '512K',
            '--socket-timeout', '30',
            '--no-check-certificate',
            '--no-cache-dir',
            
            '--output', tempFile
        ];

        await ytDlp.execPromise(args);

        const buffer = await fs.readFile(tempFile);
        const tempoYtDlp = Date.now() - inicioYtDlp;
        const tamanhoMB = (buffer.length / 1024 / 1024).toFixed(2);
        
        console.log(`✅ [YT-DLP] ${(tempoYtDlp/1000).toFixed(1)}s (${tamanhoMB}MB)`);
        stats.ytDlpSuccess++;
        stats.totalDownloads++;
        
        return { buffer, metodo: 'yt-dlp', formato: 'opus' };
    } catch (err) {
        console.error(`❌ [YT-DLP] Tentativa ${tentativa} falhou:`, err.message);
        
        // 🎵 PROBLEMA DE FORMATO
        if (err.message.includes('Requested format is not available') && tentativa < 3) {
            console.log(`🔄 Tentando formato alternativo...`);
            await sleep(1000);
            return await baixarComYtDlp(urlResolvida, tentativa + 1);
        }
        
        if (tentativa >= 3) {
            stats.ytDlpFail++;
            throw err;
        }
        
        // Retry genérico
        console.log(`⏳ Aguardando ${tentativa * 2}s antes de tentar novamente...`);
        await sleep(tentativa * 2000);
        return await baixarComYtDlp(urlResolvida, tentativa + 1);
    } finally {
        if (tempFile) {
            try { await fs.unlink(tempFile); } catch {}
        }
    }
}

// 🎯 DOWNLOAD DE MÚSICA
export async function baixarMusicaBuffer(url) {
    try {
        const inicioTotal = Date.now();
        
        let urlResolvida;
        if (typeof url === 'string') {
            if (isYouTubeUrl(url)) {
                urlResolvida = url;
            } else {
                const resultado = await resolverUrl(url);
                urlResolvida = resultado.url;
            }
        } else if (typeof url === 'object' && url.url) {
            urlResolvida = url.url;
        } else {
            urlResolvida = String(url);
        }
        
        if (typeof urlResolvida !== 'string' || !urlResolvida.includes('youtube.com')) {
            throw new Error(`URL inválida: ${urlResolvida}`);
        }
        
        console.log(`🔗 [DEBUG] URL final: ${urlResolvida}`);
        
        const result = await baixarComYtDlp(urlResolvida);
        console.log(`✅ [TOTAL] ${(Date.now() - inicioTotal)/1000}s`);
        return result;
    } catch (err) {
        console.error(`❌ [DOWNLOAD] Erro: ${err.message}`);
        throw new Error(`Falha no download: ${err.message}`);
    }
}

// 🎵 DOWNLOAD COM INFORMAÇÕES
export async function baixarMusicaComInfo(url) {
    const inicio = Date.now();
    
    try {
        let urlFinal, infoCache;
        
        if (typeof url === 'string') {
            const resultado = await resolverUrl(url);
            urlFinal = resultado.url;
            infoCache = resultado.info;
        } else if (typeof url === 'object' && url.url) {
            urlFinal = url.url;
            infoCache = url.info;
        } else {
            urlFinal = String(url);
            infoCache = null;
        }
        
        const downloadResult = await baixarMusicaBuffer(urlFinal);
        
        const tempoTotal = (Date.now() - inicio) / 1000;
        console.log(`✅ [COMPLETO] ${tempoTotal.toFixed(1)}s | Formato: Opus 96K`);
        
        if (stats.totalDownloads % 10 === 0 && stats.totalDownloads > 0) {
            console.log(`📊 [STATS] ${JSON.stringify(obterEstatisticas(), null, 2)}`);
        }
        
        return {
            buffer: downloadResult.buffer,
            formato: downloadResult.formato,
            metodo: downloadResult.metodo,
            info: infoCache || { titulo: 'Desconhecido', autor: 'Desconhecido' }
        };
    } catch (err) {
        throw new Error(`Falha: ${err.message}`);
    }
}

// 📊 OBTER ESTATÍSTICAS
export function obterEstatisticas() {
    return {
        ...stats,
        taxaSucesso: stats.totalDownloads > 0 
            ? ((stats.ytDlpSuccess / stats.totalDownloads) * 100).toFixed(1) + '%' 
            : '0%'
    };
}

// 🧹 CLEANUP
export async function cleanup() {
    urlCache.clear();
    isInitialized = false;
    ytDlp = null;
    console.log('🧹 Recursos limpos');
    console.log('📊 Estatísticas finais:', obterEstatisticas());
}

// 🧹 LIMPEZA DE CACHE
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of urlCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            urlCache.delete(key);
        }
    }
}, CACHE_DURATION);