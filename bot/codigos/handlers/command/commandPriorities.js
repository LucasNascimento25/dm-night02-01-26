// commandPriorities.js - MÓDULO PRINCIPAL COMPACTO
import { handleOwnerMenu } from '../../features/menuOwner.js';
import { handleBanMessage } from '../../moderation/banHandler.js';
import { handleGroupCommands } from "../../utils/redefinirFecharGrupo.js";
import alertaHandler from '../../moderation/alertaHandler.js';
import { 
    handleSignosCommands,
    handleContosCommands,
    handleHQsCommands,
    handleMenuDamas,
    handleBlacklistGroup,
    handleVarreduraCommand,
    handleHoroscopoLegacy
} from './commandHandlers.js';

export async function processCommandPriorities(
    sock, message, from, userId, content,
    OWNER_NUMBERS, autoTag, pool
) {
    let handled = false;

    // 🚨 PRIORIDADE 0: #ALERTA
    if (!handled) {
        handled = await alertaHandler(sock, message);
        if (handled) return true;
    }

    // 👑 PRIORIDADE 1: MENU OWNER
    if (!handled) handled = await handleOwnerMenu(sock, from, userId, content, OWNER_NUMBERS);

    // 🔹 PRIORIDADE 2: BANIMENTO
    if (!handled && from.endsWith('@g.us')) await handleBanMessage(sock, message);

    // 🔹 PRIORIDADE 3: ADMIN GRUPO (#rlink, #closegp, #opengp)
    if (!handled) handled = await handleGroupCommands(sock, message);

    // 🔹 PRIORIDADE 4-5: AUTOTAG
    if (!handled && from.endsWith('@g.us')) {
        handled = await autoTag.handleAdminCommands(sock, from, userId, content);
        if (!handled) {
            const tagResult = await autoTag.processMessage(sock, from, userId, content, message.key, message);
            if (tagResult?.processed) return true;
        }
    }

    // 🌟 PRIORIDADES 6-12: OUTROS COMANDOS
    if (!handled) handled = await handleSignosCommands(sock, message, content, from);
    
    // ⚠️ CRÍTICO: HQs ANTES de Contos (evita conflito #random vs #randomhq)
    if (!handled) handled = await handleHQsCommands(sock, message, content);
    if (!handled) handled = await handleContosCommands(sock, message, content);
    
    if (!handled) handled = await handleMenuDamas(sock, message, content, from);
    if (!handled) handled = await handleBlacklistGroup(sock, from, userId, content, message);
    if (!handled) handled = await handleVarreduraCommand(sock, message, content, from, userId);
    if (!handled) handled = await handleHoroscopoLegacy(sock, message, content, from);

    return handled;
}