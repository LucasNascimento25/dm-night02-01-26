// menuOwner.js

const BOT_TITLE = '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸';

/**
 * Extrai apenas os dígitos do número (igual ao blacklistFunctions)
 */
function extractDigits(number) {
    return number.replace(/@.*$/, '').replace(/\D/g, '');
}

/**
 * Menu exclusivo para o dono do bot
 */
export function getOwnerMenu() {
    return `${BOT_TITLE}

━━━━━━━━━━━━━━━━━━━━━━━━━
👑 *MENU DO PROPRIETÁRIO* 👑
━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════
║ 🚫 *BLACKLIST*
╠═══════════════════════════
║ #addlista [número] [motivo]
║ → Adiciona número à blacklist
║
║ #remlista [número]
║ → Remove número da blacklist
║
║ #verilista [número]
║ → Verifica se número está na blacklist
║
║ #lista
║ → Lista todos os números bloqueados
║
║ #varredura
║ → Remove da blacklist do grupo
║
║ #infolista
║ → Guia completo da blacklist
╚═══════════════════════════

╔═══════════════════════════
║ ⚠️ *ADVERTÊNCIAS*
╠═══════════════════════════
║ #adv
║ → Advertir usuário (3 = remoção)
║ → Responda a mensagem com #adv
╚═══════════════════════════

╔═══════════════════════════
║ 🏷️ *MARCAR TODOS* (Admins)
╠═══════════════════════════
║ 📝 *TEXTO:*
║ → [mensagem] #all damas
║ → Ex: "Festa 20h #all damas"
║
║ 🖼️ *IMAGEM:*
║ → Envie foto com legenda:
║ → "#all damas" ou
║ → "Legenda #all damas"
║
║ 🎥 *VÍDEO:*
║ → Envie vídeo com legenda:
║ → "#all damas" ou
║ → "Legenda #all damas"
╚═══════════════════════════

╔═══════════════════════════
║ 🔨 *BANIMENTO*
╠═══════════════════════════
║ #ban @usuário
║ → Remove usuário do grupo
║ → ⚡ Comando deletado automaticamente
║
║ *Formas de usar:*
║ • Responder imagem com #ban
║ • Responder mensagem com #ban
║ • #ban @nome
║ • @nome #ban
║
║ *Proteções:*
║ ✅ Não remove administradores
║ ✅ Não remove o próprio bot
║ 🗑️ Apaga comando após execução
╚═══════════════════════════

╔═══════════════════════════
║ 🔧 *GERENCIAMENTO*
╠═══════════════════════════
║ #rlink
║ → Redefine link do grupo
║ → ⚡ Comando deletado automaticamente
║
║ #closegp
║ → Fecha grupo (só admins falam)
║ → ⚡ Comando deletado automaticamente
║
║ #opengp
║ → Abre grupo (todos podem falar)
║ → ⚡ Comando deletado automaticamente
║
║ *Proteções:*
║ ✅ Apenas administradores
║ ✅ Bot precisa ser admin
║ 🗑️ Apaga comandos após execução
╚═══════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *OBSERVAÇÕES IMPORTANTES*
━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 Comandos administrativos:
   • Você ser administrador
   • Bot ser administrador

🏷️ Sistema AutoTag:
   • Apenas admins usam #all damas
   • Suporta texto, imagem e vídeo
   • Remove mensagem original
   • Reenvia com marcações

🔨 Sistema de Banimento:
   • Apenas admins podem banir
   • Admins não podem ser banidos
   • Comandos deletados automaticamente
   • Sistema com múltiplas tentativas

🔧 Sistema de Gerenciamento:
   • Apenas admins podem usar
   • Bot precisa ser admin
   • Comandos deletados automaticamente
   • Sistema com múltiplas tentativas

🛡️ Proteções ativas:
   • AntiLink automático
   • Blacklist automática
   • Sistema de advertências
   • Anti-banimento de admins

💡 Para ajuda específica:
   • #infolista → Blacklist
   • #dmlukownner → Este menu

━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 *DAMAS DA NIGHT* - Bot Premium
━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Verifica se o usuário é owner do bot
 * 🔥 USA O MESMO SISTEMA DO BLACKLIST (comparação por dígitos)
 */
function isOwner(userId, ownerNumbers) {
    console.log(`\n🔍 ========= VERIFICAÇÃO DE OWNER =========`);
    console.log(`👤 Verificando userId: ${userId}`);
    console.log(`📋 Lista de owners:`, ownerNumbers);
    
    // Extrai apenas os dígitos do userId (igual ao blacklistFunctions)
    const userDigits = extractDigits(userId);
    console.log(`🔢 Dígitos do usuário: ${userDigits}`);
    
    // Extrai os dígitos de cada owner
    const ownerDigitsList = ownerNumbers.map(owner => {
        const digits = extractDigits(owner);
        console.log(`   📌 Owner ${owner} → dígitos: ${digits}`);
        return digits;
    });
    
    // Verifica se os dígitos do usuário estão na lista de owners
    const isOwnerUser = ownerDigitsList.includes(userDigits);
    
    console.log(`\n🎯 RESULTADO: ${isOwnerUser ? '👑 É OWNER' : '🚫 NÃO É OWNER'}`);
    console.log(`==========================================\n`);
    
    return isOwnerUser;
}

/**
 * Resolve LID para número real usando metadados do grupo
 * 🔥 MESMA LÓGICA DO BLACKLIST scanAndRemoveBlacklisted
 */
async function resolveLidToRealNumber(sock, groupId, userId) {
    try {
        // Se não for LID, retorna o próprio userId
        if (!userId.includes('@lid')) {
            console.log(`   ℹ️ Não é LID, usando userId original: ${userId}`);
            return userId;
        }
        
        console.log(`   🔍 É um LID! Buscando número real nos metadados...`);
        
        // Busca os metadados do grupo
        const groupMetadata = await sock.groupMetadata(groupId);
        
        // Procura o participante com esse LID
        const participant = groupMetadata.participants.find(p => p.id === userId);
        
        if (participant) {
            console.log(`   📊 Participante encontrado:`, JSON.stringify(participant, null, 2));
            
            // Tenta pegar o número real
            if (participant.phoneNumber) {
                const realNumber = participant.phoneNumber;
                console.log(`   ✅ Número real resolvido: ${userId} → ${realNumber}`);
                return realNumber;
            }
        }
        
        console.log(`   ⚠️ Não foi possível resolver LID, usando original: ${userId}`);
        return userId;
        
    } catch (err) {
        console.error(`   ❌ Erro ao resolver LID:`, err.message);
        return userId;
    }
}

/**
 * Handler para o comando do menu do dono
 * 🔥 COM RESOLUÇÃO DE LID PARA NÚMERO REAL
 */
export async function handleOwnerMenu(sock, from, userId, content, ownerNumbers = [], message = null) {
    try {
        const command = content.toLowerCase().trim();
        
        // Comando secreto: #dmlukownner
        if (command !== '#dmlukownner') {
            return false;
        }
        
        console.log(`\n👑 ========= COMANDO OWNER DETECTADO =========`);
        console.log(`👤 Usuário recebido: ${userId}`);
        console.log(`📱 Chat: ${from}`);
        console.log(`📝 Comando: ${command}`);
        
        // 🔥 SE FOR GRUPO E FOR LID, RESOLVE PARA NÚMERO REAL
        let realUserId = userId;
        
        if (from.endsWith('@g.us') && userId.includes('@lid')) {
            console.log(`\n🔄 Resolvendo LID para número real...`);
            realUserId = await resolveLidToRealNumber(sock, from, userId);
            console.log(`✅ Usuário final: ${realUserId}\n`);
        }
        
        // 🔥 VERIFICA SE É OWNER (usando sistema do blacklist)
        if (!isOwner(realUserId, ownerNumbers)) {
            console.log(`🚫 Acesso negado - usuário não é owner`);
            console.log(`=====================================\n`);
            
            // Não envia nada para não revelar que o comando existe
            return true;
        }
        
        console.log(`✅ Acesso permitido - enviando menu...`);
        
        // Envia o menu
        const menu = getOwnerMenu();
        await sock.sendMessage(from, { text: menu });
        
        console.log(`✅ Menu do proprietário enviado com sucesso!`);
        console.log(`=====================================\n`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao processar menu do dono:', error);
        return false;
    }
}

/**
 * Exporta as funções
 */
export default {
    getOwnerMenu,
    handleOwnerMenu,
    isOwner
};