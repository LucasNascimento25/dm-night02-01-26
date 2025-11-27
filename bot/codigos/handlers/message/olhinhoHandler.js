// codigos/handlers/message/olhinhoHandler.js
// Handler para detectar e avisar quando alguém coloca reação de olhinho
// VERSÃO IGUAL AO hqseroticos.js - CARREGA DO GITHUB

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import githubCache from '../../utils/githubCacheManager.js';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ olhinhoHandler.js CARREGADO!');

// URL do repositório GitHub
const URL_AUDIOS_JSON = 'https://raw.githubusercontent.com/LucasNascimento25/audios-damas-bt/main/audios.json';

// Cache dos áudios em memória (IGUAL AO hqseroticos.js)
let audios = [];
let ultimaAtualizacao = null;

// Controle de rotação
let indiceAtual = 0;

export class OlhinhoHandler {
    constructor() {
        this.olhinhoEmojis = ['👁️', '👁', '👀'];
        this.processedReactions = new Set();
        
        // Inicia carregamento
        this.inicializar();
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
     * Converte áudio para formato Opus
     */
    async converterParaOpus(inputBuffer) {
        try {
            console.log('🔄 Convertendo para Opus...');
            const tempDir = path.join(__dirname, '../../../temp');

            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const timestamp = Date.now();
            const inputPath = path.join(tempDir, `input_${timestamp}.mp3`);
            const outputPath = path.join(tempDir, `output_${timestamp}.opus`);

            fs.writeFileSync(inputPath, inputBuffer);

            const comando = `ffmpeg -i "${inputPath}" -c:a libopus -b:a 96k -vbr on -ac 1 "${outputPath}" -y`;
            await execPromise(comando);

            const audioConvertido = fs.readFileSync(outputPath);

            try {
                fs.unlinkSync(inputPath);
                fs.unlinkSync(outputPath);
            } catch (e) {}

            console.log(`✅ Convertido! (${audioConvertido.length} bytes)`);
            return audioConvertido;

        } catch (error) {
            console.error('❌ Erro ao converter:', error.message);
            return null;
        }
    }

    /**
     * Envia o áudio como PTT
     */
    async sendAudio(sock, jid, quotedMessage = null) {
        try {
            console.log('\n========== ENVIANDO ÁUDIO PTT ==========');

            const audioInfo = this.getProximoAudio();
            
            if (!audioInfo) {
                console.error('❌ Nenhum áudio disponível');
                return false;
            }

            // Baixa o áudio
            const audioBuffer = await this.downloadAudioBuffer(audioInfo.url);
            
            if (!audioBuffer) {
                console.error('❌ Falha ao baixar áudio');
                return false;
            }

            const sendOptions = quotedMessage ? { quoted: quotedMessage } : {};

            // Tenta converter para Opus
            const audioOpus = await this.converterParaOpus(audioBuffer);

            if (audioOpus) {
                try {
                    await sock.sendMessage(jid, {
                        audio: audioOpus,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    }, sendOptions);

                    console.log(`✅ Áudio enviado: ${audioInfo.nome}`);
                    console.log('========================================\n');
                    return true;
                } catch (err) {
                    console.error(`❌ Opus falhou: ${err.message}`);
                }
            }

            // Fallback: tenta MP3 direto
            try {
                await sock.sendMessage(jid, {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    ptt: true
                }, sendOptions);

                console.log(`✅ Áudio enviado (MP3): ${audioInfo.nome}`);
                console.log('========================================\n');
                return true;
            } catch (err) {
                console.error(`❌ MP3 falhou: ${err.message}`);
            }

            console.error('❌ Todas as estratégias falharam');
            return false;

        } catch (error) {
            console.error('❌ Erro ao enviar áudio:', error.message);
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

            let responseText;
            if (isUserAdmin) {
                responseText = `👀👑 *Eita! Admin colocando olhinho!* 😏\n\n` +
                    `Não pense que vai escapar dessa não, chefe! 🤨\n` +
                    `Admin também tem que participar! 📸\n\n` +
                    `Se não mandar foto agora, paga miquinho! 🐒\n\n` +
                    `*Escolha seu mico:*\n` +
                    `🐔 Imitar uma galinha\n` +
                    `🦆 Imitar um pato\n` +
                    `🐒 Imitar um macaco\n` +
                    `🐐 Imitar um bode\n` +
                    `🐷 Imitar um porco\n` +
                    `🎤 Cantar uma música\n\n` +
                    `*Admin é exemplo, bora lá!* 💪👑✨`;
            } else {
                responseText = `👀✨ *Opa! Olhinho detectado, cadê o rostinho?* 📸😏\n\n` +
                    `Se não mandar foto agora, paga miquinho! 🐒\n\n` +
                    `*Escolha seu mico:*\n` +
                    `🐔 Imitar uma galinha\n` +
                    `🦆 Imitar um pato\n` +
                    `🐒 Imitar um macaco\n` +
                    `🐐 Imitar um bode\n` +
                    `🐷 Imitar um porco\n` +
                    `🎤 Cantar uma música\n\n` +
                    `*Tá geral esperando, não vacila!* ⏰👁️‍🗨️👂😏`;
            }

            await sock.sendMessage(from, { text: responseText }, { quoted: message });

            const delayAleatorio = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
            console.log(`⏰ Aguardando ${(delayAleatorio / 1000).toFixed(1)}s antes do áudio...`);

            setTimeout(async () => {
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

                    let responseText;
                    if (isUserAdmin) {
                        responseText = `👀👑 *Eita! Admin colocando olhinho!* 😏\n\n` +
                            `Não pense que vai escapar dessa não, admin! 🤨\n` +
                            `Você também tem que participar! 📸\n\n` +
                            `Se mandou olhinho, manda fotinha! 🫵✨`;
                    } else {
                        responseText = `👀✨ *Opa! Olhinho detectado, cadê o rostinho?* 📸😏\n\n` +
                            `Se não mandar foto agora, paga miquinho! 🐒`;
                    }

                    const quotedMsg = {
                        key: react.key,
                        message: reaction.message || {}
                    };

                    await sock.sendMessage(from, { text: responseText }, { quoted: quotedMsg });

                    const delayAleatorio = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
                    console.log(`⏰ Aguardando ${(delayAleatorio / 1000).toFixed(1)}s antes do áudio...`);

                    setTimeout(async () => {
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

        if (audios.length > 0) {
            console.log('\n📋 Lista de áudios:');
            audios.forEach((audio, idx) => {
                const atual = idx === indiceAtual ? ' 👈 PRÓXIMO' : '';
                console.log(`  ${idx + 1}. ${audio.nome}${atual}`);
            });
        }

        console.log('=================================\n');
    }

    clearCache() {
        this.processedReactions.clear();
        console.log('🧹 Cache limpo');
    }
}

/**
 * Carrega os áudios do GitHub (IGUAL AO carregarHQs do hqseroticos.js)
 */
async function carregarAudios() {
    try {
        console.log('🔄 [Audios] Carregando áudios...');
        
        const result = await githubCache.fetch(
            URL_AUDIOS_JSON,
            'olhinho-audios',
            (data) => {
                return (data.audios || []).filter(a => a.ativo === true);
            }
        );

        if (result.success) {
            audios = result.data;
            ultimaAtualizacao = new Date();
            const origem = result.fromCache ? 'cache' : 'GitHub';
            const count = Array.isArray(audios) ? audios.length : 'N/A';
            console.log(`✅ [Audios] ${count} áudios carregados (${origem})`);
            return true;
        } else {
            console.error('❌ [Audios] Falha ao carregar áudios');
            return false;
        }
    } catch (error) {
        console.error('❌ [Audios] Erro:', error.message);
        return false;
    }
}

// Inicializar carregando os áudios (IGUAL AO hqseroticos.js)
console.log('🚀 Iniciando carregamento inicial dos áudios...');
carregarAudios();

export default new OlhinhoHandler();