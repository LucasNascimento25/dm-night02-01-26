import { downloadMediaMessage } from '@whiskeysockets/baileys';
import Jimp from 'jimp';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Handler para criar stickers a partir de imagens/vídeos com texto opcional
 * Comando: #stickerdamas [texto]
 */
async function stickerHandler(sock, msg, quotedMsg, texto = '') {
    try {
        console.log('🎯 Iniciando stickerHandler...');

        // Verifica se está respondendo a uma mensagem
        if (!quotedMsg || !quotedMsg.message) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Por favor, responda a uma imagem ou vídeo com o comando #stickerdamas\n\n📝 Exemplos:\n#stickerdamas\n#stickerdamas leozinho'
            }, { quoted: msg });
            return;
        }

        // Verifica se a mensagem citada contém uma imagem ou vídeo
        const hasImage = quotedMsg.message.imageMessage || 
                        quotedMsg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        
        const hasVideo = quotedMsg.message.videoMessage || 
                        quotedMsg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
        
        console.log('🖼️ Tem imagem?', hasImage ? 'SIM' : 'NÃO');
        console.log('🎬 Tem vídeo?', hasVideo ? 'SIM' : 'NÃO');

        if (!hasImage && !hasVideo) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ A mensagem respondida precisa ser uma imagem ou vídeo!'
            }, { quoted: msg });
            return;
        }

        // Envia mensagem de processamento
        const mediaType = hasVideo ? 'vídeo' : 'imagem';
        const processingMsg = `⏳ Criando sticker de ${mediaType}... Aguarde!`;
        
        await sock.sendMessage(msg.key.remoteJid, {
            text: processingMsg
        }, { quoted: msg });

        let stickerBuffer;

        if (hasVideo) {
            // Processa vídeo (ignorando texto - apenas converte para sticker animado)
            console.log('🎬 Baixando vídeo...');
            const buffer = await downloadMediaMessage(
                quotedMsg,
                'buffer',
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            console.log(`📦 Buffer de vídeo baixado: ${buffer.length} bytes`);
            
            if (texto.trim()) {
                console.log('⚠️ Texto em vídeos não é suportado no momento. Criando sticker animado sem texto.');
            }
            
            stickerBuffer = await createVideoSticker(buffer);
        } else {
            // Processa imagem
            console.log('📥 Baixando imagem...');
            const buffer = await downloadMediaMessage(
                quotedMsg,
                'buffer',
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            console.log(`📦 Buffer baixado: ${buffer.length} bytes`);

            if (texto.trim()) {
                stickerBuffer = await createStickerWithText(buffer, texto);
            } else {
                stickerBuffer = await createSimpleSticker(buffer);
            }
        }

        if (!stickerBuffer) {
            throw new Error('Falha ao processar mídia');
        }

        console.log('📤 Enviando sticker...');

        // Envia o sticker WebP com metadados
        await sock.sendMessage(msg.key.remoteJid, {
            sticker: stickerBuffer,
            mimetype: 'image/webp',
            fileName: 'sticker.webp'
        }, {
            packname: '👑 Damas da Night',
            author: '🎉 Bot Exclusivo',
            categories: ['🔥']
        });

        console.log('✅ Sticker criado e enviado com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao criar sticker:', error);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Erro ao criar sticker. Tente novamente ou verifique se a mídia é válida.'
        }, { quoted: msg });
    }
}

/**
 * Cria sticker animado a partir de vídeo
 */
async function createVideoSticker(videoBuffer, texto = '') {
    const tempDir = os.tmpdir();
    const timestamp = Date.now() + Math.random().toString(36).substring(7);
    const inputPath = path.join(tempDir, `sticker_video_input_${timestamp}.mp4`);
    const outputPath = path.join(tempDir, `sticker_video_output_${timestamp}.webp`);

    try {
        console.log('🎬 Processando vídeo para sticker animado...');
        
        // Salva o vídeo temporário
        fs.writeFileSync(inputPath, videoBuffer);
        console.log(`💾 Vídeo temporário salvo: ${inputPath}`);
        
        // Converte vídeo para WebP animado 512x512 focando na parte superior
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512:0:0,fps=15" -compression_level 4 -q:v 75 -loop 0 -an -t 6 "${outputPath}"`;
        
        console.log('⚙️ Executando FFmpeg para vídeo...');
        await execPromise(ffmpegCommand);
        
        // Lê o arquivo WebP gerado
        const webpBuffer = fs.readFileSync(outputPath);
        console.log(`✅ WebP animado gerado (512x512): ${webpBuffer.length} bytes`);
        
        // Limpa arquivos temporários
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        
        return webpBuffer;
        
    } catch (error) {
        console.error('❌ Erro ao converter vídeo para WebP:', error.message);
        
        // Limpa arquivos em caso de erro
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (cleanupError) {
            console.error('⚠️ Erro ao limpar arquivos temporários:', cleanupError);
        }
        
        return null;
    }
}

