// codigos/handlers/message/olhinhoHandler.js
// Handler para detectar e avisar quando alguém coloca reação de olhinho
// VERSÃO STANDALONE - NÃO USA githubCacheManager
// CORREÇÃO: Quote correto da mensagem original com olhinho

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ olhinhoHandler.js CARREGADO!');

// URL CORRETA DO REPOSITÓRIO GITHUB
const URL_AUDIOS_JSON = 'https://raw.githubusercontent.com/LucasNascimento25/olhinho-audio-bt/refs/heads/main/audios-bt.json';

// Cache dos áudios em memória
let audios = [];
let ultimaAtualizacao = null;

// Controle de rotação
let indiceAtual = 0;

export class OlhinhoHandler {
    constructor() {
        this.olhinhoEmojis = ['👁️', '👁', '👀'];
        this.processedReactions = new Set();
        
        // Array de mensagens em sequência
        this.mensagens = [
  '😏📸 E aí, tá escondendo o rosto ou só gosta de suspense mesmo?'
  
];
        
        // Índice para rotação sequencial das mensagens
        this.indiceMensagemAtual = 0;
        
        // Inicia carregamento
        this.inicializar();
    }
    
    /**
     * Retorna a próxima mensagem na sequência (rotação circular)
     */
    getProximaMensagem() {
        const mensagem = this.mensagens[this.indiceMensagemAtual];
        console.log(`💬 Mensagem ${this.indiceMensagemAtual + 1}/${this.mensagens.length}: ${mensagem}`);
        
        // Avança para próxima (circular)
        this.indiceMensagemAtual = (this.indiceMensagemAtual + 1) % this.mensagens.length;
        
        return mensagem;
    }

    async inicializar() {
        console.log('🎵 Iniciando carregamento dos áudios...');
        await carregarAudios();
    }

    /**
     * COMANDO #atualizaraudios - Atualiza áudios manualmente
     */
    async handleComandoAtualizar(sock, message) {
        try {
            const from = message.key.remoteJid;
            
            console.log('🔄 Comando #atualizaraudios recebido!');
            
            await sock.sendMessage(from, { 
                text: '🔄 *Atualizando áudios do GitHub...*\n\nAguarde um momento...' 
            }, { quoted: message });

            const totalAnterior = audios.length;
            
            const sucesso = await carregarAudios();

            if (sucesso) {
                const novos = audios.length - totalAnterior;
                let msgSucesso = `✅ *Áudios atualizados com sucesso!*\n\n` +
                    `📊 *Total de áudios:* ${audios.length}`;
                
                if (novos > 0) {
                    msgSucesso += `\n🆕 *Novos áudios:* ${novos}`;
                } else if (novos < 0) {
                    msgSucesso += `\n🗑️ *Removidos:* ${Math.abs(novos)}`;
                }

                await sock.sendMessage(from, { text: msgSucesso }, { quoted: message });
                return true;
            } else {
                await sock.sendMessage(from, { 
                    text: '❌ *Erro ao atualizar áudios!*\n\nVerifique o GitHub e tente novamente.' 
                }, { quoted: message });
                return false;
            }

        } catch (error) {
            console.error('❌ Erro no comando atualizaraudios:', error);
            return false;
        }
    }

    /**
     * Verifica se a mensagem é o comando #atualizaraudios
     */
    isComandoAtualizar(message) {
        const content = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || '';
        return content.toLowerCase().trim() === '#atualizaraudios';
    }

    /**
     * Obtém o próximo áudio na rotação
     */
    getProximoAudio() {
        if (audios.length === 0) {
            console.error('❌ Nenhum áudio disponível');
            return null;
        }

        const audio = audios[indiceAtual];
        console.log(`🎵 Áudio atual: ${audio.nome} (${indiceAtual + 1}/${audios.length})`);
        
        // Avança para próximo (circular)
        indiceAtual = (indiceAtual + 1) % audios.length;
        
        return audio;
    }

