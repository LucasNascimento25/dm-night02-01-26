// alertaHandler.js - Sistema de Moderação com #alerta

/**
 * Função robusta para deletar mensagem (igual ao antilink)
 */
async function deleteMessage(sock, groupId, messageKey) {
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
            console.log(`✅ Mensagem deletada (tentativa ${i + 1})`);
            return true;
        } catch (error) {
            console.log(`❌ Tentativa ${i + 1} falhou:`, error.message);
        }
    }
    return false;
}

/**
 * Extrai apenas os dígitos do número (adaptado de blacklistFunctions.js)
 */
function extractDigits(number) {
    // Remove tudo que não é dígito
    let digits = number.replace(/@.*$/, '').replace(/\D/g, '');
    
    // Adiciona 55 se for número brasileiro de 11 dígitos sem código de país
    if (digits.length === 11 && !digits.startsWith('55')) {
        digits = '55' + digits;
    }
    
    return digits;
}

/**
 * 🔥 Resolve LID para número real usando múltiplos métodos
 */
async function resolverNumeroReal(sock, senderJid, chatJid) {
    try {
        // Método 1: Se não é LID, retorna direto
        if (!senderJid.includes('@lid')) {
            console.log('✅ Não é LID, usando JID original:', senderJid);
            return senderJid;
        }

        console.log('🔍 Detectado LID, tentando resolver:', senderJid);

        // Método 2: Tenta buscar nos metadados do grupo
        if (chatJid.includes('@g.us')) {
            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                
                // Busca o participante pelo LID
                const participant = groupMetadata.participants.find(p => p.id === senderJid);
                
                if (participant) {
                    console.log('📋 Participante encontrado:', JSON.stringify(participant, null, 2));
                    
                    // 🔥 PRIORIDADE: Campo phoneNumber (onde está o número REAL!)
                    if (participant.phoneNumber) {
                        console.log('✅ Número real via phoneNumber:', participant.phoneNumber);
                        return participant.phoneNumber;
                    }
                    
                    // Tenta diferentes campos onde o número real pode estar
                    if (participant.jid) {
                        console.log('✅ Número real via jid:', participant.jid);
                        return participant.jid;
                    }
                    
                    if (participant.notify) {
                        console.log('✅ Número real via notify:', participant.notify);
                        return participant.notify;
                    }
                    
                    if (participant.phone) {
                        const phoneJid = participant.phone + '@s.whatsapp.net';
                        console.log('✅ Número real via phone:', phoneJid);
                        return phoneJid;
                    }
                }
            } catch (err) {
                console.error('❌ Erro ao buscar metadados:', err.message);
            }
        }

        // Método 3: Tenta usar store (se disponível)
        if (sock.store?.contacts?.[senderJid]) {
            const contact = sock.store.contacts[senderJid];
            if (contact.notify || contact.name) {
                console.log('✅ Número via store:', contact);
                return contact.id || senderJid;
            }
        }

        // Método 4: Tenta extrair do próprio LID (alguns casos)
        const lidMatch = senderJid.match(/^(\d+)@lid$/);
        if (lidMatch) {
            const possibleJid = lidMatch[1] + '@s.whatsapp.net';
            console.log('🔄 Tentando JID construído:', possibleJid);
            return possibleJid;
        }

        console.log('⚠️ Não foi possível resolver LID, usando original');
        return senderJid;

    } catch (error) {
        console.error('❌ Erro em resolverNumeroReal:', error);
        return senderJid;
    }
}

/**
 * Verifica se usuário é administrador do grupo
 */
