// alertaHandler.js - Sistema de Moderação Simplificado
// VERSÃO: APENAS POSTER + ÁUDIOS (sem mensagens de texto)

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ alertaHandler.js CARREGADO!');

// ============================================
// CONFIGURAÇÕES
// ============================================
const CONFIG = {
    URL_AUDIOS: 'https://raw.githubusercontent.com/LucasNascimento25/audio-regras/main/audios-regras.json',
    // 🖼️ URL DO POSTER DAS REGRAS
    URL_POSTER: 'https://raw.githubusercontent.com/LucasNascimento25/audio-regras/main/poster-regras.jpg',
    AUDIO_INTERVAL: 0,
    MAX_RETRIES: 3,
    DOWNLOAD_TIMEOUT: 30000,
    DEBUG: process.env.DEBUG === 'true',
    AUDIOS_GRUPO: 4,
    AUDIOS_INDIVIDUAL: 4
};

let audiosCache = [];
let ultimaAtualizacao = null;

// ============================================
// FUNÇÃO CORRIGIDA DE CONVERSÃO DE URL
// ============================================
function converterParaRawUrl(url) {
    if (!url) return url;
    
    console.log(`🔧 URL original: ${url}`);
    
    // Remove /refs/heads/ se existir (isso estava causando o erro!)
    url = url.replace('/refs/heads/', '/');
    
    // Se já está no formato raw correto, retorna
    if (url.includes('raw.githubusercontent.com')) {
        console.log(`✅ URL raw correta: ${url}`);
        return url;
    }
    
    // Converte URL do GitHub normal para raw
    if (url.includes('github.com')) {
        const novaUrl = url
            .replace('https://github.com/', 'https://raw.githubusercontent.com/')
            .replace('/blob/', '/');
        console.log(`🔄 Convertido para raw: ${novaUrl}`);
        return novaUrl;
    }
    
    console.log(`⚠️ URL mantida sem conversão: ${url}`);
    return url;
}

