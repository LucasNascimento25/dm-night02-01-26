// Sistema AntiLink Otimizado - Compatível com WhatsApp Web e Mobile
const pendingRemovals = new Map();

const getGroupInviteLink = async (sock, groupId) => {
    try {
        const inviteCode = await sock.groupInviteCode(groupId);
        return `https://chat.whatsapp.com/${inviteCode}`;
    } catch (error) {
        console.error('Erro ao obter link do grupo:', error);
        return null;
    }
};

// Função melhorada para deletar mensagens (compatível com Web e Mobile)
const deleteMessage = async (sock, groupId, messageKey) => {
    const attempts = [
        // Tentativa 1: Formato padrão
        {
            remoteJid: groupId,
            fromMe: false,
            id: messageKey.id,
            participant: messageKey.participant
        },
        // Tentativa 2: Com remoteJid original
        {
            remoteJid: messageKey.remoteJid,
            fromMe: false,
            id: messageKey.id,
            participant: messageKey.participant
        },
        // Tentativa 3: Sem participant (para WhatsApp Web)
        {
            remoteJid: groupId,
            fromMe: false,
            id: messageKey.id
        },
        // Tentativa 4: Formato alternativo
        {
            ...messageKey,
            fromMe: false
        }
    ];
    
    const delays = [0, 200, 500, 1000, 2000];
    
    for (let delayIndex = 0; delayIndex < delays.length; delayIndex++) {
        if (delays[delayIndex] > 0) {
            await new Promise(r => setTimeout(r, delays[delayIndex]));
        }
        
        for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex++) {
            try {
                const key = attempts[attemptIndex];
                
                await sock.sendMessage(groupId, { delete: key });
                
                console.log(`✅ Mensagem deletada! (delay: ${delays[delayIndex]}ms, tentativa: ${attemptIndex + 1})`);
                return true;
            } catch (error) {
                if (delayIndex === delays.length - 1 && attemptIndex === attempts.length - 1) {
                    console.log(`❌ Todas as tentativas falharam. Erro final: ${error.message}`);
                }
            }
        }
    }
    
    return false;
};

// Função alternativa: Reagir à mensagem antes de deletar (melhora sincronização)
const reactAndDelete = async (sock, groupId, messageKey) => {
    try {
        // Reage à mensagem para garantir que o bot a "viu"
        await sock.sendMessage(groupId, {
            react: {
                text: '🚫',
                key: messageKey
            }
        });
        
        // Pequeno delay
        await new Promise(r => setTimeout(r, 300));
        
        // Tenta deletar
        return await deleteMessage(sock, groupId, messageKey);
    } catch (error) {
        console.error('Erro em reactAndDelete:', error);
        // Tenta deletar mesmo se a reação falhar
        return await deleteMessage(sock, groupId, messageKey);
    }
};

const extractText = (msg) => {
    if (!msg.message) return { text: '', type: 'unknown' };
    
    const types = {
        conversation: { text: msg.message.conversation, type: 'texto' },
        extendedTextMessage: { text: msg.message.extendedTextMessage?.text, type: 'texto' },
        imageMessage: { text: msg.message.imageMessage?.caption, type: 'imagem' },
        videoMessage: { text: msg.message.videoMessage?.caption, type: 'video' },
        documentMessage: { text: msg.message.documentMessage?.caption, type: 'documento' }
    };
    
    for (const [key, value] of Object.entries(types)) {
        if (msg.message[key]) return { text: value.text || '', type: value.type };
    }
    
    return { text: '', type: 'unknown' };
};

