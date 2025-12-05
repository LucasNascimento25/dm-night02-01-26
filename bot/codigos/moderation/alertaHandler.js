// alertaHandler.js - Sistema de Moderação Completo
// Versão otimizada com envio imediato de áudios
// AJUSTADO PARA 4 ÁUDIOS

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import githubCache from "../utils/githubCacheManager.js";

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ alertaHandler.js CARREGADO!');

// ============================================
// CONFIGURAÇÕES
// ============================================
const CONFIG = {
    URL_AUDIOS: 'https://raw.githubusercontent.com/LucasNascimento25/audio-regras/main/audios-regras.json',
    CACHE_KEY: 'alertas-regras-audios',
    AUDIO_INTERVAL: 0, // ⚡ SEM INTERVALO - ENVIO IMEDIATO
    MAX_RETRIES: 3,
    DOWNLOAD_TIMEOUT: 30000,
    DEBUG: process.env.DEBUG === 'true',
    // 🎵 Configuração de áudios
    AUDIOS_GRUPO: 4,      // TODOS os 4 áudios para grupo geral
    AUDIOS_INDIVIDUAL: 4  // TODOS os 4 áudios para advertência individual
};

// ============================================
// GERENCIAMENTO DE ÁUDIOS
// ============================================
async function carregarAudios(forceRefresh = false) {
    try {
        console.log(`🔄 Carregando áudios das regras... ${forceRefresh ? '(FORÇANDO ATUALIZAÇÃO)' : ''}`);
        
        const result = await githubCache.fetch(
            CONFIG.URL_AUDIOS,
            CONFIG.CACHE_KEY,
            (data) => {
                const audios = (data.audios || []).filter(a => a.ativo === true && a.comando === 'regras');
                
                if (CONFIG.DEBUG) {
                    console.log(`🔍 Áudios filtrados: ${audios.length}`);
                }
                
                return audios;
            },
            forceRefresh
        );

        if (result.success && result.data && result.data.length > 0) {
            const origem = result.fromCache ? 'cache' : 'GitHub';
            console.log(`✅ ${result.data.length} áudios carregados (${origem})`);
            
            if (!result.fromCache || CONFIG.DEBUG) {
                console.log('🎵 Lista:', result.data.map(a => a.nome).join(', '));
            }
            
            return result.data;
        } else {
            console.error('❌ Nenhum áudio disponível');
            return [];
        }
    } catch (error) {
        console.error('❌ Erro ao carregar áudios:', error.message);
        if (CONFIG.DEBUG) console.error(error.stack);
        return [];
    }
}

