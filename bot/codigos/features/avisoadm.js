// avisoadm.js
import pkg from '@whiskeysockets/baileys';
const { fetchProfilePictureUrl } = pkg;

// Defina seus números de WhatsApp
const yourNumbers = [
    '5521972337640@s.whatsapp.net'
];

// Função para enviar mensagens de aviso
const sendMessages = async (sock, message, mentions, image = null) => {
    const sendPromises = yourNumbers.map(number => {
        const messageData = {
            text: message,
            mentions: mentions,
            quoted: null
        };
        if (image) {
            messageData.image = { url: image };
            messageData.caption = message;
        }
        return sock.sendMessage(number, messageData);
    });
    await Promise.all(sendPromises);
};

// Formata a data e hora
const getFormattedDateTime = () => {
    const now = new Date();
    return now.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
};

// Função auxiliar para extrair o identificador correto do participant
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

// Função principal para lidar com atualizações de participantes
export async function handleGroupParticipantsUpdate(sock, update, botInfo) {
    console.log('Update recebido:', update);

    if (!update.participants || update.participants.length === 0) return;

    // ✅ CORREÇÃO: Adapta para funcionar com string OU objeto
    const participantData = update.participants[0];
    const participant = getParticipantId(participantData);
    
    // Para comparação de IDs (quando é objeto, usa o .id)
    const participantIdForComparison = typeof participantData === 'object' && participantData !== null 
        ? participantData.id 
        : participant;
    
    const author = update.author;

    let profilePic;

    if (['add', 'remove'].includes(update.action)) {
        try {
            profilePic = await fetchProfilePictureUrl(participant, 'image');
        } catch (err) {
            profilePic = 'default-profile-pic-url';
        }
    }

    const dateTime = getFormattedDateTime();
    const title = "👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸";

    const participantName = `*@${participant.split('@')[0]}*`;
    const authorName = `*@${author.split('@')[0]}*`;

    let message = `${title}\n\n`;

    if (update.action === 'promote') {
        message += `✅ *PROMOÇÃO DE ADMINISTRADOR*\n\n` +
                   `O usuário ${participantName} foi *PROMOVIDO(a)* a administrador do grupo.\n` +
                   `🎉 Por: ${authorName}\n` +
                   `🕒 Em: ${dateTime}`;
        await sendMessages(sock, message, [participant, author]);

    } else if (update.action === 'demote') {
        message += `❌ *REBAIXAMENTO DE ADMINISTRADOR*\n\n` +
                   `O usuário ${participantName} foi *REBAIXADO(a)* de administrador do grupo.\n` +
                   `⚠️ Por: ${authorName}\n` +
                   `🕒 Em: ${dateTime}`;
        await sendMessages(sock, message, [participant, author]);

    } else if (update.action === 'add') {
        // Verifica se o usuário entrou por link ou foi adicionado por admin
        // Usa participantIdForComparison para comparar corretamente
        const enteredByLink = !author || author === participantIdForComparison;
        
        if (enteredByLink) {
            message += `👋 *NOVO MEMBRO*\n\n` +
                       `${participantName} *ENTROU* no grupo através do link de convite.\n` +
                       `🔗 Entrada por link\n` +
                       `🕒 Em: ${dateTime}`;
            await sendMessages(sock, message, [participant], profilePic);
        } else {
            message += `👋 *NOVA ADIÇÃO AO GRUPO*\n\n` +
                       `${participantName} foi *ADICIONADO(a)* ao grupo.\n` +
                       `🎉 Por: ${authorName}\n` +
                       `🕒 Em: ${dateTime}`;
            await sendMessages(sock, message, [participant, author], profilePic);
        }

    } else if (update.action === 'remove') {
        // Verifica se o usuário saiu por conta própria ou foi removido
        // ✅ USA participantIdForComparison para comparar no formato correto
        const isUserLeftByThemselves = participantIdForComparison === author;
        
        if (isUserLeftByThemselves) {
            message += `👋 *USUÁRIO SAIU DO GRUPO*\n\n` +
                       `${participantName} *SAIU* do grupo por conta própria.\n` +
                       `🕒 Em: ${dateTime}`;
            await sendMessages(sock, message, [participant], profilePic);
        } else {
            message += `👋 *USUÁRIO REMOVIDO*\n\n` +
                       `${participantName} foi *REMOVIDO(a)* do grupo.\n` +
                       `⚠️ Por: ${authorName}\n` +
                       `🕒 Em: ${dateTime}`;
            await sendMessages(sock, message, [participant, author], profilePic);
        }
    }
}

// Configura listener de desconexão correto
export const setupClient = (sock, reconnectCallback) => {
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            console.log('⚠️ Conexão perdida. Tentando reconectar...');
            if (reconnectCallback) reconnectCallback();
        }
    });
};