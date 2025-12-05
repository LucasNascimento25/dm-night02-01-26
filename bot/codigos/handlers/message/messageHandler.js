// messageHandler.js - VERSÃO SEM COMANDOS DE MÍDIA
import AutoTagHandler from '../../moderation/autoTagHandler.js';
import ReplyTagHandler from '../../moderation/replyTagHandler.js';
import olhinhoHandler from './olhinhoHandler.js';
import confissoesHandler from './confissoesHandler.js';
import alertaHandler from '../../moderation/alertaHandler.js';
import { handleSignos } from '../../moderation/signosHandler.js';
import { handleGroupCommands } from '../../utils/redefinirFecharGrupo.js';
import { handleOwnerMenu } from '../../features/menuOwner.js';
import pool from '../../../../db.js';
import { moderacaoAvancada } from '../../moderation/removerCaracteres.js';
import { handleAntiLink } from '../../moderation/antilink.js';
import { processCommandPriorities } from '../../handlers/command/commandPriorities.js';
import { handleBasicCommands, handleGroupUpdate } from './messageHelpers.js';
import { handleStickerCommand } from '../../features/stickerHandler.js';
import { processarComandoRegras } from '../../features/boasVindas.js';
import { configurarDespedida } from '../../features/despedidaMembro.js';
import AutoMediaRemover from '../../features/autoMediaRemover.js'; // 🔥 Importação direta

const autoTag = new AutoTagHandler();
const replyTag = new ReplyTagHandler();

const OWNER_NUMBERS = ['5516981874405', '5521972337640'];
const DEBUG_MODE = process.env.DEBUG === 'true';

// 🔥 REMOÇÃO AUTOMÁTICA (SEM COMANDOS)
const OWNER_JID = '5516981874405@s.whatsapp.net'; // ⚠️ COLOQUE SEU NÚMERO AQUI
let autoMediaRemover = null;

// ============================================
// 🔥 CACHE PARA EVITAR DUPLICATAS
// ============================================
const processedMessages = new Set();
const MESSAGE_CACHE_LIMIT = 200;

function cleanMessageCache() {
    if (processedMessages.size > MESSAGE_CACHE_LIMIT) {
        const toDelete = processedMessages.size - MESSAGE_CACHE_LIMIT;
        const iterator = processedMessages.values();
        for (let i = 0; i < toDelete; i++) {
            processedMessages.delete(iterator.next().value);
        }
    }
}

function getMessageUniqueId(messageKey) {
    const { remoteJid, id, fromMe, participant } = messageKey;
    return `${remoteJid}_${id}_${fromMe}_${participant || 'none'}`;
}

function extrairNumeroJID(jid) {
    if (!jid) return '';
    return jid.split('@')[0];
}

