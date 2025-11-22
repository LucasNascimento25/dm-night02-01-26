// messageHandler.js - ARQUIVO PRINCIPAL COM REPLYTAG, OLHINHO E CONFISSÕES
import AutoTagHandler from '../../moderation/autoTagHandler.js';
import ReplyTagHandler from '../../moderation/replyTagHandler.js';
import olhinhoHandler from './olhinhoHandler.js';
import confissoesHandler from './confissoesHandler.js';
import pool from '../../../../db.js';
import { moderacaoAvancada, statusGrupo } from '../../moderation/removerCaracteres.js';
import { handleAntiLink } from '../../moderation/antilink.js';
import { processCommandPriorities } from '../../handlers/command/commandPriorities.js';
import { handleBasicCommands, handleGroupUpdate } from './messageHelpers.js';
import { handleStickerCommand } from '../../features/stickerHandler.js';
// 🆕 IMPORTA A FUNÇÃO DE REGRAS
import { processarComandoRegras } from '../../features/boasVindas.js';

const autoTag = new AutoTagHandler();
const replyTag = new ReplyTagHandler();

const OWNER_NUMBERS = [
    '5516981874405',
    '5521972337640'
];

export async function handleMessages(sock, message) {
    try {
        if (!message?.key || !message?.message) return;

        const from = message.key.remoteJid;
        const userId = message.key.participant || message.key.remoteJid;
        const messageKey = message.key;
        const content =
            message.message.conversation ||
            message.message.extendedTextMessage?.text ||
            message.message.imageMessage?.caption ||
            message.message.videoMessage?.caption ||
            '';

        if (!content || message.key.fromMe || userId === sock.user?.jid) return;

        console.log(`📨 Mensagem de ${userId} em ${from}: ${content}`);

        // 💌 DETECTA MENSAGENS PRIVADAS (CONFISSÕES) - PRIORIDADE MÁXIMA
        const isPrivateChat = !from.endsWith('@g.us') && !from.includes('@newsletter');
        if (isPrivateChat) {
            const confissaoHandled = await confissoesHandler.handlePrivateMessage(sock, message, from, userId, content);
            if (confissaoHandled) {
                console.log('✅ Confissão processada no privado');
                return;
            }
        }

        // 🎵 COMANDO #atualizaraudios - ATUALIZA ÁUDIOS DO GITHUB
        if (olhinhoHandler.isComandoAtualizar(message)) {
            console.log('🔄 Comando #atualizaraudios detectado');
            await olhinhoHandler.handleComandoAtualizar(sock, message);
            return;
        }

        // 👁️ DETECTA REAÇÕES DE OLHINHO (PRIORIDADE ALTA)
        const isReaction = await olhinhoHandler.handleReactionFromMessage(sock, message);
        if (isReaction) {
            console.log('✅ Reação de olhinho processada');
            return;
        }

        // Moderação e Anti-link
        if (from.endsWith('@g.us')) {
            await moderacaoAvancada(sock, message);
            await handleAntiLink(sock, message, from);
        }

        // 🔥 REPLYTAG - Processa RESPOSTAS com #totag (PRIORIDADE MÁXIMA)
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const replyResult = await replyTag.processReply(
                sock,
                from,
                userId,
                content,
                messageKey,
                message
            );
            
            if (replyResult?.processed) {
                console.log('✅ ReplyTag processado com sucesso');
                return;
            }
        }

        // 🔥 Comandos admin do ReplyTag
        const replyAdminHandled = await replyTag.handleAdminCommands(
            sock,
            from,
            userId,
            content
        );
        if (replyAdminHandled) return;

        // 🆕 COMANDO #regras - Qualquer pessoa pode usar
        if (content.toLowerCase().trim().startsWith('#regras')) {
            console.log('📋 Comando #regras detectado');
            const regrasProcessed = await processarComandoRegras(sock, message);
            if (regrasProcessed) {
                console.log('✅ Regras enviadas com sucesso');
                return;
            }
        }

        // Comando #stickerdamas (prioridade alta, processa antes de outros)
        if (content.toLowerCase().startsWith('#stickerdamas')) {
            console.log('🎨 Comando #stickerdamas detectado');
            await handleStickerCommand(sock, message);
            return;
        }

        // 💌 COMANDOS DE CONFISSÕES (ADMIN) - COM DELETE AUTOMÁTICO
        if (from.endsWith('@g.us')) {
            // Comando para avisar sobre as confissões
            if (content.toLowerCase() === '#avisarconfissoes') {
                console.log('📢 Comando #avisarconfissoes detectado');
                const avisoPosted = await confissoesHandler.postarAvisoConfissoes(sock, from, userId, messageKey);
                if (avisoPosted) return;
            }
            
            // Comando para postar confissões
            if (content.toLowerCase() === '#postarconfissoes') {
                console.log('📨 Comando #postarconfissoes detectado');
                const confissaoPosted = await confissoesHandler.handleManualPost(sock, from, userId, messageKey);
                if (confissaoPosted) return;
            }
        }

        // Processa comandos por prioridade
        const handled = await processCommandPriorities(
            sock, message, from, userId, content,
            OWNER_NUMBERS, autoTag, pool
        );

        // Comandos básicos
        if (!handled) {
            await handleBasicCommands(sock, message, from, userId, content, pool);
        }

    } catch (err) {
        console.error('❌ Erro ao processar mensagem:', err);
    }
}

// 👁️ NOVA FUNÇÃO - Handler para reações
export async function handleReactions(sock, reaction) {
    try {
        await olhinhoHandler.handleReaction(sock, reaction);
    } catch (err) {
        console.error('❌ Erro ao processar reação:', err);
    }
}

export async function updateGroupOnJoin(sock, groupId) {
    try {
        const count = await autoTag.updateGroup(sock, groupId);
        console.log(`✅ Grupo ${groupId} atualizado: ${count} membros`);
    } catch (error) {
        console.error('❌ Erro ao atualizar grupo:', error);
    }
}

export async function handleGroupParticipantsUpdate(sock, update) {
    await handleGroupUpdate(sock, update);
}