async function verificarAdmin(sock, message) {
    try {
        const senderJid = message.key.participant || message.key.remoteJid;
        const chatJid = message.key.remoteJid;
        
        // Verifica se é um grupo
        if (!chatJid.includes('@g.us')) {
            console.log('⚠️ Não é um grupo');
            return false;
        }
        
        // Resolve o número real (lidando com LID)
        const numeroReal = await resolverNumeroReal(sock, senderJid, chatJid);
        
        // Busca metadados do grupo
        const groupMetadata = await sock.groupMetadata(chatJid);
        
        // Procura o participante na lista
        const participant = groupMetadata.participants.find(p => {
            const participantNumber = extractDigits(p.id);
            const senderNumber = extractDigits(numeroReal);
            return participantNumber === senderNumber;
        });
        
        const isAdmin = participant ? (participant.admin === 'admin' || participant.admin === 'superadmin') : false;
        
        console.log('🔍 ========= Verificando Admin (Alerta) =========');
        console.log('📥 Remetente JID original:', senderJid);
        console.log('📥 Número real resolvido:', numeroReal);
        console.log('📥 Chat JID:', chatJid);
        console.log('👤 Participante encontrado:', participant ? 'Sim' : 'Não');
        console.log('🔐 Tipo de admin:', participant?.admin || 'Não é admin');
        console.log('🎯 É admin?', isAdmin);
        console.log('=================================================\n');
        
        return isAdmin;
        
    } catch (err) {
        console.error('❌ Erro em verificarAdmin:', err);
        return false;
    }
}

/**
 * Handler principal do comando #alerta
 */