function converterParaRawUrl(url) {
    if (!url) return url;
    
    return url.includes('github.com') && url.includes('/blob/')
        ? url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
        : url;
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

            const rawUrl = converterParaRawUrl(url);
            console.log(`📥 Baixando áudio (tentativa ${attempt + 1}/${CONFIG.MAX_RETRIES})...`);

            const response = await axios.get(rawUrl, {
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
// ENVIO DE ÁUDIOS
// ============================================
async function sendAudioByIndex(sock, jid, audios, index, quotedMessage = null) {
    try {
        if (!audios || audios.length === 0) {
            console.error('❌ Array de áudios vazio');
            return false;
        }

        if (index < 0 || index >= audios.length) {
            console.error(`❌ Índice inválido: ${index} (total: ${audios.length})`);
            return false;
        }

        const audioInfo = audios[index];
        
        if (!audioInfo || !audioInfo.url) {
            console.error(`❌ Áudio ${index + 1} não tem URL válida`);
            return false;
        }

        console.log(`\n🎵 Enviando: ${audioInfo.nome} (${index + 1}/${audios.length})`);

        const audioBuffer = await downloadAudioBuffer(audioInfo.url);
        if (!audioBuffer) return false;

        const sendOptions = quotedMessage ? { quoted: quotedMessage } : {};

        const audioOpus = await converterParaOpus(audioBuffer);

        if (audioOpus) {
            try {
                await sock.sendMessage(jid, {
                    audio: audioOpus,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                }, sendOptions);
                
                console.log(`✅ Enviado (Opus): ${audioInfo.nome}`);
                return true;
            } catch (err) {
                console.log(`⚠️ Opus falhou (${err.message}), tentando MP3...`);
            }
        }

        const audioMp3Normalizado = await normalizarMp3(audioBuffer);
        
        await sock.sendMessage(jid, {
            audio: audioMp3Normalizado || audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: true
        }, sendOptions);

        console.log(`✅ Enviado (MP3): ${audioInfo.nome}`);
        return true;

    } catch (error) {
        console.error(`❌ Erro ao enviar áudio ${index + 1}:`, error.message);
        if (CONFIG.DEBUG) console.error(error.stack);
        return false;
    }
}

async function sendAudiosSequencial(sock, jid, audios, startIndex, count, quotedMessage = null) {
    if (!audios || audios.length === 0) {
        console.error('❌ Nenhum áudio disponível para envio');
        return;
    }

    const endIndex = Math.min(startIndex + count, audios.length);
    const actualCount = endIndex - startIndex;

    console.log(`\n🎵 Enviando ${actualCount} áudios IMEDIATAMENTE (${startIndex + 1} a ${endIndex})`);

    for (let i = 0; i < actualCount; i++) {
        // ⚡ SEM DELAY - ENVIO IMEDIATO
        await sendAudioByIndex(sock, jid, audios, startIndex + i, quotedMessage);
    }

    console.log('✅ Envio sequencial concluído\n');
}

async function sendAudiosSequencialComResposta(sock, jid, audios, startIndex, count, quotedMessage, targetParticipant) {
    if (!audios || audios.length === 0) {
        console.error('❌ Nenhum áudio disponível para envio');
        return;
    }

    const endIndex = Math.min(startIndex + count, audios.length);
    const actualCount = endIndex - startIndex;

    console.log(`\n🎵 Enviando ${actualCount} áudios IMEDIATAMENTE respondendo mensagem (${startIndex + 1} a ${endIndex})`);

    for (let i = 0; i < actualCount; i++) {
        // ⚡ SEM DELAY - ENVIO IMEDIATO
        try {
            const audioInfo = audios[startIndex + i];
            
            if (!audioInfo || !audioInfo.url) {
                console.error(`❌ Áudio ${startIndex + i + 1} não tem URL válida`);
                continue;
            }

            console.log(`\n🎵 Enviando: ${audioInfo.nome} (${startIndex + i + 1}/${audios.length})`);

            const audioBuffer = await downloadAudioBuffer(audioInfo.url);
            if (!audioBuffer) continue;

            const audioOpus = await converterParaOpus(audioBuffer);

            if (audioOpus) {
                try {
                    await sock.sendMessage(jid, {
                        audio: audioOpus,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true,
                        contextInfo: {
                            mentionedJid: [targetParticipant]
                        }
                    }, { quoted: quotedMessage });
                    
                    console.log(`✅ Enviado (Opus) com menção: ${audioInfo.nome}`);
                    continue;
                } catch (err) {
                    console.log(`⚠️ Opus falhou (${err.message}), tentando MP3...`);
                }
            }

            const audioMp3Normalizado = await normalizarMp3(audioBuffer);
            
            await sock.sendMessage(jid, {
                audio: audioMp3Normalizado || audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: true,
                contextInfo: {
                    mentionedJid: [targetParticipant]
                }
            }, { quoted: quotedMessage });

            console.log(`✅ Enviado (MP3) com menção: ${audioInfo.nome}`);

        } catch (error) {
            console.error(`❌ Erro ao enviar áudio ${startIndex + i + 1}:`, error.message);
            if (CONFIG.DEBUG) console.error(error.stack);
        }
    }

    console.log('✅ Envio sequencial com resposta concluído\n');
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

async function getGroupDescription(sock, groupId) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        return metadata.desc || null;
    } catch (error) {
        console.error('❌ Erro ao buscar descrição do grupo:', error.message);
        return null;
    }
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

        const audios = await carregarAudios();
        if (!audios || audios.length === 0) {
            await sock.sendMessage(from, {
                text: '❌ *Áudios não disponíveis no momento.*\n\n' +
                      'Tente usar *#atualizarregras* primeiro ou aguarde alguns minutos.'
            }, { quoted: message });
            return true;
        }

        // ⚠️ VALIDAÇÃO: Verificar se temos áudios suficientes
        if (audios.length < 4) {
            await sock.sendMessage(from, {
                text: `⚠️ *Áudios insuficientes!*\n\n` +
                      `Temos apenas ${audios.length} áudio(s).\n` +
                      `Mínimo necessário: 4 áudios`
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

        if (!targetMessageId || !targetParticipant) {
            console.log('📢 Enviando regras GERAIS para o grupo');

            await deleteMessage(sock, from, {
                remoteJid: from,
                id: key.id,
                participant: sender
            });

            const descricao = await getGroupDescription(sock, from);
            const regras = descricao || '📜 *Regras não disponíveis na descrição do grupo*';

            const mentions = groupMetadata.participants
                .filter(p => isValidParticipant(p.id))
                .map(p => p.id);

            await sock.sendMessage(from, {
                text: `📢 *ATENÇÃO MEMBROS DO GRUPO*\n\n${regras}`,
                mentions
            });

            console.log(`✅ Regras enviadas (${mentions.length} menções)`);

            // 🎵 Enviar TODOS os 4 áudios para grupo geral
            await sendAudiosSequencial(sock, from, audios, 0, audios.length);

            return true;
        }

        console.log('🎯 ADVERTÊNCIA INDIVIDUAL');

        let targetName = targetParticipant.split('@')[0];
        const participant = groupMetadata.participants.find(p => p.id === targetParticipant);
        
        if (participant) {
            targetName = participant.notify || participant.verifiedName || participant.name || targetName;
        }

        const deleted = await deleteMessage(sock, from, {
            remoteJid: from,
            id: targetMessageId,
            participant: targetParticipant
        });

        if (deleted) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        await deleteMessage(sock, from, {
            remoteJid: from,
            id: key.id,
            participant: sender
        });

        // PRIMEIRA MENSAGEM - Aviso imediato
        await sock.sendMessage(from, {
            text: `🚨 *MENSAGEM REMOVIDA*\n\n` +
                  `⚠️ @${targetName}, sua mensagem foi apagada por conter *CONTEÚDO PROIBIDO*.\n\n` +
                  `📋 Leia atentamente as regras do grupo abaixo.`,
            mentions: [targetParticipant]
        });

        console.log(`✅ Aviso enviado para @${targetName}`);

        // SEGUNDA MENSAGEM - Regras completas (IMEDIATO)
        const descricao = await getGroupDescription(sock, from);
        const regras = descricao || '📜 *Regras não disponíveis na descrição do grupo*';

        const regrasMessage = await sock.sendMessage(from, {
            text: `📖 *POR FAVOR, LEIA AS REGRAS DO GRUPO* 📖\n\n` +
                  `@${targetName}, para mantermos um ambiente saudável e respeitoso, pedimos que você leia atentamente as regras abaixo:\n\n` +
                  `${regras}\n\n` +
                  `✅ Seguir estas regras garante uma boa convivência para todos!\n` +
                  `🤝 Contamos com sua colaboração.`,
            mentions: [targetParticipant]
        });

        console.log(`✅ Regras enviadas para @${targetName}`);

        // 🎵 Enviar TODOS os 4 áudios para advertência individual
        await sendAudiosSequencialComResposta(sock, from, audios, 0, audios.length, regrasMessage, targetParticipant);

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
console.log('🚀 Iniciando carregamento dos áudios...');
carregarAudios().then(audios => {
    if (audios && audios.length > 0) {
        console.log('✅ alertaHandler pronto para uso!');
        console.log(`📊 Configuração: TODOS os ${audios.length} áudios serão enviados em ambos os casos`);
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
    sendAudiosSequencialComResposta
};