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
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⭐ CONFIGURAR FFMPEG
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
  '😏📸 E aí, tá escondendo o rosto ou só gosta de suspense mesmo?',
  '👁️💥 Olho aqui, rosto não! Não me faça ir aí te arrastar!',
  '😎🔥 Cadê você? Se não mandar a foto agora, eu começo a inventar histórias!',
  '👀🤔 Só o olho? Achei que ia ver uma pessoa, não um emoji 3D!',
  '😂👁️ Manda o resto da cara aí, parcelado tá valendo!',
  '🔍😅 FBI investigando: onde está o restante dessa pessoa?',
  '👁️🚨 Alerta vermelho! Temos apenas 10% de uma foto aqui!',
  '😏💬 Esse olho tá famoso, mas cadê o artista completo?',
  '🤨📱 Mano, seu celular só tem câmera pra olho é?',
  '😂🎭 Tá fazendo cosplay de ciclope ou é tímido mesmo?',
  '👁️⚠️ URGENTE: Pessoa desaparecida! Só encontramos um olho!',
  '🔥😎 Esse mistério todo... você é famoso(a) ou procurado(a)?',
  '👀💭 Tô começando a achar que você é só um olho mesmo!',
  '😅🎪 Circo quer saber se você tá disponível pra número de mágica!',
  '🤣📸 Próximo capítulo: a orelha! Aguardamos ansiosos!',
  '👁️🎬 Trailer tá bom, mas cadê o filme completo?',
  '😏🕵️ Sherlock Holmes desistiu de descobrir sua cara!',
  '🤔🧩 Tô montando um quebra-cabeça aqui, me ajuda mandando o resto!',
  '👀🚀 Houston, encontramos apenas um olho! Precisamos de reforços!',
  '😂🎨 Picasso que te ensinou a tirar foto foi?',
  '🔍👁️ CSI pediu pra mandar a foto completa pra investigação!',
  '😎💥 Manda logo essa cara senão vou ter que adivinhar!',
  '🤨📷 Seu celular tem defeito ou você que é artista?',
  '👁️😅 Manda aí! Prometo não fazer meme... mentira, não prometo não!',
  '🔥🤔 Esse suspense tá melhor que série da Netflix!',
  '😂👤 Cadê o resto? Ficou na fila do SUS esperando?',
  '👀💬 Olho bonito, mas quero ver o pacote completo!',
  '🎭😏 Tá economizando internet? Manda aos poucos não!',
  '🤣🔎 Google Lens desistiu de identificar você!',
  '👁️⏰ Tô esperando desde ontem o resto dessa foto!',
  '😅🎪 Já pensou em trabalhar com efeitos especiais?',
  '🔥👀 Só falta mandar a íris separada agora!',
  '😂📱 Seu celular deve ter a opção "modo testemunha protegida"!',
  '🤔💭 Tô criando 15 versões diferentes de como você deve ser!',
  '👁️🚨 ATENÇÃO: Envie a foto completa em até 5 minutos ou vira meme!',
  '😎🎬 Essa enrolação tá parecendo novela mexicana!',
  '🤨🔍 Até o Google não acha o resto de você!',
  '😂🧙 Magia? Bruxaria? Câmera quebrada? Me explica isso!',
  '👀💥 Manda logo antes que eu desenhe o resto!',
  '🔥😏 Seu rosto tá em HD ou só o olho mesmo?',
  '🤣📸 Fotógrafo pediu demissão de vergonha!',
  '👁️🎯 Acertei um olho, faltam as outras partes!',
  '😅🕵️ Polícia Federal quer saber sua localização... da cara toda!',
  '🤔💬 Isso é arte moderna ou timidez crônica?',
  '😂🎭 Se não mandar agora, boto sua cara no gerador de IA!',
  '👀🚀 NASA detectou apenas 1/10 de uma pessoa nessa foto!',
  '🔥😎 Quanto tá cobrando pra ver o resto? Aceita pix?',
  '🤨📷 Seu celular tem a opção "modo espião" ativada!',
  '😂🧩 Vou juntar as fotos de todo mundo pra montar você!',
  '👁️💭 Aposto que o resto da cara é mais legal que esse suspense!',
  '😏🎪 Circo ligou, quer você pro número do homem invisível!',
  '🤣🔎 FBI, CIA e INTERPOL desistiram de te achar completo!',
  '👀⚡ Chega de mistério! Tá parecendo programa de rádio!',
  '🔥🤔 Só eu que sinto que tô sendo trollado aqui?',
  '😅📸 Economizando megapixel é nova moda?',
  '🤨💬 Vou começar a cobrar por cada segundo de espera!',
  '😂👤 Seu rosto tá bloqueado por direitos autorais?',
  '👁️🎬 Esse teaser tá melhor que trailer de Vingadores!',
  '😎💥 5... 4... 3... Manda logo essa cara aí!',
  '🤣🧙 Harry Potter tá pedindo aula de invisibilidade com você!',
  '👀🚨 ÚLTIMA CHAMADA: Mostre sua cara ou vire lenda do grupo!',
  '🔥😏 Tá guardando o rosto pra ocasião especial é?',
  '😂📱 Apple vai lançar iPhone com modo "só olho" inspirado em você!',
  '🤔🎯 Tô jogando dardo no escuro tentando adivinhar sua cara!',
  '👁️😅 Única pessoa que manda currículo só com o olho!',
  '😎🔍 Polícia científica pediu mais evidências!',
  '🤨💭 Será que existe mesmo ou é só um olho falante?',
  '😂🎭 Resumo da ópera: cadê você de verdade?',
  '👀🚀 SpaceX encontrou mais coisa em Marte do que eu aqui!',
  '🔥🤣 Tô quase botando sua cara no photoshop!',
  '😅📸 Câmera frontal morreu de desgosto?',
  '🤔💬 Esse olho tá carregando o grupo nas costas!',
  '😂👤 Procura-se: o resto dessa pessoa. Recompensa: risadas!',
  '👁️🎪 Mágico quer saber seu segredo de desaparecer!',
  '😏💥 Vai mandar ou vou ter que hackear seu celular?',
  '🤨🧩 Falta 90% ainda pra completar esse puzzle!',
  '😂🔎 Detetive Pikachu desistiu do caso!',
  '👀⚡ Explosão de curiosidade em 3... 2... 1...!',
  '🔥😎 Esse olho já virou celebridade do grupo!',
  '🤣📱 Tutorial: Como aparecer sem aparecer!',
  '😅🕵️ Operação Cara Limpa: missão fracassada!',
  '🤔💭 Já sei! Você é um olho que ganhou vida!',
  '😂🎬 Suspense do ano: Onde está Wally versão 2.0!',
  '👁️🚨 Alerta: Rosto em falta há 3 horas!',
  '😎💬 Olho lindo, mas não dá pra namorar só um olho né!',
  '🤨🔥 Tá fazendo greve do rosto é?',
  '😂👤 Seu rosto tá de férias?',
  '👀🎯 Target acquired... ou quase né!',
  '🔥😏 Tá economizando beleza pra vender depois?',
  '🤣📸 Instagram vs Realidade ao extremo!',
  '😅🧙 Você é o novo membro dos X-Men: Olho Misterioso!',
  '🤔💥 Bora lá! Confia! Ninguém vai zoar... MUITO!',
  '😂🕵️ Até o Google Fotos desistiu de te reconhecer!',
  '👁️🚀 NASA confirma: é vida inteligente, mas só 10% dela!',
  '😎💬 Esse olho aí já ganhou Oscar de melhor suspense!',
  '🤨🎭 Teatro do olho misterioso apresenta: nunca saberemos!',
  '🔥🤣 Vou fazer enquete: quem acha que você existe de verdade?',
  '😂📱 Seu celular tem a opção "modo vergonha" ligada!',
  '👀💭 Tô imaginando 500 versões diferentes de você!',
  '😅🔎 Procurado vivo ou morto... ou pelo menos completo!',
  '🤔🎪 Ilusionista David Copperfield perdeu pro seu sumiço!',
  '😂💥 Bora! 3... 2... 1... MANDA!',
  '👁️🚨 Polícia da selfie te procura!',
  '😎🔥 Esse olho tá mais famoso que você completo seria!',
  '🤨😂 Alguém sabe CPF de olho? Vou registrar esse aqui!',
  '🤣📸 Fotógrafa: "Say cheese!" Você: "Say eye!"',
  '👀💬 Grupo já aceitou: você é o olho oficial daqui!',
  '🔥😏 Tô contando até 10... ah, não, até 100!',
  '😂🧩 Puzzle do ano: monte essa pessoa se conseguir!',
  '😅🕵️ Investigação concluída: você é feito só de olho mesmo!',
  '🤔💭 Plotwist: você é um olho gigante com pernas!',
  '😂🎬 Roteiro da Netflix: O Mistério do Olho Eterno!',
  '👁️🚀 Até ET mostrou mais a cara que você!',
  '😎⚡ Sua cara tá em manutenção é?',
  '🤨🔥 Sinceramente, tô mais curioso que gato agora!',
  '😂👤 Seu rosto foi sequestrado? Chama o resgate!',
  '👀💥 Última chance antes de eu criar sua cara no Paint!',
  '🔥😏 Quanto tempo mais? Tô ficando velho esperando!',
  '🤣📱 Manual do celular: Capítulo 50 - Como tirar foto completa!',
  '😅🎯 Acertei o olho, errei os outros 90%!',
  '🤔💬 Você é tímido ou tá fazendo pegadinha?',
  '😂🧙 Feitiço de invisibilidade deu 90% certo!',
  '👁️🚨 URGENTÍSSIMO: Mande a foto completa ou vira print!',
  '😎🔍 Esse caso é pra Scooby-Doo resolver!',
  '🤨💭 Tá escondendo o rosto pra não virar meme né? Tarde demais!',
  '🔥😂 Vai mandar ou vou ter que te desenhar?',
  '😂📸 Essa foto tá no modo "demonstração gratuita"!',
  '👀🎪 Circo quer contratar pra número de aparição!',
  '😅💥 Bora! Todo mundo tá esperando! Não decepciona!',
  '🤔🔎 Tô pensando em abrir uma vaquinha pra ver sua cara!',
  '😂🎭 Dramalhão: O Olho Que Ninguém Viu Por Inteiro!',
  '👁️⚡ Se não mandar agora, vou criar tua cara no Dall-E!',
  '😎💬 Spoiler: ninguém vai te julgar! Bora lá!',
  '🤨🚀 Essa saga tá mais longa que Star Wars!',
  '🔥😏 Prometo não fazer meme... de novo... muito!',
  '😂👤 Seu rosto tá em quarentena ainda?',
  '🤣📱 Celular bugou e tirou só 1/10 da foto!',
  '👀💭 Já criei tanta expectativa que você vai ter que aparecer de coroa!',
  '😅🕵️ Caso arquivado: O Rosto Que Nunca Apareceu!',
  '🤔🎯 Aposto que todo mundo já esqueceu como você é!',
  '😂💥 ATENÇÃO: Essa é sua última chance de não virar lenda!',
  '👁️🚨 Breaking News: Olho continua sozinho no grupo!',
  '😎🔥 Seu rosto tá em manutenção preventiva?',
  '🤨😂 Já aceitamos: você É o olho. Não existe mais nada!',
  '🤣📸 Parabéns! Você inventou a foto minimalista!',
  '👀💬 Tô esperando mais ansioso que criança em véspera de Natal!',
  '🔥😏 Se não mandar, vou colocar sua cara numa figurinha aleatória!',
  '😂🧩 Juntei todos os olhos do grupo, achei o seu repetido!',
  '😅🎪 Houdini tá com inveja desse desaparecimento!',
  '🤔💭 Será que você existe mesmo ou é bot?',
  '😂🎬 Trilogia completa: O Olho, A Lenda, O Mistério!',
  '👁️🚀 Elon Musk quer saber se você mora em outra dimensão!'
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
                    .save(outputPath);

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