/**
 * Aplica bordas arredondadas à imagem
 */
async function applyRoundedCorners(image, radius) {
    const width = image.getWidth();
    const height = image.getHeight();
    
    // Percorre cada pixel da imagem
    image.scan(0, 0, width, height, function(x, y, idx) {
        // Verifica se o pixel está nos cantos
        let distanceFromCorner = 0;
        
        // Canto superior esquerdo
        if (x < radius && y < radius) {
            const dx = radius - x;
            const dy = radius - y;
            distanceFromCorner = Math.sqrt(dx * dx + dy * dy);
            if (distanceFromCorner > radius) {
                this.bitmap.data[idx + 3] = 0; // Define alpha como 0 (transparente)
            }
        }
        // Canto superior direito
        else if (x > width - radius && y < radius) {
            const dx = x - (width - radius);
            const dy = radius - y;
            distanceFromCorner = Math.sqrt(dx * dx + dy * dy);
            if (distanceFromCorner > radius) {
                this.bitmap.data[idx + 3] = 0;
            }
        }
        // Canto inferior esquerdo
        else if (x < radius && y > height - radius) {
            const dx = radius - x;
            const dy = y - (height - radius);
            distanceFromCorner = Math.sqrt(dx * dx + dy * dy);
            if (distanceFromCorner > radius) {
                this.bitmap.data[idx + 3] = 0;
            }
        }
        // Canto inferior direito
        else if (x > width - radius && y > height - radius) {
            const dx = x - (width - radius);
            const dy = y - (height - radius);
            distanceFromCorner = Math.sqrt(dx * dx + dy * dy);
            if (distanceFromCorner > radius) {
                this.bitmap.data[idx + 3] = 0;
            }
        }
    });
    
    return image;
}

/**
 * Converte PNG para WebP usando FFmpeg
 */
async function convertToWebP(inputBuffer) {
    // Usa diretório temporário do sistema
    const tempDir = os.tmpdir();
    const timestamp = Date.now() + Math.random().toString(36).substring(7);
    const inputPath = path.join(tempDir, `sticker_input_${timestamp}.png`);
    const outputPath = path.join(tempDir, `sticker_output_${timestamp}.webp`);

    try {
        console.log('🔄 Convertendo para WebP...');
        
        // Salva o buffer como PNG temporário
        fs.writeFileSync(inputPath, inputBuffer);
        console.log(`💾 PNG temporário salvo: ${inputPath}`);
        
        // Converte para WebP usando FFmpeg com configurações otimizadas para sticker
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -vcodec libwebp -filter:v "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -qscale 75 -preset default -loop 0 -an -vsync 0 "${outputPath}"`;
        
        console.log('⚙️ Executando FFmpeg...');
        await execPromise(ffmpegCommand);
        
        // Lê o arquivo WebP gerado
        const webpBuffer = fs.readFileSync(outputPath);
        console.log(`✅ WebP gerado: ${webpBuffer.length} bytes`);
        
        // Limpa arquivos temporários
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        
        return webpBuffer;
        
    } catch (error) {
        console.error('❌ Erro ao converter para WebP:', error.message);
        
        // Limpa arquivos em caso de erro
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (cleanupError) {
            console.error('⚠️ Erro ao limpar arquivos temporários:', cleanupError);
        }
        
        return null;
    }
}

/**
 * Cria sticker simples sem texto
 */