const isValidLink = (text) => {
    const strictLinkRegex = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`\[\]]+\.[a-zA-Z]{2,}(?:\/[^\s<>"{}|\\^`\[\]]*)?/gi;
    const whatsappRegex = /(?:https?:\/\/)?(?:chat\.)?whatsapp\.com\/(?:invite\/)?[a-zA-Z0-9_-]+/gi;
    const suspiciousDomainRegex = /(?:^|\s|[^\w.-])([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/[^\s]*)?(?=\s|$|[^\w.-])/gi;
    
    const links = [];
    let match;
    
    while ((match = strictLinkRegex.exec(text)) !== null) {
        links.push(match[0]);
    }
    
    while ((match = whatsappRegex.exec(text)) !== null) {
        links.push(match[0]);
    }
    
    suspiciousDomainRegex.lastIndex = 0;
    while ((match = suspiciousDomainRegex.exec(text)) !== null) {
        const domain = match[1];
        
        const isLikelyLink = (
            domain.split('.').length >= 2 &&
            !/^\d+(\.\d+)*$/.test(domain) &&
            !/\.(jpg|jpeg|png|gif|pdf|doc|txt|mp3|mp4|zip|rar)$/i.test(domain) &&
            !/^\d{1,2}\.\d{1,2}$/.test(domain) &&
            !/^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(domain) &&
            !/^\d+\.\d{1,2}$/.test(domain) &&
            !/\.(com|org|net|edu|gov|mil|int|co|br|uk|de|fr|it|es|ru|jp|cn|in|au|ca|mx|ar|cl|pe|uy|py|bo|ec|ve|cr|gt|hn|sv|ni|pa|do|cu|jm|ht|tt|bb|gd|lc|vc|ag|kn|dm|pr|vi|aw|cw|sx|bq|tc|ky|bs|bm|gl|fo|is|ie|pt|ad|mc|sm|va|mt|cy|bg|ro|hu|pl|cz|sk|si|hr|ba|rs|me|mk|al|gr|tr|by|ua|md|lt|lv|ee|fi|se|no|dk|nl|be|lu|ch|at|li|fl|io|me|tv|cc|ws|tk|ml|ga|cf|ac|sh|st|tm|gg|je|im|ai|ms|vg|as|gu|mp|pw|fm|mh|ki|nr|nu|ck|to|sb|vu|nc|pf|wf)$/i.test(domain)
        );
        
        if (isLikelyLink) {
            const beforeText = text.substring(Math.max(0, match.index - 20), match.index);
            
            const safeContexts = [
                /(?:email|e-mail|contato|site|página|endereço)/i.test(beforeText),
                /(?:versão|atualização|update)/i.test(beforeText),
                /(?:custou|custa|preço|valor|R\$|\$)/i.test(beforeText),
                /(?:horário|hora|às|das)/i.test(beforeText)
            ];
            
            if (!safeContexts.some(safe => safe)) {
                links.push(match[1]);
            }
        }
    }
    
    return [...new Set(links)];
};

const notifyAdminsAndRemoveUser = async (sock, groupId, userId, messageType, success, detectedLinks) => {
    try {
        const violationKey = `${groupId}_${userId}`;
        
        if (pendingRemovals.has(violationKey)) {
            const existing = pendingRemovals.get(violationKey);
            existing.violations.push({ messageType, detectedLinks, success });
            console.log(`⚠️ Infração adicional detectada para ${userId.split('@')[0]} (total: ${existing.violations.length})`);
            return;
        }
        
        const violations = [{ messageType, detectedLinks, success }];
        
        pendingRemovals.set(violationKey, {
            timer: null,
            violations,
            groupId,
            processing: true
        });
        
        const groupData = await sock.groupMetadata(groupId);
        const admins = groupData.participants.filter(p => p.admin);
        const mentions = [userId, ...admins.map(a => a.id)];
        
        const status = success ? '✅ Mensagem removida automaticamente' : '⚠️ Remoção manual necessária';
        const emoji = { imagem: '🖼️', video: '🎥', documento: '📄' }[messageType] || '💬';
        
        let contentType = messageType === 'texto' ? '🔗 Link suspeito' : `${emoji} ${messageType.charAt(0).toUpperCase() + messageType.slice(1)} com link`;
        
        const categorizeLinkType = (links) => {
            const types = [];
            for (const link of links) {
                const domain = link.replace(/^https?:\/\//, '').toLowerCase();
                if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
                    types.push('🎥 Vídeo (YouTube)');
                } else if (domain.includes('instagram.com')) {
                    types.push('📸 Instagram');
                } else if (domain.includes('facebook.com')) {
                    types.push('👥 Facebook');
                } else if (domain.includes('twitter.com') || domain.includes('t.co')) {
                    types.push('🐦 Twitter');
                } else if (domain.includes('tiktok.com')) {
                    types.push('🎵 TikTok');
                } else if (domain.includes('whatsapp.com')) {
                    types.push('💬 Grupo WhatsApp');
                } else if (domain.includes('telegram.')) {
                    types.push('📱 Telegram');
                } else {
                    types.push('🌐 Site externo');
                }
            }
            return [...new Set(types)];
        };

        const linkTypes = categorizeLinkType(detectedLinks);

        const warningMessage = `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸

🚨 *ALERTA DE SEGURANÇA* 🚨

${status} por conter link(s) não autorizado(s).

⚠️ *POLÍTICA DO GRUPO: NENHUM LINK EXTERNO É PERMITIDO*

${contentType}
👤 *Usuário infrator:* @${userId.split('@')[0]}
🚫 *Tipo(s) detectado(s):* ${linkTypes.join(', ')}

⚠️ *ATENÇÃO ADMINISTRADORES:*
${admins.map(a => `@${a.id.split('@')[0]}`).join(', ')}

*Por medida de segurança, o usuário infrator será removido imediatamente do grupo.*

🔒 *Proteção automática ativada!*`;

        await sock.sendMessage(groupId, {
            text: warningMessage,
            mentions
        });

        setTimeout(async () => {
            try {
                const violationData = pendingRemovals.get(violationKey);
                const totalViolations = violationData ? violationData.violations.length : 1;
                
                await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
                
                console.log(`🚫 Usuário ${userId} removido automaticamente (${totalViolations} infração(ões))`);
            } catch (error) {
                console.error('❌ Erro ao remover usuário:', error);
                
                await sock.sendMessage(groupId, {
                    text: `⚠️ *ERRO AO REMOVER USUÁRIO*\n\nNão foi possível remover automaticamente @${userId.split('@')[0]}.\n\n*Administradores, removam manualmente por favor.*`,
                    mentions: [userId, ...admins.map(a => a.id)]
                });
            } finally {
                pendingRemovals.delete(violationKey);
            }
        }, 2000);

        console.log(`⏱️ Remoção automática agendada para ${userId} em 2 segundos`);
    } catch (error) {
        console.error('❌ Erro ao notificar:', error);
    }
};

