// Função principal para gerenciar mensagens de banimento
export async function handleBanMessage(c, message) {
    try {
        const { key, message: msg } = message;
        const from = key.remoteJid; // Identificador do grupo
        const sender = key.participant || key.remoteJid; // Identificador do remetente

        const botId = c.user.id; // ID do bot
        const groupMetadata = await c.groupMetadata(from);

        // Verificar PRIMEIRO se é realmente um comando #ban
        let isBanCommand = false;

        // Verificação de imagem com #ban
        if (msg?.imageMessage?.caption?.includes('#ban')) {
            isBanCommand = true;
        }

        // Verificação de texto estendido com #ban (resposta/quote)
        if (msg?.extendedTextMessage?.text?.includes('#ban') && 
            msg?.extendedTextMessage?.contextInfo?.participant) {
            isBanCommand = true;
        }

        // Verificação de mensagem de texto
        const messageContent = msg?.conversation || msg?.extendedTextMessage?.text;
        
        if (messageContent) {
            // Verifica se começa com #ban @ ou @algo #ban
            if (/^#ban\s+@/.test(messageContent) || /^@[^\s]+\s+#ban/.test(messageContent)) {
                isBanCommand = true;
            }
        }

        // Se NÃO for comando #ban, sai da função sem fazer nada
        if (!isBanCommand) {
            return;
        }

        // AGORA SIM verificar se é admin (apenas para comandos #ban)
        const isAdmin = groupMetadata.participants.some(
            participant => participant.id === sender && participant.admin
        );

        if (!isAdmin) {
            await c.sendMessage(from, {
                text: '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\n❌ *Acesso Negado!*\n\n⚠️ Somente *administradores* podem executar este comando.'
            });
            console.log('Ação não permitida, o remetente não é um administrador.');
            return;
        }

        // Deletar a mensagem do comando usando o mesmo método do antilink
        await deleteCommandMessage(c, from, key);

        // Processar comando #ban com imagem
        if (msg?.imageMessage) {
            const imageCaption = msg.imageMessage.caption;

            if (imageCaption?.includes('#ban')) {
                const imageSender = msg.imageMessage.context?.participant;
                if (imageSender && imageSender !== botId) {
                    await executeBanUser(c, from, imageSender, groupMetadata);
                    return;
                }
            }
        }

        // Processar comando #ban em resposta/quote
        if (msg?.extendedTextMessage) {
            const commentText = msg.extendedTextMessage.text;

            if (commentText?.includes('#ban')) {
                const quotedMessage = msg.extendedTextMessage.contextInfo;
                const imageSender = quotedMessage?.participant;
                if (imageSender && imageSender !== botId) {
                    await executeBanUser(c, from, imageSender, groupMetadata);
                    return;
                }
            }
        }

        // Processar comando #ban com menção
        if (messageContent) {
            // Padrão 1: #ban @nome ou #ban @numero
            const pattern1 = /^#ban\s+@([^\s]+)/;
            const match1 = messageContent.match(pattern1);
            
            if (match1) {
                const mentionedUserName = match1[1].trim().toLowerCase();
                const userToBan = groupMetadata.participants.find(p =>
                    p.id.toLowerCase().includes(mentionedUserName.replace(/ /g, ''))
                );

                if (userToBan && userToBan.id !== botId) {
                    await executeBanUser(c, from, userToBan.id, groupMetadata);
                }
                return;
            }

            // Padrão 2: @nome #ban ou @numero #ban
            const pattern2 = /^@([^\s]+)\s+#ban/;
            const match2 = messageContent.match(pattern2);
            
            if (match2) {
                const mentionedUserName = match2[1].trim().toLowerCase();
                const userToBan = groupMetadata.participants.find(p =>
                    p.id.toLowerCase().includes(mentionedUserName)
                );

                if (userToBan && userToBan.id !== botId) {
                    await executeBanUser(c, from, userToBan.id, groupMetadata);
                }
                return;
            }
        }
    } catch (error) {
        console.error('Erro ao processar a mensagem:', error);
    }
}

// Função para deletar mensagem com múltiplas tentativas (baseada no antilink)
const deleteCommandMessage = async (sock, groupId, messageKey) => {
    const delays = [0, 100, 500, 1000, 2000, 5000];
    
    for (let i = 0; i < delays.length; i++) {
        try {
            if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
            
            const key = {
                remoteJid: messageKey.remoteJid || groupId,
                fromMe: false,
                id: messageKey.id,
                participant: messageKey.participant
            };
            
            await sock.sendMessage(groupId, { delete: key });
            console.log(`✅ Comando #ban deletado (tentativa ${i + 1})`);
            return true;
        } catch (error) {
            console.log(`❌ Tentativa ${i + 1} de deletar comando falhou`);
        }
    }
    return false;
};

// Função auxiliar para executar banimento de usuário
async function executeBanUser(c, groupId, userId, groupMetadata) {
    try {
        // Verificar se o usuário a ser banido é administrador
        const isUserAdmin = groupMetadata.participants.some(
            participant => participant.id === userId && participant.admin
        );

        if (isUserAdmin) {
            // Obter o nome/número do usuário
            const userNumber = userId.split('@')[0];
            const userName = groupMetadata.participants.find(p => p.id === userId)?.notify || userNumber;
            
            await c.sendMessage(groupId, {
                text: `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\n⚠️ *Ação não permitida!*\n\n❌ Não é possível remover @${userName} pois é *administrador* do grupo.`,
                mentions: [userId]
            });
            console.log('O usuário é administrador e não pode ser banido.');
            return;
        }

        await c.groupParticipantsUpdate(groupId, [userId], 'remove');
        console.log(`Usuário ${userId} removido com sucesso.`);
    } catch (error) {
        console.error('Erro ao banir usuário:', error);
    }
}