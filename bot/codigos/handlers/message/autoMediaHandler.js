// autoMediaHandler.js - VERSÃO CORRIGIDA E OTIMIZADA

import AutoMediaRemover from '../../features/autoMediaRemover.js';

/**
 * Handler para integrar o sistema de remoção automática de mídias
 * Gerencia comandos de configuração e estatísticas
 */
export default class AutoMediaHandler {
    constructor(sock, ownerNumber) {
        this.mediaRemover = new AutoMediaRemover(sock, ownerNumber);
        this.sock = sock;
        this.ownerNumber = ownerNumber;
        
        console.log('✅ AutoMediaHandler inicializado');
    }

    /**
     * Processa todas as mensagens recebidas
     * @param {Object} msg - Mensagem do WhatsApp
     */
    async handleMessage(msg) {
        try {
            await this.mediaRemover.processMessage(msg);
        } catch (error) {
            console.error('❌ Erro no AutoMediaHandler.handleMessage:', error.message);
        }
    }

    /**
     * Comandos de configuração (apenas para o dono)
     * @param {Object} msg - Mensagem original
     * @param {string} command - Comando sem prefixo
     * @param {Array} args - Argumentos do comando
     */
    async handleCommand(msg, command, args) {
        const { key } = msg;
        const senderId = key.participant || key.remoteJid;
        const chatId = key.remoteJid;

        // Verificar se é o dono
        if (senderId !== this.ownerNumber) {
            return false;
        }

        try {
            switch (command.toLowerCase()) {
                case 'mediaconfig':
                    await this.showConfig(chatId);
                    return true;

                case 'mediastats':
                    await this.showStats(chatId);
                    return true;

                case 'togglefotos':
                    this.mediaRemover.setRemovePhotos(!this.mediaRemover.config.removePhotos);
                    await this.sock.sendMessage(chatId, {
                        text: `✅ Remoção de fotos: ${this.mediaRemover.config.removePhotos ? 'ATIVADA ✅' : 'DESATIVADA ❌'}`
                    });
                    return true;

                case 'togglevideos':
                    this.mediaRemover.setRemoveVideos(!this.mediaRemover.config.removeVideos);
                    await this.sock.sendMessage(chatId, {
                        text: `✅ Remoção de vídeos: ${this.mediaRemover.config.removeVideos ? 'ATIVADA ✅' : 'DESATIVADA ❌'}`
                    });
                    return true;

                case 'togglenotify':
                    this.mediaRemover.setNotifyOwner(!this.mediaRemover.config.notifyOwner);
                    await this.sock.sendMessage(chatId, {
                        text: `✅ Notificações ao dono: ${this.mediaRemover.config.notifyOwner ? 'ATIVADAS ✅' : 'DESATIVADAS ❌'}`
                    });
                    return true;

                case 'debug':
                    if (args[0]) {
                        const value = args[0].toLowerCase() === 'on' || args[0] === '1' || args[0] === 'true';
                        this.mediaRemover.setDebugMode(value);
                        await this.sock.sendMessage(chatId, {
                            text: `🔍 *MODO DEBUG*\n\n` +
                                  `Status: ${value ? 'ATIVADO ✅' : 'DESATIVADO ❌'}\n\n` +
                                  `${value ? '📋 O bot mostrará TODA a estrutura das mensagens recebidas para análise.' : '✅ Modo normal restaurado.'}`
                        });
                    } else {
                        await this.sock.sendMessage(chatId, {
                            text: `❌ *Uso incorreto*\n\n` +
                                  `Comando: /debug [on|off]\n\n` +
                                  `Exemplos:\n` +
                                  `• /debug on\n` +
                                  `• /debug off`
                        });
                    }
                    return true;

                case 'setcaption':
                    if (args.length > 0) {
                        const newCaption = args.join(' ');
                        this.mediaRemover.setAllowedCaption(newCaption);
                        await this.sock.sendMessage(chatId, {
                            text: `✅ *LEGENDA ATUALIZADA*\n\n` +
                                  `Nova legenda permitida:\n` +
                                  `"${newCaption}"\n\n` +
                                  `⚠️ Apenas mídias com esta legenda EXATA (primeira linha) não serão removidas.`
                        });
                    } else {
                        await this.sock.sendMessage(chatId, {
                            text: `❌ *Uso incorreto*\n\n` +
                                  `Comando: /setcaption [nova legenda]\n\n` +
                                  `Exemplo:\n` +
                                  `/setcaption 👏🍻 DAMAS 💃🔥`
                        });
                    }
                    return true;

                case 'getcaption':
                    const caption = this.mediaRemover.getAllowedCaption();
                    await this.sock.sendMessage(chatId, {
                        text: `📋 *LEGENDA PERMITIDA ATUAL*\n\n` +
                              `"${caption}"\n\n` +
                              `💡 Use /setcaption para alterar`
                    });
                    return true;

                case 'setdelay':
                    if (args[0] && !isNaN(args[0])) {
                        const delay = parseInt(args[0]);
                        if (delay < 0 || delay > 10000) {
                            await this.sock.sendMessage(chatId, {
                                text: `❌ Delay inválido! Use valor entre 0 e 10000ms`
                            });
                            return true;
                        }
                        this.mediaRemover.setDeleteDelay(delay);
                        await this.sock.sendMessage(chatId, {
                            text: `✅ *DELAY ATUALIZADO*\n\n` +
                                  `Novo delay de deleção: ${delay}ms\n\n` +
                                  `⏱️ O bot aguardará ${delay}ms antes de remover cada mídia.`
                        });
                    } else {
                        await this.sock.sendMessage(chatId, {
                            text: `❌ *Uso incorreto*\n\n` +
                                  `Comando: /setdelay [milissegundos]\n\n` +
                                  `Exemplo:\n` +
                                  `/setdelay 2000\n\n` +
                                  `⚠️ Valores aceitos: 0 a 10000ms`
                        });
                    }
                    return true;

                case 'addwhitelist':
                    if (chatId.endsWith('@g.us')) {
                        this.mediaRemover.addWhitelistGroup(chatId);
                        await this.sock.sendMessage(chatId, {
                            text: `✅ *GRUPO ADICIONADO À WHITELIST*\n\n` +
                                  `🔓 Mídias não serão mais removidas neste grupo.\n\n` +
                                  `Use /removewhitelist para reverter.`
                        });
                    } else {
                        await this.sock.sendMessage(chatId, {
                            text: `❌ Este comando só funciona em grupos!`
                        });
                    }
                    return true;

                case 'removewhitelist':
                    if (chatId.endsWith('@g.us')) {
                        this.mediaRemover.removeWhitelistGroup(chatId);
                        await this.sock.sendMessage(chatId, {
                            text: `✅ *GRUPO REMOVIDO DA WHITELIST*\n\n` +
                                  `🔒 Mídias voltarão a ser removidas neste grupo.\n\n` +
                                  `Use /addwhitelist para adicionar novamente.`
                        });
                    } else {
                        await this.sock.sendMessage(chatId, {
                            text: `❌ Este comando só funciona em grupos!`
                        });
                    }
                    return true;

                case 'whitelist':
                    await this.showWhitelist(chatId);
                    return true;

                case 'resetstats':
                    this.mediaRemover.resetStats();
                    await this.sock.sendMessage(chatId, {
                        text: `✅ *ESTATÍSTICAS RESETADAS*\n\n` +
                              `📊 Contadores zerados com sucesso!\n\n` +
                              `Use /mediastats para ver estatísticas atualizadas.`
                    });
                    return true;

                default:
                    return false;
            }
        } catch (error) {
            console.error(`❌ Erro ao processar comando ${command}:`, error.message);
            await this.sock.sendMessage(chatId, {
                text: `❌ Erro ao executar comando: ${error.message}`
            });
            return true;
        }
    }