export const handleAntiLink = async (sock, msg, groupId) => {
    try {
        if (msg.key.fromMe) return;
        
        const senderId = msg.key.participant || msg.key.remoteJid;
        const groupData = await sock.groupMetadata(groupId);
        const isAdmin = groupData.participants.find(p => p.id === senderId)?.admin;
        
        if (isAdmin) return;
        
        const { text, type } = extractText(msg);
        if (!text.trim()) return;
        
        const detectedLinks = isValidLink(text);
        if (detectedLinks.length === 0) return;
        
        console.log(`🔍 Links detectados: ${detectedLinks.join(', ')}`);
        console.log(`📱 Plataforma: ${msg.key.id.startsWith('3EB0') ? 'WhatsApp Web' : 'Mobile'}`);
        
        const groupLink = await getGroupInviteLink(sock, groupId);
        const groupInviteCode = groupLink?.split('/').pop();
        
        const unauthorizedLinks = detectedLinks.filter(link => {
            const normalizedLink = link.replace(/^https?:\/\//, '').toLowerCase();
            
            if (normalizedLink.includes('chat.whatsapp.com') || normalizedLink.includes('whatsapp.com')) {
                return !normalizedLink.includes(groupInviteCode);
            }
            
            return true;
        });
        
        if (unauthorizedLinks.length > 0) {
            console.log(`🗑️ Deletando mensagem de ${senderId.split('@')[0]}`);
            console.log(`🔑 Message Key:`, JSON.stringify(msg.key, null, 2));
            
            // USA A NOVA FUNÇÃO reactAndDelete
            const success = await reactAndDelete(sock, groupId, msg.key);
            
            setImmediate(() => notifyAdminsAndRemoveUser(sock, groupId, senderId, type, success, unauthorizedLinks));
        }
        
    } catch (error) {
        console.error('Erro no antilink:', error);
    }
};

export const testAntiLink = async (sock, groupId) => {
    const testCases = [
        'Teste: https://exemplo.com',
        'Visitem www.site.com.br',
        'Olá pessoal! Custou R$ 15.50',
        'Versão 2.0 chegou',
        'Email: joao@empresa.com.br',
        'Site malicioso.com aqui',
        'youtube.com/video123',
        'chat.whatsapp.com/abc123'
    ];
    
    console.log('🧪 Testando antilink...');
    
    for (const [index, testText] of testCases.entries()) {
        console.log(`\n📝 Teste ${index + 1}: "${testText}"`);
        const links = isValidLink(testText);
        console.log(`🔍 Links detectados: ${links.length > 0 ? links.join(', ') : 'Nenhum'}`);
    }
};