async function createSimpleSticker(imageBuffer) {
    try {
        console.log('🖼️ Processando imagem para sticker simples...');
        
        // Carrega a imagem
        let image = await Jimp.read(imageBuffer);
        console.log(`📐 Dimensões originais: ${image.getWidth()}x${image.getHeight()}`);
        
        // Redimensiona para 512x512 focando na parte superior
        image.cover(512, 512, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_TOP);
        
        console.log(`✅ Redimensionado: 512x512`);
        
        // Aplica bordas arredondadas
        image = await applyRoundedCorners(image, 60);
        console.log(`✅ Bordas arredondadas aplicadas`);
        
        // Gera PNG
        const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
        console.log(`✅ PNG gerado: ${pngBuffer.length} bytes`);
        
        // Converte para WebP
        const webpBuffer = await convertToWebP(pngBuffer);
        
        if (!webpBuffer) {
            console.log('⚠️ Falha ao converter para WebP, tentando enviar PNG...');
            return pngBuffer;
        }
        
        return webpBuffer;
        
    } catch (error) {
        console.error('❌ Erro ao criar sticker simples:', error);
        return null;
    }
}

/**
 * Cria sticker com texto
 */
async function createStickerWithText(imageBuffer, texto) {
    try {
        console.log('🖼️ Processando imagem para sticker com texto...');
        
        // Carrega a imagem
        let image = await Jimp.read(imageBuffer);
        console.log(`📐 Dimensões originais: ${image.getWidth()}x${image.getHeight()}`);
        
        // Redimensiona para 512x512 focando na parte superior
        image.cover(512, 512, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_TOP);
        
        console.log(`✅ Redimensionado: 512x512`);

        // Aplica bordas arredondadas
        image = await applyRoundedCorners(image, 60);
        console.log(`✅ Bordas arredondadas aplicadas`);

        // Texto em maiúsculas
        const textoUpper = texto.toUpperCase();
        console.log(`✍️ Adicionando texto: "${textoUpper}"`);
        
        // Carrega as fontes
        const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

        // Calcula posição centralizada do texto
        const textWidth = Jimp.measureText(fontWhite, textoUpper);
        const textX = Math.floor((512 - textWidth) / 2);
        const textY = 420;
        
        console.log(`📝 Texto na posição: (${textX}, ${textY})`);

        // Adiciona contorno preto forte
        for (let offsetX = -3; offsetX <= 3; offsetX++) {
            for (let offsetY = -3; offsetY <= 3; offsetY++) {
                if (offsetX !== 0 || offsetY !== 0) {
                    image.print(fontBlack, textX + offsetX, textY + offsetY, textoUpper);
                }
            }
        }

        // Adiciona texto branco
        image.print(fontWhite, textX, textY, textoUpper);

        // Gera PNG
        const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
        console.log(`✅ PNG com texto gerado: ${pngBuffer.length} bytes`);

        // Converte para WebP
        const webpBuffer = await convertToWebP(pngBuffer);
        
        if (!webpBuffer) {
            console.log('⚠️ Falha ao converter para WebP, tentando enviar PNG...');
            return pngBuffer;
        }
        
        return webpBuffer;

    } catch (error) {
        console.error('❌ Erro ao criar sticker com texto:', error);
        return null;
    }
}

/**
 * Função para processar o comando
 */
export async function handleStickerCommand(sock, msg) {
    try {
        console.log('🚀 handleStickerCommand iniciado');

        const messageText = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || '';
        
        console.log('💬 Texto da mensagem:', messageText);

        // Extrai o texto após o comando
        const parts = messageText.split(' ');
        const comando = parts[0].toLowerCase();
        const texto = parts.slice(1).join(' ').trim();
        
        console.log('🔧 Comando:', comando);
        console.log('📝 Texto extraído:', texto);

        // Verifica se há contextInfo com quotedMessage
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        
        if (!contextInfo || !contextInfo.quotedMessage) {
            console.log('❌ Não há mensagem citada');
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Por favor, responda a uma imagem ou vídeo com o comando #stickerdamas\n\n📝 Exemplos:\n#stickerdamas\n#stickerdamas leozinho'
            }, { quoted: msg });
            return;
        }

        console.log('✅ Mensagem citada encontrada');
        console.log('📦 QuotedMessage keys:', Object.keys(contextInfo.quotedMessage));

        // Monta o objeto quotedMsg no formato esperado pelo Baileys
        const quotedMsg = {
            key: {
                remoteJid: msg.key.remoteJid,
                fromMe: false,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant
            },
            message: contextInfo.quotedMessage
        };

        await stickerHandler(sock, msg, quotedMsg, texto);

    } catch (error) {
        console.error('❌ Erro no handleStickerCommand:', error);
        console.error('Stack trace:', error.stack);
    }
}

export { stickerHandler };