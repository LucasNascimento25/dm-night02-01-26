// bot/handlers/addHandler.js
import { configurarBoasVindas } from '../codigos/features/boasVindas.js';
import { onUserJoined, isBlacklistedRealtime } from '../codigos/moderation/blacklist/blacklistFunctions.js';

export async function handleUserAdd(sock, groupId, participants) {
    for (const participant of participants) {
        const userPhone = participant.split('@')[0];

        console.log(`\n🔍 ========= VERIFICAÇÃO DE BLACKLIST =========`);
        console.log(`👤 Verificando: ${participant}`);
        console.log(`📱 Telefone: ${userPhone}`);
        
        // Delay para garantir processamento
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Resolve LID para número real
        const realNumber = await resolveUserNumber(sock, groupId, participant);
        
        // Verifica blacklist e remove se necessário
        await onUserJoined(realNumber, groupId, sock, participant);
        
        // Envia boas-vindas se não estiver bloqueado
        const isBlocked = await isBlacklistedRealtime(realNumber);
        if (!isBlocked) {
            console.log(`✅ ${userPhone} não está na blacklist - enviando boas-vindas`);
            await configurarBoasVindas(sock, groupId, participant);
        }
        
        console.log(`==============================================\n`);
    }
}

async function resolveUserNumber(sock, groupId, participant) {
    let realNumber = participant;
    
    if (participant.includes('@lid')) {
        try {
            console.log('🔍 LID detectado! Buscando número real...');
            const metadata = await sock.groupMetadata(groupId);
            const participantData = metadata.participants.find(p => p.id === participant);
            
            if (participantData?.phoneNumber) {
                realNumber = participantData.phoneNumber;
                console.log(`✅ Número real encontrado: ${realNumber}`);
            } else {
                console.log('⚠️ phoneNumber não encontrado no metadata');
            }
        } catch (err) {
            console.log('⚠️ Erro ao resolver LID:', err.message);
        }
    }
    
    return realNumber;
}