    /**
     * Mostra configuração atual
     */
    async showConfig(chatId) {
        try {
            const config = this.mediaRemover.getConfig();
            
            let text = `⚙️ *CONFIGURAÇÃO DO AUTO REMOVER*\n\n`;
            
            for (const [key, value] of Object.entries(config)) {
                text += `${key}: ${value}\n`;
            }
            
            text += `\n📋 *COMANDOS DISPONÍVEIS:*\n\n`;
            text += `*Configuração:*\n`;
            text += `• /mediaconfig - Ver configurações\n`;
            text += `• /mediastats - Ver estatísticas\n`;
            text += `• /resetstats - Resetar estatísticas\n\n`;
            
            text += `*Toggle (Liga/Desliga):*\n`;
            text += `• /togglefotos - Remoção de fotos\n`;
            text += `• /togglevideos - Remoção de vídeos\n`;
            text += `• /togglenotify - Notificações ao dono\n\n`;
            
            text += `*Legendas:*\n`;
            text += `• /setcaption [texto] - Define legenda permitida\n`;
            text += `• /getcaption - Ver legenda atual\n\n`;
            
            text += `*Whitelist:*\n`;
            text += `• /addwhitelist - Adiciona grupo atual\n`;
            text += `• /removewhitelist - Remove grupo atual\n`;
            text += `• /whitelist - Lista todos os grupos\n\n`;
            
            text += `*Avançado:*\n`;
            text += `• /debug on|off - Modo debug\n`;
            text += `• /setdelay [ms] - Delay de deleção\n\n`;
            
            text += `⚠️ *Apenas o dono pode usar estes comandos*`;

            await this.sock.sendMessage(chatId, { text });
        } catch (error) {
            console.error('❌ Erro ao mostrar config:', error.message);
            await this.sock.sendMessage(chatId, {
                text: `❌ Erro ao buscar configurações: ${error.message}`
            });
        }
    }