// ============================================
// GERENCIAMENTO DE ÁUDIOS
// ============================================
async function carregarAudios(forceRefresh = false) {
    try {
        console.log(`🔄 Carregando áudios das regras...${forceRefresh ? ' (FORÇANDO ATUALIZAÇÃO)' : ''}`);
        console.log(`📡 URL: ${CONFIG.URL_AUDIOS}`);
        
        const response = await fetch(CONFIG.URL_AUDIOS, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        const audiosAtivos = (data.audios || []).filter(a => 
            a.ativo === true && a.comando === 'regras'
        );
        
        if (audiosAtivos.length === 0) {
            console.error('❌ [Regras] Nenhum áudio ativo encontrado no JSON');
            return [];
        }

        const audiosCorrigidos = audiosAtivos.map(audio => {
            const urlCorrigida = converterParaRawUrl(audio.url);
            return {
                ...audio,
                url: urlCorrigida
            };
        });

        audiosCache = audiosCorrigidos;
        ultimaAtualizacao = new Date();
        
        console.log(`✅ [Regras] ${audiosCache.length} áudios carregados com sucesso!`);
        console.log('📋 URLs corrigidas:');
        audiosCache.forEach((a, i) => {
            console.log(`  ${i + 1}. ${a.nome}`);
            console.log(`     ${a.url}`);
        });
        
        return audiosCache;

    } catch (error) {
        console.error('❌ [Regras] Erro ao carregar:', error.message);
        if (CONFIG.DEBUG) console.error(error.stack);
        return [];
    }
}

async function downloadAudioBuffer(url) {
    if (!url) {
        throw new Error('URL do áudio não fornecida');
    }

    for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = 1000 * Math.pow(2, attempt - 1);
                console.log(`⏰ Aguardando ${delay}ms antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            console.log(`📥 Baixando áudio (tentativa ${attempt + 1}/${CONFIG.MAX_RETRIES})...`);
            console.log(`🔗 URL: ${url}`);

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: CONFIG.DOWNLOAD_TIMEOUT,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
                    'Accept': 'audio/mpeg, audio/*, */*',
                    'Cache-Control': 'no-cache'
                },
                maxRedirects: 5
            });

            if (!response.data || response.data.byteLength === 0) {
                throw new Error('Buffer vazio recebido');
            }

            console.log(`✅ Baixado: ${(response.data.byteLength / 1024).toFixed(2)} KB`);
            return Buffer.from(response.data);

        } catch (error) {
            const errorMsg = error.response?.status 
                ? `HTTP ${error.response.status}` 
                : error.message;
            
            console.error(`❌ Tentativa ${attempt + 1} falhou: ${errorMsg}`);
            
            if (attempt === CONFIG.MAX_RETRIES - 1) {
                throw new Error(`Falha após ${CONFIG.MAX_RETRIES} tentativas: ${errorMsg}`);
            }
        }
    }
}

// ============================================
// DOWNLOAD DO POSTER
// ============================================
async function downloadPoster() {
    try {
        console.log('🖼️ Baixando poster das regras...');
        
        const urlCorrigida = converterParaRawUrl(CONFIG.URL_POSTER);
        
        const response = await axios.get(urlCorrigida, {
            responseType: 'arraybuffer',
            timeout: CONFIG.DOWNLOAD_TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
                'Accept': 'image/jpeg, image/jpg, image/png, image/*',
                'Cache-Control': 'no-cache'
            },
            maxRedirects: 5
        });

        if (!response.data || response.data.byteLength === 0) {
            throw new Error('Buffer vazio recebido');
        }

        console.log(`✅ Poster baixado: ${(response.data.byteLength / 1024).toFixed(2)} KB`);
        return Buffer.from(response.data);

    } catch (error) {
        console.error('❌ Erro ao baixar poster:', error.message);
        if (CONFIG.DEBUG) console.error(error.stack);
        return null;
    }
}

async function converterParaOpus(inputBuffer) {
    try {
        const tempDir = path.join(__dirname, '../../../temp');
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log(`📁 Diretório temp criado: ${tempDir}`);
        }

        const timestamp = Date.now();
        const inputPath = path.join(tempDir, `input_${timestamp}.mp3`);
        const outputPath = path.join(tempDir, `output_${timestamp}.opus`);

        fs.writeFileSync(inputPath, inputBuffer);
        
        const ffmpegCmd = `ffmpeg -i "${inputPath}" -c:a libopus -b:a 64k -ar 48000 -ac 1 -application voip -compression_level 10 "${outputPath}" -y`;
        
        if (CONFIG.DEBUG) {
            console.log(`🔧 Executando: ${ffmpegCmd}`);
        }
        
        await execPromise(ffmpegCmd);

        if (!fs.existsSync(outputPath)) {
            throw new Error('Arquivo Opus não foi criado');
        }

        const audioConvertido = fs.readFileSync(outputPath);

        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch (e) {
            if (CONFIG.DEBUG) console.log('⚠️ Erro ao limpar arquivos temp:', e.message);
        }

        console.log(`✅ Convertido para Opus: ${(audioConvertido.length / 1024).toFixed(2)} KB`);
        return audioConvertido;

    } catch (error) {
        console.error('❌ Erro na conversão Opus:', error.message);
        if (CONFIG.DEBUG) console.error(error.stack);
        return null;
    }
}

async function normalizarMp3(inputBuffer) {
    try {
        const tempDir = path.join(__dirname, '../../../temp');
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const inputPath = path.join(tempDir, `mp3_input_${timestamp}.mp3`);
        const outputPath = path.join(tempDir, `mp3_output_${timestamp}.mp3`);

        fs.writeFileSync(inputPath, inputBuffer);
        
        const ffmpegCmd = `ffmpeg -i "${inputPath}" -ar 48000 -b:a 128k -ac 1 "${outputPath}" -y`;
        
        if (CONFIG.DEBUG) {
            console.log(`🔧 Normalizando MP3: ${ffmpegCmd}`);
        }
        
        await execPromise(ffmpegCmd);

        if (!fs.existsSync(outputPath)) {
            throw new Error('Arquivo MP3 normalizado não foi criado');
        }

        const audioNormalizado = fs.readFileSync(outputPath);

        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch (e) {
            if (CONFIG.DEBUG) console.log('⚠️ Erro ao limpar arquivos temp MP3:', e.message);
        }

        console.log(`✅ MP3 normalizado: ${(audioNormalizado.length / 1024).toFixed(2)} KB`);
        return audioNormalizado;

    } catch (error) {
        console.error('❌ Erro ao normalizar MP3:', error.message);
        if (CONFIG.DEBUG) console.error(error.stack);
        return null;
    }
}

// ============================================
// ENVIO DE ÁUDIOS COM QUOTE DO POSTER
// ============================================
async function sendAudiosComQuoteDoPoster(sock, jid, audios, posterMessage, targetParticipant = null) {
    if (!audios || audios.length === 0) {
        console.error('❌ Nenhum áudio disponível para envio');
        return;
    }

    console.log(`\n🎵 Enviando ${audios.length} áudios IMEDIATAMENTE (com quote do poster)`);

    for (let i = 0; i < audios.length; i++) {
        try {
            const audioInfo = audios[i];
            
            if (!audioInfo || !audioInfo.url) {
                console.error(`❌ Áudio ${i + 1} não tem URL válida`);
                continue;
            }

            console.log(`\n🎵 Enviando: ${audioInfo.nome} (${i + 1}/${audios.length})`);

            const audioBuffer = await downloadAudioBuffer(audioInfo.url);
            if (!audioBuffer) continue;

            const audioOpus = await converterParaOpus(audioBuffer);

            const messageOptions = {
                audio: audioOpus || audioBuffer,
                mimetype: audioOpus ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
                ptt: true
            };

            // Se tiver participante alvo, adiciona menção
            if (targetParticipant) {
                messageOptions.contextInfo = {
                    mentionedJid: [targetParticipant]
                };
            }

            if (audioOpus) {
                try {
                    await sock.sendMessage(jid, messageOptions, { quoted: posterMessage });
                    console.log(`✅ Enviado (Opus): ${audioInfo.nome}`);
                    continue;
                } catch (err) {
                    console.log(`⚠️ Opus falhou (${err.message}), tentando MP3...`);
                }
            }

            const audioMp3Normalizado = await normalizarMp3(audioBuffer);
            messageOptions.audio = audioMp3Normalizado || audioBuffer;
            messageOptions.mimetype = 'audio/mpeg';
            
            await sock.sendMessage(jid, messageOptions, { quoted: posterMessage });
            console.log(`✅ Enviado (MP3): ${audioInfo.nome}`);

        } catch (error) {
            console.error(`❌ Erro ao enviar áudio ${i + 1}:`, error.message);
            if (CONFIG.DEBUG) console.error(error.stack);
        }
    }

    console.log('✅ Envio de áudios concluído\n');
}

// ============================================
// UTILITÁRIOS
// ============================================
async function deleteMessage(sock, groupId, messageKey) {
    const delays = [0, 100, 500, 1000, 2000];

    for (let i = 0; i < delays.length; i++) {
        try {
            if (delays[i] > 0) {
                await new Promise(r => setTimeout(r, delays[i]));
            }

            await sock.sendMessage(groupId, {
                delete: {
                    remoteJid: messageKey.remoteJid || groupId,
                    fromMe: false,
                    id: messageKey.id,
                    participant: messageKey.participant
                }
            });

            console.log(`✅ Mensagem deletada (tentativa ${i + 1})`);
            return true;
        } catch (error) {
            if (i === delays.length - 1) {
                console.log(`⚠️ Não foi possível deletar mensagem: ${error.message}`);
            }
        }
    }
    return false;
}

function isValidParticipant(participant) {
    if (!participant) return false;
    
    const participantNumber = participant.split('@')[0];
    return !participantNumber.includes(':') && 
           !participantNumber.startsWith('0') &&
           participantNumber.length >= 10;
}

// ============================================
// COMANDO: #atualizarregras
// ============================================
async function handleComandoAtualizarAudios(sock, message) {
    try {
        const from = message.key.remoteJid;
        console.log('🔄 Comando #atualizarregras recebido');

        await sock.sendMessage(from, {
            text: '🔄 *Atualizando áudios...*\n_Isso pode levar alguns segundos_'
        }, { quoted: message });

        const audios = await carregarAudios(true);

        if (audios && audios.length > 0) {
            const listaAudios = audios.map((a, i) => `   ${i + 1}. ${a.nome}`).join('\n');
            
            await sock.sendMessage(from, {
                text: `✅ *Áudios atualizados com sucesso!*\n\n` +
                      `🎵 *Total:* ${audios.length} áudios\n\n` +
                      `📋 *Lista atualizada:*\n${listaAudios}\n\n` +
                      `_Última atualização: ${new Date().toLocaleString('pt-BR')}_`
            }, { quoted: message });
            
            console.log('✅ Comando #atualizarregras concluído com sucesso');
            return true;
        } else {
            await sock.sendMessage(from, {
                text: '❌ *Erro ao atualizar áudios!*\n\n' +
                      'Nenhum áudio foi encontrado no repositório.\n' +
                      'Verifique se o arquivo JSON está correto.'
            }, { quoted: message });
            
            console.error('❌ Nenhum áudio encontrado após atualização');
            return false;
        }

    } catch (error) {
        console.error('❌ Erro no comando #atualizarregras:', error);
        
        try {
            await sock.sendMessage(message.key.remoteJid, {
                text: `❌ *Erro ao atualizar!*\n\n${error.message}`
            }, { quoted: message });
        } catch (e) {
            console.error('❌ Erro ao enviar mensagem de erro:', e.message);
        }
        
        return false;
    }
}

// ============================================
// HANDLER PRINCIPAL
// ============================================
const alertaHandler = async (sock, message) => {
    try {
        const { key, message: msg } = message;
        const from = key.remoteJid;
        const sender = key.participant || key.remoteJid;

        const content = msg?.conversation 
            || msg?.extendedTextMessage?.text 
            || msg?.imageMessage?.caption 
            || msg?.videoMessage?.caption 
            || msg?.documentMessage?.caption 
            || '';

        const contentTrimmed = content.toLowerCase().trim();

        console.log(`\n🔍 alertaHandler chamado | Conteúdo: "${contentTrimmed}"`);

        if (contentTrimmed === '#atualizarregras') {
            console.log('✅ Processando #atualizarregras');
            return await handleComandoAtualizarAudios(sock, message);
        }

        if (!content.includes('#alerta')) {
            console.log('⏭️ Não é comando #alerta, ignorando');
            return false;
        }

        console.log('✅ Processando #alerta');

        if (!from.includes('@g.us')) {
            await sock.sendMessage(from, {
                text: '⚠️ *Este comando só funciona em grupos!*'
            }, { quoted: message });
            return true;
        }

        const audios = audiosCache.length > 0 ? audiosCache : await carregarAudios();
        
        if (!audios || audios.length === 0) {
            await sock.sendMessage(from, {
                text: '❌ *Áudios não disponíveis no momento.*\n\n' +
                      'Tente usar *#atualizarregras* primeiro ou aguarde alguns minutos.'
            }, { quoted: message });
            return true;
        }

        const groupMetadata = await sock.groupMetadata(from);

        const isAdmin = groupMetadata.participants.some(
            p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
        );

        if (!isAdmin) {
            await sock.sendMessage(from, {
                text: '🚫 *Somente administradores podem usar este comando!*'
            }, { quoted: message });
            return true;
        }

        let targetMessageId = null;
        let targetParticipant = null;

        const contextInfo = msg?.extendedTextMessage?.contextInfo 
            || msg?.imageMessage?.contextInfo 
            || msg?.videoMessage?.contextInfo 
            || msg?.documentMessage?.contextInfo;

        if (contextInfo?.stanzaId && contextInfo?.participant) {
            if (isValidParticipant(contextInfo.participant)) {
                targetMessageId = contextInfo.stanzaId;
                targetParticipant = contextInfo.participant;
            } else {
                console.log('⚠️ Participante inválido ignorado');
            }
        }

        // ============================================
        // CASO 1: ALERTA GERAL (SEM RESPOSTA)
        // ============================================
        if (!targetMessageId || !targetParticipant) {
            console.log('📢 Enviando ALERTA GERAL para o grupo');

            await deleteMessage(sock, from, {
                remoteJid: from,
                id: key.id,
                participant: sender
            });

            // 🖼️ ENVIA APENAS O POSTER
            const posterBuffer = await downloadPoster();
            
            if (!posterBuffer) {
                await sock.sendMessage(from, {
                    text: '❌ Erro ao carregar poster das regras'
                });
                return true;
            }

            const posterMessage = await sock.sendMessage(from, {
                image: posterBuffer,
                caption: '📢 *ATENÇÃO MEMBROS DO GRUPO*\n\n🎵 _Ouçam os áudios das regras abaixo_'
            });

            console.log('✅ Poster enviado');

            // 🎵 ENVIA TODOS OS ÁUDIOS FAZENDO QUOTE DO POSTER
            await sendAudiosComQuoteDoPoster(sock, from, audios, posterMessage);

            return true;
        }

        // ============================================
        // CASO 2: ADVERTÊNCIA INDIVIDUAL (COM RESPOSTA)
        // ============================================
        console.log('🎯 ADVERTÊNCIA INDIVIDUAL');

        let targetName = targetParticipant.split('@')[0];
        const participant = groupMetadata.participants.find(p => p.id === targetParticipant);
        
        if (participant) {
            targetName = participant.notify || participant.verifiedName || participant.name || targetName;
        }

        // Deleta mensagem do infrator
        const deleted = await deleteMessage(sock, from, {
            remoteJid: from,
            id: targetMessageId,
            participant: targetParticipant
        });

        if (deleted) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Deleta comando do admin
        await deleteMessage(sock, from, {
            remoteJid: from,
            id: key.id,
            participant: sender
        });

        // 🖼️ ENVIA APENAS O POSTER COM MENÇÃO
        const posterBuffer = await downloadPoster();
        
        if (!posterBuffer) {
            await sock.sendMessage(from, {
                text: '❌ Erro ao carregar poster das regras'
            });
            return true;
        }

        const posterMessage = await sock.sendMessage(from, {
            image: posterBuffer,
            caption: `🚨 *@${targetName}*\n\n` +
                     `⚠️ _Sua mensagem foi removida por conter conteúdo proibido._\n\n` +
                     `🎵 _Ouça atentamente os áudios das regras abaixo_`,
            mentions: [targetParticipant]
        });

        console.log(`✅ Poster enviado para @${targetName}`);

        // 🎵 ENVIA TODOS OS ÁUDIOS FAZENDO QUOTE DO POSTER
        await sendAudiosComQuoteDoPoster(sock, from, audios, posterMessage, targetParticipant);

        return true;

    } catch (error) {
        console.error('❌ Erro no alertaHandler:', error);
        if (CONFIG.DEBUG) console.error(error.stack);
        return false;
    }
};

// ============================================
// INICIALIZAÇÃO
// ============================================
console.log('🚀 Iniciando carregamento dos áudios de regras...');
carregarAudios().then(audios => {
    if (audios && audios.length > 0) {
        console.log('✅ alertaHandler pronto para uso!');
        console.log(`📊 Configuração: POSTER + ${audios.length} áudios`);
    } else {
        console.warn('⚠️ alertaHandler iniciado, mas nenhum áudio foi carregado');
    }
}).catch(error => {
    console.error('❌ Erro ao inicializar alertaHandler:', error.message);
});

// ============================================
// EXPORTAÇÕES
// ============================================
export default alertaHandler;
export { 
    alertaHandler,
    carregarAudios,
    sendAudiosComQuoteDoPoster
};