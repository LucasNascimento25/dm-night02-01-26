//autoMediaHandler.js

import AutoMediaRemover from '../../features/autoMediaRemover.js';

/**
 * Handler para integrar o sistema de remoção automática de mídias
 */
export default class AutoMediaHandler {
    constructor(sock, ownerNumber) {
        this.mediaRemover = new AutoMediaRemover(sock, ownerNumber);
        this.sock = sock;
        this.ownerNumber = ownerNumber;
    }

    /**
     * Processa todas as mensagens recebidas
     */
    async handleMessage(msg) {
        // Processar remoção automática
        await this.mediaRemover.processMessage(msg);
    }

    /**
     * Comandos de configuração (apenas para o dono)
     */
    async handleCommand(msg, command, args) {
        const { key } = msg;
        const senderId = key.participant || key.remoteJid;
        const chatId = key.remoteJid;

        // Verificar se é o dono
        if (senderId !== this.ownerNumber) {
            return;
        }

        switch (command) {
            case 'mediaconfig':
                await this.showConfig(chatId);
                break;

            case 'togglefotos':
                this.mediaRemover.config.removePhotos = !this.mediaRemover.config.removePhotos;
                await this.sock.sendMessage(chatId, {
                    text: `✅ Remoção de fotos: ${this.mediaRemover.config.removePhotos ? 'ATIVADA' : 'DESATIVADA'}`
                });
                break;

            case 'togglevideos':
                this.mediaRemover.config.removeVideos = !this.mediaRemover.config.removeVideos;
                await this.sock.sendMessage(chatId, {
                    text: `✅ Remoção de vídeos: ${this.mediaRemover.config.removeVideos ? 'ATIVADA' : 'DESATIVADA'}`
                });
                break;

            case 'togglestickers':
                this.mediaRemover.config.checkStickers = !this.mediaRemover.config.checkStickers;
                await this.sock.sendMessage(chatId, {
                    text: `✅ Verificação de stickers: ${this.mediaRemover.config.checkStickers ? 'ATIVADA' : 'DESATIVADA'}`
                });
                break;

            case 'exemptadmins':
                this.mediaRemover.config.exemptAdmins = !this.mediaRemover.config.exemptAdmins;
                await this.sock.sendMessage(chatId, {
                    text: `✅ Isenção para admins: ${this.mediaRemover.config.exemptAdmins ? 'ATIVADA' : 'DESATIVADA'}`
                });
                break;

            case 'addwhitelist':
                if (chatId.endsWith('@g.us')) {
                    this.mediaRemover.addToWhitelist(chatId);
                    await this.sock.sendMessage(chatId, {
                        text: '✅ Este grupo foi adicionado à whitelist. Mídias não serão removidas aqui.'
                    });
                }
                break;

            case 'removewhitelist':
                if (chatId.endsWith('@g.us')) {
                    this.mediaRemover.removeFromWhitelist(chatId);
                    await this.sock.sendMessage(chatId, {
                        text: '✅ Este grupo foi removido da whitelist. Mídias serão removidas novamente.'
                    });
                }
                break;

            case 'whitelist':
                await this.showWhitelist(chatId);
                break;
        }
    }

    /**
     * Mostra configuração atual
     */
    async showConfig(chatId) {
        const config = this.mediaRemover.config;
        
        let text = `⚙️ *CONFIGURAÇÃO ATUAL*\n\n`;
        text += `📸 Remover fotos: ${config.removePhotos ? '✅' : '❌'}\n`;
        text += `🎥 Remover vídeos: ${config.removeVideos ? '✅' : '❌'}\n`;
        text += `🎭 Verificar stickers: ${config.checkStickers ? '✅' : '❌'}\n`;
        text += `👮 Isentar admins: ${config.exemptAdmins ? '✅' : '❌'}\n`;
        text += `🔔 Notificar dono: ${config.notifyOwner ? '✅' : '❌'}\n`;
        text += `📋 Grupos na whitelist: ${config.whitelistGroups.length}\n\n`;
        text += `*COMANDOS DISPONÍVEIS:*\n`;
        text += `• /togglefotos - Liga/desliga remoção de fotos\n`;
        text += `• /togglevideos - Liga/desliga remoção de vídeos\n`;
        text += `• /togglestickers - Liga/desliga verificação de stickers\n`;
        text += `• /exemptadmins - Liga/desliga isenção para admins\n`;
        text += `• /addwhitelist - Adiciona grupo atual à whitelist\n`;
        text += `• /removewhitelist - Remove grupo atual da whitelist\n`;
        text += `• /whitelist - Lista grupos na whitelist`;

        await this.sock.sendMessage(chatId, { text });
    }

    /**
     * Mostra grupos na whitelist
     */
    async showWhitelist(chatId) {
        const whitelist = this.mediaRemover.config.whitelistGroups;
        
        if (whitelist.length === 0) {
            await this.sock.sendMessage(chatId, {
                text: '📋 Nenhum grupo na whitelist.'
            });
            return;
        }

        let text = `📋 *GRUPOS NA WHITELIST*\n\n`;
        
        for (const groupId of whitelist) {
            try {
                const metadata = await this.sock.groupMetadata(groupId);
                text += `• ${metadata.subject}\n`;
            } catch (error) {
                text += `• ${groupId}\n`;
            }
        }

        await this.sock.sendMessage(chatId, { text });
    }
}