    /**
     * Mostra estatísticas
     */
    async showStats(chatId) {
        try {
            const stats = this.mediaRemover.getStats();
            
            let text = `📊 *ESTATÍSTICAS DO AUTO REMOVER*\n\n`;
            
            for (const [key, value] of Object.entries(stats)) {
                text += `${key}: ${value}\n`;
            }
            
            text += `\n⏰ Última atualização: ${new Date().toLocaleString('pt-BR')}\n`;
            text += `\n💡 Use /resetstats para zerar os contadores`;

            await this.sock.sendMessage(chatId, { text });
        } catch (error) {
            console.error('❌ Erro ao mostrar stats:', error.message);
            await this.sock.sendMessage(chatId, {
                text: `❌ Erro ao buscar estatísticas: ${error.message}`
            });
        }
    }

    /**
     * Mostra grupos na whitelist
     */
    async showWhitelist(chatId) {
        try {
            const whitelist = this.mediaRemover.config.whitelistGroups;
            
            if (whitelist.length === 0) {
                await this.sock.sendMessage(chatId, {
                    text: `📋 *WHITELIST VAZIA*\n\n` +
                          `Nenhum grupo está na whitelist.\n\n` +
                          `Use /addwhitelist em um grupo para adicioná-lo.`
                });
                return;
            }

            let text = `📋 *GRUPOS NA WHITELIST*\n`;
            text += `Total: ${whitelist.length} grupo${whitelist.length > 1 ? 's' : ''}\n\n`;
            
            for (let i = 0; i < whitelist.length; i++) {
                const groupId = whitelist[i];
                try {
                    const metadata = await this.sock.groupMetadata(groupId);
                    text += `${i + 1}. ✅ *${metadata.subject}*\n`;
                    text += `   👥 ${metadata.participants.length} membros\n`;
                    text += `   🆔 ${groupId}\n\n`;
                } catch (error) {
                    text += `${i + 1}. ❓ *Grupo Desconhecido*\n`;
                    text += `   🆔 ${groupId}\n`;
                    text += `   ⚠️ Erro ao buscar informações\n\n`;
                }
            }
            
            text += `💡 Use /addwhitelist ou /removewhitelist em um grupo para gerenciar`;

            await this.sock.sendMessage(chatId, { text });
        } catch (error) {
            console.error('❌ Erro ao mostrar whitelist:', error.message);
            await this.sock.sendMessage(chatId, {
                text: `❌ Erro ao buscar whitelist: ${error.message}`
            });
        }
    }

    /**
     * Retorna a instância do AutoMediaRemover
     * @returns {AutoMediaRemover}
     */
    getMediaRemover() {
        return this.mediaRemover;
    }

    /**
     * Verifica se um comando é de mídia
     * @param {string} command - Comando para verificar
     * @returns {boolean}
     */
    isMediaCommand(command) {
        const mediaCommands = [
            'mediaconfig', 'mediastats', 'togglefotos', 'togglevideos',
            'togglenotify', 'debug', 'setcaption', 'getcaption',
            'setdelay', 'addwhitelist', 'removewhitelist', 'whitelist',
            'resetstats'
        ];
        return mediaCommands.includes(command.toLowerCase());
    }
}