// ============================================
// 🎯 HANDLER PRINCIPAL
// ============================================
export async function handleMessages(sock, message) {
    try {
        // 🔥 Inicializar AutoMediaRemover (apenas uma vez)
        if (!autoMediaRemover) {
            autoMediaRemover = new AutoMediaRemover(sock, OWNER_JID);
            console.log('✅ AutoMediaRemover inicializado');
        }

        // Verifica duplicatas
        const uniqueId = getMessageUniqueId(message.key);
        if (processedMessages.has(uniqueId)) return;
        
        processedMessages.add(uniqueId);
        cleanMessageCache();
        
        // Validações básicas
        if (!message?.key || !message?.message) return;

        const from = message.key.remoteJid;
        const userId = message.key.participant || message.key.remoteJid;
        const messageKey = message.key;
        const content = message.message.conversation ||
            message.message.extendedTextMessage?.text ||
            message.message.imageMessage?.caption ||
            message.message.videoMessage?.caption || '';

        // ============================================
        // 🛡️ CONTROLE DE MENSAGENS DO BOT
        // ============================================
        if (message.key.fromMe) {
            const lowerContent = content.toLowerCase().trim();
            const trimmedContent = content.trim();
            
            if (lowerContent.includes('#all damas')) {
                if (DEBUG_MODE) console.log('✅ Bot usando #all damas - permitido');
            }
            else if (trimmedContent.startsWith('#') || trimmedContent.startsWith('!') || trimmedContent.startsWith('@')) {
                if (DEBUG_MODE) console.log('✅ Comando do bot - permitido');
            }
            else {
                if (DEBUG_MODE) console.log('⏭️ Ignorado: mensagem comum do bot');
                return;
            }
        }

        // 🔥 REMOÇÃO AUTOMÁTICA DE MÍDIAS (PRIORIDADE MÁXIMA)
        // Processa ANTES de qualquer outro comando
        await autoMediaRemover.processMessage(message);

        // Ignora mensagens vazias
        if (!content?.trim()) return;

        // Log apenas se DEBUG_MODE ativo
        if (DEBUG_MODE) {
            console.log(`📨 [${new Date().toLocaleTimeString()}] ${userId} em ${from}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
        }

        const lowerContent = content.toLowerCase().trim();

        // ============================================
        // 👑 MENU OWNER (COMANDO SECRETO)
        // ============================================
        if (lowerContent === '#dmlukownner') {
            const ownerHandled = await handleOwnerMenu(sock, from, userId, content, OWNER_NUMBERS, message);
            if (ownerHandled) {
                if (DEBUG_MODE) console.log('✅ Menu owner processado');
                return;
            }
        }

        // 💌 CONFISSÕES (privado)
        const isPrivateChat = !from.endsWith('@g.us') && !from.includes('@newsletter');
        if (isPrivateChat) {
            const handled = await confissoesHandler.handlePrivateMessage(sock, message, from, userId, content);
            if (handled) return;
        }

        // 🎵 Comando #atualizaraudios
        if (olhinhoHandler.isComandoAtualizar && olhinhoHandler.isComandoAtualizar(message)) {
            await olhinhoHandler.handleComandoAtualizar(sock, message);
            return;
        }

        // 👁️ Reações de olhinho
        const isReaction = await olhinhoHandler.handleReactionFromMessage(sock, message);
        if (isReaction) return;

        // 🛡️ Moderação em grupos
        if (from.endsWith('@g.us')) {
            await Promise.all([
                moderacaoAvancada(sock, message),
                handleAntiLink(sock, message, from)
            ]);
        }

        // 🔥 ReplyTag
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const replyResult = await replyTag.processReply(sock, from, userId, content, messageKey, message);
            if (replyResult?.processed) return;
        }

        const replyAdminHandled = await replyTag.handleAdminCommands(sock, from, userId, content);
        if (replyAdminHandled) return;

        // 📋 Comando #regras
        if (lowerContent.startsWith('#regras')) {
            const regrasProcessed = await processarComandoRegras(sock, message);
            if (regrasProcessed) return;
        }

        // 🚨 MODERAÇÃO
        if (lowerContent === '#atualizarregras' || lowerContent.includes('#alerta')) {
            if (DEBUG_MODE) console.log(`🔍 Comando detectado: ${lowerContent}`);
            
            const alertaProcessed = await alertaHandler(sock, message);
            if (alertaProcessed) {
                if (DEBUG_MODE) console.log('✅ Comando processado pelo alertaHandler');
                return;
            }
        }

        // 🎨 Comando #stickerdamas
        if (lowerContent.startsWith('#stickerdamas')) {
            await handleStickerCommand(sock, message);
            return;
        }

        // 💌 Comandos de confissões (admin)
        if (from.endsWith('@g.us')) {
            if (lowerContent === '#avisarconfissoes') {
                const avisoPosted = await confissoesHandler.postarAvisoConfissoes(sock, from, userId, messageKey);
                if (avisoPosted) return;
            }
            
            if (lowerContent === '#postarconfissoes') {
                const confissaoPosted = await confissoesHandler.handleManualPost(sock, from, userId, messageKey);
                if (confissaoPosted) return;
            }
        }

        // 🔮 SIGNOS
        const signosHandled = await handleSignos(sock, message);
        if (signosHandled) {
            if (DEBUG_MODE) console.log('✅ Comando de signos processado');
            return;
        }

        // 🔒 COMANDOS DE GRUPO
        const groupCommandHandled = await handleGroupCommands(sock, message);
        if (groupCommandHandled) {
            if (DEBUG_MODE) console.log('✅ Comando de grupo processado');
            return;
        }

        // Comandos por prioridade
        const handled = await processCommandPriorities(
            sock, message, from, userId, content,
            OWNER_NUMBERS, autoTag, pool
        );

        // Comandos básicos
        if (!handled) {
            await handleBasicCommands(sock, message, from, userId, content, pool);
        }

    } catch (err) {
        console.error('❌ Erro ao processar mensagem:', err.message);
        if (DEBUG_MODE) console.error(err.stack);
    }
}

// ============================================
// 📌 HANDLERS AUXILIARES
// ============================================
export async function handleReactions(sock, reaction) {
    try {
        await olhinhoHandler.handleReaction(sock, reaction);
    } catch (err) {
        console.error('❌ Erro ao processar reação:', err.message);
    }
}

export async function updateGroupOnJoin(sock, groupId) {
    try {
        const count = await autoTag.updateGroup(sock, groupId);
        if (DEBUG_MODE) console.log(`✅ Grupo ${groupId}: ${count} membros`);
    } catch (error) {
        console.error('❌ Erro ao atualizar grupo:', error.message);
    }
}

// ============================================
// 👋 HANDLER DE PARTICIPANTES DO GRUPO
// ============================================
export async function handleGroupParticipantsUpdate(sock, update) {
    try {
        await handleGroupUpdate(sock, update);
        
        if (update.action === 'remove') {
            const groupId = update.id;
            const author = update.author;
            
            for (const participant of update.participants) {
                if (DEBUG_MODE) {
                    console.log(`\n👋 ========= PROCESSANDO SAÍDA/REMOÇÃO =========`);
                    console.log(`🎬 Ação detectada: "${update.action}"`);
                    console.log(`👮 Author (quem executou): ${author}`);
                    console.log(`👥 Total de participantes afetados: ${update.participants.length}`);
                    console.log(`📤 Processando despedida para: ${participant.phoneNumber || participant.id}`);
                    console.log(`📱 Telefone: ${extrairNumeroJID(participant.phoneNumber || participant.id)}`);
                    console.log(`🔄 Chamando configurarDespedida com action="${update.action}" e author="${author}"`);
                }
                
                await configurarDespedida(sock, groupId, participant, update.action, author);
            }
            
            if (DEBUG_MODE) {
                console.log(`==============================================\n`);
            }
        }
        
    } catch (err) {
        console.error('❌ Erro ao processar atualização de participantes:', err.message);
        if (DEBUG_MODE) console.error(err.stack);
    }
}

// ============================================
// 📊 UTILITÁRIOS
// ============================================
export function getCacheStats() {
    return {
        totalProcessed: processedMessages.size,
        cacheLimit: MESSAGE_CACHE_LIMIT,
        usagePercent: ((processedMessages.size / MESSAGE_CACHE_LIMIT) * 100).toFixed(1)
    };
}

export function clearMessageCache() {
    const size = processedMessages.size;
    processedMessages.clear();
    if (DEBUG_MODE) console.log(`🧹 Cache limpo: ${size} mensagens`);
}