const alertaHandler = async (sock, message) => {
    try {
        const { key, message: msg } = message;
        const from = key.remoteJid; // ID do grupo
        const sender = key.participant || key.remoteJid; // ID do remetente

        // Verificar PRIMEIRO se é realmente um comando #alerta
        let isAlertaCommand = false;

        // Verificação de imagem com #alerta
        if (msg?.imageMessage?.caption?.includes('#alerta')) {
            isAlertaCommand = true;
        }

        // Verificação de vídeo com #alerta
        if (msg?.videoMessage?.caption?.includes('#alerta')) {
            isAlertaCommand = true;
        }

        // Verificação de figurinha/sticker com #alerta (respondendo)
        if (msg?.stickerMessage && msg?.extendedTextMessage?.text?.includes('#alerta')) {
            isAlertaCommand = true;
        }

        // Verificação de áudio com #alerta (respondendo)
        if (msg?.audioMessage && msg?.extendedTextMessage?.text?.includes('#alerta')) {
            isAlertaCommand = true;
        }

        // Verificação de documento com #alerta
        if (msg?.documentMessage?.caption?.includes('#alerta')) {
            isAlertaCommand = true;
        }

        // Verificação de texto estendido com #alerta (resposta/quote)
        if (msg?.extendedTextMessage?.text?.includes('#alerta')) {
            isAlertaCommand = true;
        }

        // Verificação de mensagem de texto simples
        if (msg?.conversation?.includes('#alerta')) {
            isAlertaCommand = true;
        }

        // Se NÃO for comando #alerta, sai da função sem fazer nada
        if (!isAlertaCommand) {
            return false;
        }

        console.log('\n🚨 ========= COMANDO #ALERTA DETECTADO =========');
        console.log('📱 Grupo:', from);
        console.log('👤 Admin:', sender);
        console.log('================================================\n');

        // Verifica se é um grupo
        if (!from.includes('@g.us')) {
            await sock.sendMessage(from, { 
                text: '⚠️ Este comando só funciona em grupos!' 
            }, { quoted: message });
            return true;
        }

        // Busca informações do grupo
        const groupMetadata = await sock.groupMetadata(from);

        // Verifica se quem enviou é administrador
        const isAdmin = groupMetadata.participants.some(
            participant => participant.id === sender && participant.admin
        );

        if (!isAdmin) {
            await sock.sendMessage(from, { 
                text: '🚫 *Ops!* 😅\n\n' +
                      '👮‍♀️ Somente *administradores do grupo* podem usar este comando! 💪'
            }, { quoted: message });
            console.log('❌ Ação não permitida, o remetente não é um administrador.');
            return true;
        }

        // Variável para armazenar a mensagem a ser deletada
        let targetMessageId = null;
        let targetParticipant = null;

        // Processar comando #alerta em imagem
        if (msg?.imageMessage?.caption?.includes('#alerta')) {
            const imageContext = msg.imageMessage.contextInfo;
            if (imageContext?.stanzaId && imageContext?.participant) {
                targetMessageId = imageContext.stanzaId;
                targetParticipant = imageContext.participant;
            }
        }

        // Processar comando #alerta em vídeo
        if (msg?.videoMessage?.caption?.includes('#alerta')) {
            const videoContext = msg.videoMessage.contextInfo;
            if (videoContext?.stanzaId && videoContext?.participant) {
                targetMessageId = videoContext.stanzaId;
                targetParticipant = videoContext.participant;
            }
        }

        // Processar comando #alerta em documento
        if (msg?.documentMessage?.caption?.includes('#alerta')) {
            const docContext = msg.documentMessage.contextInfo;
            if (docContext?.stanzaId && docContext?.participant) {
                targetMessageId = docContext.stanzaId;
                targetParticipant = docContext.participant;
            }
        }

        // Processar comando #alerta em resposta/quote (PRINCIPAL)
        // Este é o mais comum: admin responde qualquer tipo de mensagem com #alerta
        if (msg?.extendedTextMessage?.text?.includes('#alerta')) {
            const quotedContext = msg.extendedTextMessage.contextInfo;
            if (quotedContext?.stanzaId && quotedContext?.participant) {
                targetMessageId = quotedContext.stanzaId;
                targetParticipant = quotedContext.participant;
            }
        }

        // 🔥 NOVA FUNCIONALIDADE: Se não há mensagem citada, mostra regras para TODOS
        if (!targetMessageId || !targetParticipant) {
            console.log('📢 Nenhuma mensagem citada - enviando regras para todos do grupo');
            
            // 🗑️ Remove a mensagem do admin com #alerta
            try {
                const adminKeyToDelete = {
                    remoteJid: from,
                    id: key.id,
                    participant: sender
                };
                await deleteMessage(sock, from, adminKeyToDelete);
                console.log('✅ Mensagem do admin (#alerta) removida');
            } catch (err) {
                console.log('⚠️ Não foi possível remover mensagem do admin:', err.message);
            }

            // Gera lista de menções (todos exceto o bot)
            const mentions = groupMetadata.participants
                .filter(p => !p.id.includes(':')) // Remove IDs inválidos
                .map(p => p.id);

            // Envia regras marcando todos
            await sock.sendMessage(from, {
                text: '📢 *ATENÇÃO GERAL*\n📌📜 *REGRAS DO GRUPO (ESSENCIAIS)* 📌 \n\n' +
                      '┍─━──━─┙💃┕─━──━─┑\n' +
                   '*1️⃣ Conteúdo permitido e proibido:*\n' +
                    '🚷 É *proibido* enviar figurinhas, imagens, vídeos ou qualquer outro tipo de conteúdo com crianças, bem como qualquer material que envolva pedofilia, zoofilia, violência, drogas, armas ou gore.\n\n' +
                    '📸 É *permitido* o envio de fotos sensuais leves, como de calcinha, sutiã ou homens sem camisa/de cueca, com visualização normal.\n\n' +
                    '🔐 Fotos com seios à mostra ou órgãos genitais (de homens ou mulheres) devem ser enviadas *somente em visualização única*.\n\n' +
                    '❌ *Proibido* compartilhar conteúdo do grupo para outros grupos e trazer conteúdo de outros grupos para cá.\n\n' +
                    '*2️⃣ Respeite o espaço de cada um!*\n' +
                    '🔒 *Não invada* o privado de ninguém sem permissão.\n' +
                    '📵 É *proibido* fazer chamadas de áudio ou vídeo no grupo.\n\n' +
                    '*3️⃣ Evite discussões e indiretas!*\n' +
                    '⚠️ Problemas pessoais se resolvem no *PV (privado)*, não aqui.\n' +
                    '💔 Evite brigas amorosas no grupo — relacionamentos se resolvem em particular.\n' +
                    '⚽🚫 É *proibido* discussões sobre futebol, política ou assuntos que causem brigas ou divisões.\n' +
                    '📸 *Proibido* enviar prints de conversas privadas no grupo.\n\n' +
                    '*4️⃣ Maturidade acima de tudo!*\n' +
                    '👥 Se alguém mandou mensagem no privado sem ofensas ou perseguição, *não é caso de exposição* nem de intervenção de admin.\n' +
                    '🤝 Somos adultos — podemos resolver as coisas com *calma e respeito*.\n\n' +
                    '*5️⃣ Respeito nas interações!*\n' +
                    '👋 Ao conversar com alguém que você não conhece, mantenha o *respeito e a educação*.\n' +
                    '😏 Brincadeiras com teor sexual ou mais íntimas *só se houver liberdade e confiança mútua*.\n' +
                    '🧩 Conheça a pessoa antes de fazer comentários que possam ser mal interpretados.\n\n' +
                    '*6️⃣ Reforçando:*\n' +
                    '🚫 Nada de apologia a pedofilia, zoofilia, violência, drogas ou armas.\n' +
                    '📵 Nada de chamadas em grupo.\n' +
                    '🕊️ *Respeito sempre, zoeira com limite!*\n\n' +
                    '━━━━━━━✦✗✦━━━━━━━━\n\n' +
                    '_© Damas da Night_',
                mentions: mentions
            });

            console.log(`✅ Regras enviadas marcando ${mentions.length} pessoas`);
            console.log(`[ALERTA] Regras gerais enviadas no grupo: ${groupMetadata.subject}\n`);
            
            return true;
        }

        console.log('🎯 ========= REMOVENDO MENSAGEM =========');
        console.log('📝 ID da mensagem citada:', targetMessageId);
        console.log('👤 Autor da mensagem citada:', targetParticipant);
        
        // 🔥 BUSCA O NOME REAL DA PESSOA DA MENSAGEM ORIGINAL (igual ao musicaHandler)
        let targetParticipantName = targetParticipant.split('@')[0];
        
        // Tenta buscar o pushName da mensagem citada (nome que aparece no WhatsApp)
        try {
            const quotedMsg = msg?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedParticipant = msg?.extendedTextMessage?.contextInfo?.participant;
            
            // Se a mensagem citada tem pushName, usa ele
            if (quotedMsg && quotedParticipant === targetParticipant) {
                // Busca nos metadados do grupo
                const participant = groupMetadata.participants.find(p => p.id === targetParticipant);
                
                if (participant?.notify) {
                    targetParticipantName = participant.notify;
                    console.log('✅ Nome encontrado via notify:', targetParticipantName);
                } else if (participant?.verifiedName) {
                    targetParticipantName = participant.verifiedName;
                    console.log('✅ Nome encontrado via verifiedName:', targetParticipantName);
                } else if (participant?.name) {
                    targetParticipantName = participant.name;
                    console.log('✅ Nome encontrado via name:', targetParticipantName);
                } else {
                    // Usa o split padrão se não encontrar
                    console.log('⚠️ Usando split padrão do JID');
                }
            }
        } catch (err) {
            console.log('⚠️ Erro ao buscar nome, usando padrão:', err.message);
        }
        
        console.log('📝 Nome final que será exibido:', targetParticipantName);
        console.log('========================================\n');

        try {
            // 🔥 USA A MESMA FUNÇÃO ROBUSTA DO ANTILINK
            
            // Deleta a mensagem inapropriada usando múltiplas tentativas
            const messageKeyToDelete = {
                remoteJid: from,
                id: targetMessageId,
                participant: targetParticipant
            };
            
            const success = await deleteMessage(sock, from, messageKeyToDelete);
            
            if (success) {
                console.log('✅ Mensagem inapropriada removida com sucesso');
            } else {
                console.log('⚠️ Não foi possível remover a mensagem após múltiplas tentativas');
            }

            // Aguarda um pouco antes de deletar o comando do admin
            await new Promise(resolve => setTimeout(resolve, 500));

            // Apaga a mensagem do administrador com #alerta
            const adminKeyToDelete = {
                remoteJid: from,
                id: key.id,
                participant: sender
            };
            
            await deleteMessage(sock, from, adminKeyToDelete);
            console.log('✅ Mensagem do admin (#alerta) removida');

            // Envia mensagem informativa mencionando o usuário
            await sock.sendMessage(from, {
                text: '🚨 *MENSAGEM REMOVIDA*\n\n' +
                      `⚠️ @${targetParticipantName}, sua mensagem foi apagada por conter *conteúdo inapropriado*.\n\n` +
                      '⊱⋅ ──────────── ⋅⊰\n' +
                      '📌📜 *REGRAS DO GRUPO (ESSENCIAIS)* 📌\n\n' +
                      '*1️⃣ Conteúdo permitido e proibido:*\n' +
                      '🚷 É *proibido* enviar figurinhas, imagens, vídeos ou qualquer outro tipo de conteúdo com crianças, bem como qualquer material que envolva pedofilia, zoofilia, violência, drogas, armas ou gore.\n\n' +
                      '📸 É *permitido* o envio de fotos sensuais leves, como de calcinha, sutiã ou homens sem camisa/de cueca, com visualização normal.\n\n' +
                      '🔐 Fotos com seios à mostra ou órgãos genitais (de homens ou mulheres) devem ser enviadas *somente em visualização única*.\n\n' +
                      '❌ *Proibido* compartilhar conteúdo do grupo para outros grupos e trazer conteúdo de outros grupos para cá.\n\n' +
                      '*2️⃣ Respeite o espaço de cada um!*\n' +
                      '🔒 *Não invada* o privado de ninguém sem permissão.\n' +
                      '📵 É *proibido* fazer chamadas de áudio ou vídeo no grupo.\n\n' +
                      '*3️⃣ Evite discussões e indiretas!*\n' +
                      '⚠️ Problemas pessoais se resolvem no *PV (privado)*, não aqui.\n' +
                      '💔 Evite brigas amorosas no grupo — relacionamentos se resolvem em particular.\n' +
                      '⚽🚫 É *proibido* discussões sobre futebol, política ou assuntos que causem brigas ou divisões.\n' +
                      '📸 *Proibido* enviar prints de conversas privadas no grupo.\n\n' +
                      '*4️⃣ Maturidade acima de tudo!*\n' +
                      '👥 Se alguém mandou mensagem no privado sem ofensas ou perseguição, *não é caso de exposição* nem de intervenção de admin.\n' +
                      '🤝 Somos adultos — podemos resolver as coisas com *calma e respeito*.\n\n' +
                      '*5️⃣ Respeito nas interações!*\n' +
                      '👋 Ao conversar com alguém que você não conhece, mantenha o *respeito e a educação*.\n' +
                      '😏 Brincadeiras com teor sexual ou mais íntimas *só se houver liberdade e confiança mútua*.\n' +
                      '🧩 Conheça a pessoa antes de fazer comentários que possam ser mal interpretados.\n\n' +
                      '*6️⃣ Reforçando:*\n' +
                      '🚫 Nada de apologia a pedofilia, zoofilia, violência, drogas ou armas.\n' +
                      '📵 Nada de chamadas em grupo.\n' +
                      '🕊️ *Respeito sempre, zoeira com limite!*\n\n' +
                      '━━━━━━━✦✗✦━━━━━━━━\n\n' +
                      '_© Damas da Night_',
                mentions: [targetParticipant]
            });

            console.log('✅ Aviso de remoção enviado');
            console.log(`[ALERTA] Mensagem removida no grupo: ${groupMetadata.subject}\n`);
            
        } catch (deleteError) {
            console.error('❌ Erro ao deletar mensagem:', deleteError);
            await sock.sendMessage(from, { 
                text: '❌ Erro ao processar o comando. Verifique se o bot tem permissões de administrador.' 
            }, { quoted: message });
        }

        return true;
        
    } catch (error) {
        console.error('❌ Erro ao processar comando #alerta:', error);
        
        try {
            await sock.sendMessage(message.key.remoteJid, { 
                text: '❌ Erro ao processar o comando. Tente novamente.' 
            }, { quoted: message });
        } catch (replyError) {
            console.error('❌ Erro ao enviar mensagem de erro:', replyError);
        }
        
        return false;
    }
};

export default alertaHandler;
export { alertaHandler };