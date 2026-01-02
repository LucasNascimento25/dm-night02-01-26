// despedidaMembro.js -> E chamada no bot.js

import Jimp from 'jimp';
import axios from 'axios';

/**
 * Gera uma thumbnail a partir de uma URL ou buffer.
 * @param {Buffer|string} input - Buffer da imagem ou URL
 * @param {number} size - tamanho da thumbnail (padrão 256)
 * @returns {Promise<Buffer|null>} - Retorna buffer da thumbnail PNG
 */
async function gerarThumbnail(input, size = 256) {
    try {
        let buffer;
        if (typeof input === 'string') {
            const res = await axios.get(input, { responseType: 'arraybuffer' });
            buffer = Buffer.from(res.data, 'binary');
        } else {
            buffer = input;
        }

        const image = await Jimp.read(buffer);
        image.resize(size, size);
        return await image.getBufferAsync(Jimp.MIME_PNG);
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

/**
 * Envia imagem/GIF com thumbnail
 * @param {object} sock - instância do Baileys
 * @param {string} jid - ID do grupo ou usuário
 * @param {Buffer} buffer - Buffer da imagem/GIF
 * @param {string} caption - legenda da mensagem
 * @param {string[]} mentions - array com IDs de menções
 */
async function sendMediaWithThumbnail(sock, jid, buffer, caption, mentions = []) {
    try {
        const thumb = await gerarThumbnail(buffer);
        await sock.sendMessage(jid, {
            image: buffer,
            caption,
            mentions,
            jpegThumbnail: thumb
        });
    } catch (err) {
        console.error('Erro ao enviar mídia com thumbnail:', err);
        await sock.sendMessage(jid, { text: caption, mentions });
    }
}

/**
 * Função auxiliar para extrair o identificador correto do participant
 * EXATAMENTE IGUAL AO AVISOADM.JS
 */
const getParticipantId = (participantData) => {
    // Se for string (versão antiga), retorna direto
    if (typeof participantData === 'string') {
        return participantData;
    }
    // Se for objeto (versão nova), extrai phoneNumber ou id
    if (typeof participantData === 'object' && participantData !== null) {
        return participantData.phoneNumber || participantData.id;
    }
    return participantData;
};

/**
 * Configura mensagens de despedida para participantes que saem do grupo
 * ESTRUTURA IGUAL AO AVISOADM.JS - Recebe update completo
 * 
 * @param {object} socket - instância do Baileys
 * @param {object} update - Objeto de atualização completo do grupo
 */
export const configurarDespedida = async (socket, update) => {
    try {
        console.log('🔍 DEBUG DESPEDIDA - Início da função');
        console.log('Update recebido:', JSON.stringify(update, null, 2));

        // ✅ VALIDAÇÃO: Verifica se há participantes
        if (!update.participants || update.participants.length === 0) {
            console.log('❌ Nenhum participante para processar');
            return;
        }

        // ✅ EXATAMENTE IGUAL AO AVISOADM: Extrai dados do update
        const participantData = update.participants[0];
        const participant = getParticipantId(participantData);
        
        console.log('📋 participantData:', participantData);
        console.log('📋 participant extraído:', participant);
        
        // Para comparação de IDs (quando é objeto, usa o .id)
        const participantIdForComparison = typeof participantData === 'object' && participantData !== null 
            ? participantData.id 
            : participant;
        
        const author = update.author;
        const groupId = update.id;

        console.log('🔍 COMPARAÇÃO:');
        console.log('  participantIdForComparison:', participantIdForComparison);
        console.log('  author:', author);

        // ✅ EXATAMENTE IGUAL AO AVISOADM: Verifica se o usuário saiu por conta própria
        const isUserLeftByThemselves = participantIdForComparison === author;

        console.log('  São iguais?', isUserLeftByThemselves);

        // ✅ SÓ ENVIA DESPEDIDA SE O USUÁRIO SAIU POR CONTA PRÓPRIA
        if (!isUserLeftByThemselves) {
            console.log('❌ Usuário foi removido por admin, despedida não será enviada.');
            return;
        }

        console.log('✅ Usuário saiu voluntariamente, enviando despedida...');

        // Extrai apenas o número para a menção
        const participantPhoneNumber = participant.split('@')[0];

        // Lista de URLs de imagens/GIFs de despedida
        const farewellImages = [
            'https://i.ibb.co/bR2SSbXY/Image-fx-1.jpg'
        ];

        // Lista de mensagens de despedida
        const farewellMessages = [
            `💔 *Pior que "quem é você?"* @${participantPhoneNumber}\nO grupo vai ficar mais leve agora, e talvez até com mais inteligência.😏😹\nBoa sorte no mundo real! 😹`
        ];

        // Seleciona imagem e mensagem aleatórias
        const randomImage = farewellImages[Math.floor(Math.random() * farewellImages.length)];
        const randomMessage = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];

        // Baixa e envia a imagem com mensagem
        const res = await axios.get(randomImage, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(res.data, 'binary');

        await sendMediaWithThumbnail(socket, groupId, buffer, randomMessage, [participant]);
        
        console.log('✅ Despedida enviada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao processar despedida:', error.message);
        console.error('Stack:', error.stack);
    }
};