    /**
     * Baixa o buffer do áudio
     */
    async downloadAudioBuffer(url) {
        try {
            console.log(`📥 Baixando áudio: ${url}`);
            
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
                    'Accept': 'audio/mpeg, audio/*, */*'
                }
            });

            if (response.data && response.data.byteLength > 0) {
                console.log(`✅ Áudio baixado: ${response.data.byteLength} bytes`);
                return Buffer.from(response.data);
            }
            return null;

        } catch (error) {
            console.error(`❌ Erro ao baixar áudio: ${error.message}`);
            return null;
        }
    }

    /**
     * Converte áudio para formato Opus usando fluent-ffmpeg
     */
    async converterParaOpus(inputBuffer) {
        return new Promise((resolve) => {
            try {
                console.log('🔄 Convertendo para Opus (formato PTT)...');
                const tempDir = path.join(__dirname, '../../../temp');

                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const timestamp = Date.now();
                const inputPath = path.join(tempDir, `input_${timestamp}.mp3`);
                const outputPath = path.join(tempDir, `output_${timestamp}.ogg`);

                fs.writeFileSync(inputPath, inputBuffer);

                ffmpeg(inputPath)
                    .audioCodec('libopus')
                    .audioBitrate('48k')
                    .audioChannels(1)
                    .audioFrequency(48000)
                    .format('ogg')
                    .output(outputPath)
                    .on('error', (err) => {
                        console.warn('⚠️ FFmpeg falhou:', err.message);
                        try {
                            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        } catch (e) {}
                        resolve(null);
                    })
                    .on('end', () => {
                        try {
                            if (!fs.existsSync(outputPath)) {
                                console.warn('⚠️ Arquivo de saída não foi criado');
                                fs.unlinkSync(inputPath);
                                resolve(null);
                                return;
                            }

                            const audioConvertido = fs.readFileSync(outputPath);
                            
                            try {
                                fs.unlinkSync(inputPath);
                                fs.unlinkSync(outputPath);
                            } catch (e) {}

                            console.log(`✅ Convertido para Opus: ${(audioConvertido.length / 1024).toFixed(2)} KB`);
                            resolve(audioConvertido);
                        } catch (error) {
                            console.error('❌ Erro ao ler arquivo convertido:', error.message);
                            resolve(null);
                        }
                    })
                    .run();

            } catch (error) {
                console.error('❌ Erro na conversão:', error.message);
                resolve(null);
            }
        });
    }

    /**
     * Envia o áudio como PTT (Push-to-Talk / Áudio de Voz)
     * CORREÇÃO: Passa a mensagem completa para quote, não apenas a key
     */
    async sendAudio(sock, jid, quotedMessage = null) {
        try {
            console.log('\n========== ENVIANDO ÁUDIO PTT ==========');

            const audioInfo = this.getProximoAudio();
            
            if (!audioInfo) {
                console.error('❌ Nenhum áudio disponível');
                return false;
            }

            console.log(`🎯 Enviando: ${audioInfo.nome}`);

            // Baixa o áudio
            const audioBuffer = await this.downloadAudioBuffer(audioInfo.url);
            
            if (!audioBuffer) {
                console.error('❌ Falha ao baixar áudio');
                return false;
            }

            // ✅ CORREÇÃO: Passa a mensagem completa, não apenas a key
            const sendOptions = quotedMessage ? { quoted: quotedMessage } : {};

            // ESTRATÉGIA 1: Opus com PTT (PREFERENCIAL - aparece como áudio de voz)
            console.log('🎤 Tentando enviar como Opus PTT...');
            const audioOpus = await this.converterParaOpus(audioBuffer);

            if (audioOpus) {
                try {
                    await sock.sendMessage(jid, {
                        audio: audioOpus,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    }, sendOptions);

                    console.log(`✅ Áudio PTT enviado com sucesso: ${audioInfo.nome}`);
                    console.log('========================================\n');
                    return true;
                } catch (err) {
                    console.error(`⚠️ Opus PTT falhou: ${err.message}`);
                    console.log('Tentando fallback...');
                }
            }

            // ESTRATÉGIA 2: MP3 com PTT (fallback)
            console.log('🎤 Tentando enviar como MP3 PTT...');
            try {
                await sock.sendMessage(jid, {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    ptt: true
                }, sendOptions);

                console.log(`✅ Áudio PTT enviado (MP3): ${audioInfo.nome}`);
                console.log('========================================\n');
                return true;
            } catch (err) {
                console.error(`❌ MP3 PTT falhou: ${err.message}`);
            }

            console.error('❌ Todas as estratégias PTT falharam');
            console.log('========================================\n');
            return false;

        } catch (error) {
            console.error('❌ Erro ao enviar áudio PTT:', error.message);
            console.log('========================================\n');
            return false;
        }
    }

    async isAdmin(sock, groupId, userId) {
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            return participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (error) {
            return false;
        }
    }

    async handleReactionFromMessage(sock, message) {
        try {
            if (!message?.key) return false;

            const from = message.key.remoteJid;
            const userId = message.key.participant || message.key.remoteJid;
            const content = message.message?.conversation || '';

            if (!from.endsWith('@g.us')) return false;
            if (!this.olhinhoEmojis.some(emoji => content.includes(emoji))) return false;

            const reactionKey = `${from}_${message.key.id}_${userId}`;
            if (this.processedReactions.has(reactionKey)) return true;

            this.processedReactions.add(reactionKey);
            setTimeout(() => this.processedReactions.delete(reactionKey), 5 * 60 * 1000);

            if (message.key.fromMe || userId === sock.user?.id) return true;

            const isUserAdmin = await this.isAdmin(sock, from, userId);

            const responseText = this.getProximaMensagem();

            // ✅ CORREÇÃO: Envia respondendo a mensagem ORIGINAL com olhinho
            await sock.sendMessage(from, { text: responseText }, { quoted: message });

            const delayAleatorio = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
            console.log(`⏰ Aguardando ${(delayAleatorio / 1000).toFixed(1)}s antes do áudio...`);

            setTimeout(async () => {
                // ✅ CORREÇÃO: Áudio também responde a mensagem ORIGINAL com olhinho
                await this.sendAudio(sock, from, message);
            }, delayAleatorio);

            const adminTag = isUserAdmin ? '👑 ADMIN' : '';
            console.log(`👁️ Olhinho de ${userId.split('@')[0]} ${adminTag} em ${from}`);

            return true;

        } catch (error) {
            console.error('❌ Erro ao processar reação:', error);
            return false;
        }
    }

    async handleReaction(sock, reaction) {
        try {
            if (!reaction || !reaction.key) return;

            const { key, reactions } = reaction;
            const from = key.remoteJid;

            if (!from.endsWith('@g.us')) return;
            if (!reactions || reactions.length === 0) return;

            for (const react of reactions) {
                const reactionKey = `${from}_${key.id}_${react.key.participant}_${react.text}`;

                if (this.processedReactions.has(reactionKey)) continue;

                if (this.olhinhoEmojis.includes(react.text)) {
                    const userId = react.key.participant || react.key.remoteJid;

                    if (userId === sock.user?.id) continue;

                    this.processedReactions.add(reactionKey);
                    setTimeout(() => this.processedReactions.delete(reactionKey), 5 * 60 * 1000);

                    const isUserAdmin = await this.isAdmin(sock, from, userId);

                    const responseText = this.getProximaMensagem();

                    // ✅ CORREÇÃO: Construir mensagem completa para quote
                    const quotedMsg = {
                        key: react.key,
                        message: reaction.message || {}
                    };

                    // ✅ CORREÇÃO: Responde a mensagem que recebeu a reação de olhinho
                    await sock.sendMessage(from, { text: responseText }, { quoted: quotedMsg });

                    const delayAleatorio = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
                    console.log(`⏰ Aguardando ${(delayAleatorio / 1000).toFixed(1)}s antes do áudio...`);

                    setTimeout(async () => {
                        // ✅ CORREÇÃO: Áudio também responde a mensagem que recebeu a reação
                        await this.sendAudio(sock, from, quotedMsg);
                    }, delayAleatorio);

                    console.log(`👁️ Olhinho de ${userId.split('@')[0]} em ${from}`);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao processar reação:', error);
        }
    }

    async diagnosticar() {
        console.log('\n========== DIAGNÓSTICO ==========');
        console.log(`Áudios carregados: ${audios.length}`);
        console.log(`Índice atual: ${indiceAtual + 1}/${audios.length}`);
        console.log(`Última atualização: ${ultimaAtualizacao}`);
        console.log(`URL configurada: ${URL_AUDIOS_JSON}`);

        if (audios.length > 0) {
            console.log('\n📋 Lista de áudios:');
            audios.slice(0, 5).forEach((audio, idx) => {
                const atual = idx === indiceAtual ? ' 👈 PRÓXIMO' : '';
                console.log(`  ${idx + 1}. ${audio.nome}${atual}`);
            });
            if (audios.length > 5) {
                console.log(`  ... e mais ${audios.length - 5} áudios`);
            }
        }

        console.log('=================================\n');
    }

    clearCache() {
        this.processedReactions.clear();
        console.log('🧹 Cache limpo');
    }
}

/**
 * Carrega os áudios do GitHub DIRETAMENTE (sem cache manager)
 */
async function carregarAudios() {
    try {
        console.log('🔄 [Audios] Carregando áudios do GitHub...');
        console.log(`📡 URL: ${URL_AUDIOS_JSON}`);
        
        const response = await fetch(URL_AUDIOS_JSON, {
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
        
        // Filtra apenas áudios ativos
        const audiosAtivos = (data.audios || []).filter(a => a.ativo === true);
        
        if (audiosAtivos.length === 0) {
            console.error('❌ [Audios] Nenhum áudio ativo encontrado no JSON');
            return false;
        }

        audios = audiosAtivos;
        ultimaAtualizacao = new Date();
        
        console.log(`✅ [Audios] ${audios.length} áudios carregados com sucesso!`);
        console.log('📋 Primeiros áudios:');
        audios.slice(0, 3).forEach((a, i) => {
            console.log(`  ${i + 1}. ${a.nome} (${a.id})`);
        });
        
        return true;

    } catch (error) {
        console.error('❌ [Audios] Erro ao carregar:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Inicializar carregando os áudios
console.log('🚀 Iniciando carregamento inicial dos áudios...');
carregarAudios().then(success => {
    if (success) {
        console.log('✅ Sistema de áudios PTT pronto!');
    } else {
        console.error('❌ Falha ao inicializar sistema de áudios');
    }
});

export default new OlhinhoHandler();