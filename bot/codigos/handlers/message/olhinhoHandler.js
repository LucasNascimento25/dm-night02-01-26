// codigos/handlers/message/olhinhoHandler.js
// Handler para detectar e avisar quando alguém coloca reação de olhinho

export class OlhinhoHandler {
    constructor() {
        this.olhinhoEmojis = ['👁️', '👁', '👀'];
        this.processedReactions = new Set();
    }

    /**
     * Verifica se o usuário é admin do grupo
     * @param {Object} sock - Socket do Baileys
     * @param {string} groupId - ID do grupo
     * @param {string} userId - ID do usuário
     * @returns {Promise<boolean>}
     */
    async isAdmin(sock, groupId, userId) {
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            return participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (error) {
            console.error('Erro ao verificar admin:', error);
            return false;
        }
    }

    /**
     * Detecta se uma mensagem contém emoji de olho (em qualquer lugar)
     * @param {Object} message - Mensagem do Baileys
     * @returns {boolean}
     */
    isReactionMessage(message) {
        const content = message.message?.conversation || '';
        return this.olhinhoEmojis.some(emoji => content.includes(emoji));
    }

    /**
     * Processa reação detectada em mensagem normal
     * @param {Object} sock - Socket do Baileys
     * @param {Object} message - Mensagem completa
     */
    async handleReactionFromMessage(sock, message) {
        try {
            if (!message?.key) return false;

            const from = message.key.remoteJid;
            const userId = message.key.participant || message.key.remoteJid;
            const content = message.message?.conversation || '';

            // Verifica se é grupo e se tem emoji de olhinho (em qualquer lugar do texto)
            if (!from.endsWith('@g.us')) return false;
            if (!this.olhinhoEmojis.some(emoji => content.includes(emoji))) return false;

            // Cria chave única para evitar duplicatas
            const reactionKey = `${from}_${message.key.id}_${userId}_${content}`;
            
            if (this.processedReactions.has(reactionKey)) return true;

            // Marca como processada
            this.processedReactions.add(reactionKey);

            // Limpa após 5 minutos
            setTimeout(() => {
                this.processedReactions.delete(reactionKey);
            }, 5 * 60 * 1000);

            // Não responde se for o próprio bot
            if (message.key.fromMe || userId === sock.user?.id) return true;

            // Verifica se é admin
            const isUserAdmin = await this.isAdmin(sock, from, userId);
            const userNumber = userId.split('@')[0];

            let responseText;
            
            if (isUserAdmin) {
                // Mensagem para admins
                responseText = `👀👑 *Eita! Admin colocando olhinho!* 😏\n\n` +
                             `Não pense que vai escapar dessa não, chefe! 🤨\n` +
                             `Admin também tem que participar! 📸\n\n` +
                             `Se não mandar foto agora, paga miquinho! 🐒\n\n` +
                             `*Escolha seu mico:*\n` +
                             `🐔🗣️ Imitar uma galinha\n` +
                             `🦆🎶 Imitar um pato\n` +
                             `🐒🙉 Imitar um macaco\n` +
                             `🐐😆 Imitar um bode\n` +
                             `🐷🐽 Imitar um porco\n` +
                             `🎤🎵 Cantar uma música\n\n` +
                             `*Admin é exemplo, bora lá!* 💪👑✨`;
            } else {
                // Mensagem para membros normais
                responseText = `👀✨ *Opa! Olhinho detectado, cadê o rostinho?* 📸😏\n\n` +
                             `Se não mandar foto agora, paga miquinho! 🐒\n\n` +
                             `*Escolha seu mico:*\n` +
                             `🐔🗣️ Imitar uma galinha\n` +
                             `🦆🎶 Imitar um pato\n` +
                             `🐒🙉 Imitar um macaco\n` +
                             `🐐😆 Imitar um bode\n` +
                             `🐷🐽 Imitar um porco\n` +
                             `🎤🎵 Cantar uma música\n\n` +
                             `*Tá geral esperando, não vacila!* ⏰👁️‍🗨️👂😏`;
            }

            // Responde a mensagem com citação
            await sock.sendMessage(from, {
                text: responseText,
            }, {
                quoted: message
            });

            const adminTag = isUserAdmin ? '👑 ADMIN' : '';
            console.log(`👁️ Olhinho detectado de ${userNumber} ${adminTag} em ${from}`);
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao processar reação de olhinho:', error);
            return false;
        }
    }

    /**
     * Processa reações via evento messages.reaction
     * @param {Object} sock - Instância do socket Baileys
     * @param {Object} reaction - Objeto de reação
     */
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

                    setTimeout(() => {
                        this.processedReactions.delete(reactionKey);
                    }, 5 * 60 * 1000);

                    // Verifica se é admin
                    const isUserAdmin = await this.isAdmin(sock, from, userId);
                    const userNumber = userId.split('@')[0];

                    let responseText;
                    
                    if (isUserAdmin) {
                        // Mensagem para admins
                        responseText = `👀👑 *Eita! Admin colocando olhinho!* 😏\n\n` +
                                     `Não pense que vai escapar dessa não, admin! 🤨\n` +
                                     `Você também tem que participar! 📸\n\n` +
                                     `Se mandou olhinho, manda fotinha! 🫵✨\n` +
                                     `Admin é exemplo, bora lá! 💪😎`;
                    } else {
                        // Mensagem para membros normais
                        responseText = `👀✨ *Opa! Olhinho detectado, cadê o rostinho?* 📸😏\n\n` +
                                     `Se não mandar foto agora, paga miquinho! 🐒\n\n` +
                                     `*Escolha seu mico:*\n` +
                                     `🐔🗣️ Imitar uma galinha\n` +
                                     `🦆🎶 Imitar um pato\n` +
                                     `🐒🙉 Imitar um macaco\n` +
                                     `🐐😆 Imitar um bode\n` +
                                     `🐷🐽 Imitar um porco\n` +
                                     `🎤🎵 Cantar uma música\n\n` +
                                     `*Tá geral esperando, não vacila!* ⏰👁️‍🗨️👂😏`;
                    }

                    // Busca a mensagem original para fazer quote
                    await sock.sendMessage(from, {
                        text: responseText,
                    }, {
                        quoted: {
                            key: react.key,
                            message: reaction.message || {}
                        }
                    });

                    const adminTag = isUserAdmin ? '👑 ADMIN' : '';
                    console.log(`👁️ Olhinho detectado de ${userNumber} ${adminTag} em ${from}`);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao processar reação de olhinho:', error);
        }
    }

    clearCache() {
        this.processedReactions.clear();
    }
}

export default new OlhinhoHandler();