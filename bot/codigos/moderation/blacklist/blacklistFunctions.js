//blacklistFunctions.js

import pool from "../../../../db.js";

export const BOT_TITLE = '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸';

/**
 * Normaliza números para o formato do WhatsApp
 * 🔧 LÓGICA SIMPLES: Se começa com 55 = brasileiro, senão = estrangeiro
 */
export function normalizeNumber(number) {
    // Extrai o sufixo original (@lid, @s.whatsapp.net, etc)
    const suffixMatch = number.match(/@(.+)$/);
    const suffix = suffixMatch ? `@${suffixMatch[1]}` : '@s.whatsapp.net';
    
    // Remove tudo que não é dígito
    let digits = number.replace(/@.*$/, '').replace(/\D/g, '');
    
    // ✅ REGRA SIMPLES: Mantém exatamente como o usuário digitou
    // Se digitou com 55, é brasileiro. Se não, é estrangeiro.
    
    return `${digits}${suffix}`;
}

/**
 * 🔧 EXTRAI DÍGITOS - LÓGICA SIMPLES
 * ✅ Se usuário digitou com 55 = brasileiro
 * ✅ Se usuário NÃO digitou com 55 = estrangeiro (mantém como está)
 */
export function extractDigits(number) {
    // Remove tudo que não é dígito
    let digits = number.replace(/@.*$/, '').replace(/\D/g, '');
    
    // ✅ REGRA SIMPLES: Mantém exatamente como o usuário digitou
    // Se digitou com 55, salva com 55. Se não, salva sem.
    
    return digits;
}

export function adminOnlyMessage() {
    return `${BOT_TITLE} 🚫 Este comando só pode ser usado por administradores!`;
}

/**
 * Verifica em tempo real se o número está na blacklist
 * 🔧 VERSÃO COM DEBUG INTENSIVO
 */
export async function isBlacklistedRealtime(number) {
    try {
        console.log('\n🔍 ========= isBlacklistedRealtime =========');
        console.log('📥 Número recebido:', number);
        
        // Extrai apenas os dígitos do número
        const digits = extractDigits(number);
        console.log('🔢 Dígitos extraídos:', digits);
        
        // Busca na blacklist (agora comparando direto com whatsapp_id que só tem dígitos)
        console.log('🔍 Executando query no banco...');
        const query = 'SELECT whatsapp_id FROM blacklist WHERE whatsapp_id = $1';
        console.log('📝 Query:', query);
        console.log('📝 Parâmetro:', [digits]);
        
        const result = await pool.query(query, [digits]);
        
        console.log('📊 Resultado da query:');
        console.log('   - Rows encontradas:', result.rowCount);
        console.log('   - Dados:', JSON.stringify(result.rows, null, 2));
        
        const isBlocked = result.rowCount > 0;
        console.log('🎯 ESTÁ BLOQUEADO?', isBlocked);
        console.log('==========================================\n');
        
        return isBlocked;
        
    } catch (err) {
        console.error('❌ ========= ERRO em isBlacklistedRealtime =========');
        console.error('❌ Erro:', err.message);
        console.error('❌ Stack:', err.stack);
        console.error('===================================================\n');
        return false;
    }
}

/**
 * Adiciona número à blacklist
 * 🔧 SALVA APENAS OS DÍGITOS, SEM SUFIXO
 */
export async function addToBlacklist(whatsappId, motivo = null) {
    try {
        const digits = extractDigits(whatsappId);
        
        console.log('🔍 DEBUG ADD - Número recebido:', whatsappId);
        console.log('🔍 DEBUG ADD - Dígitos salvos:', digits);
        console.log('🔍 DEBUG ADD - Motivo:', motivo);
        
        const alreadyBlocked = await isBlacklistedRealtime(digits);
        if (alreadyBlocked) return `${BOT_TITLE} ⚠️ *Número* ${digits} *já está na blacklist.*`;

        await pool.query('INSERT INTO blacklist (whatsapp_id, motivo) VALUES ($1, $2)', [digits, motivo]);
        
        console.log('✅ DEBUG ADD - número adicionado com sucesso:', digits);
        
        return `${BOT_TITLE} ✅ *Número* ${digits} *adicionado à blacklist.*`;
    } catch (err) {
        console.error(`${BOT_TITLE} ❌ Erro ao adicionar ${whatsappId}:`, err);
        return `${BOT_TITLE} ❌ Erro ao adicionar ${whatsappId} à blacklist.`;
    }
}

/**
 * Remove número da blacklist
 * 🔧 REMOVE USANDO APENAS OS DÍGITOS
 */
export async function removeFromBlacklist(whatsappId) {
    try {
        const digits = extractDigits(whatsappId);
        
        console.log('🔍 DEBUG REM - Número recebido:', whatsappId);
        console.log('🔍 DEBUG REM - Dígitos extraídos:', digits);
        
        const result = await pool.query(
            'DELETE FROM blacklist WHERE whatsapp_id = $1',
            [digits]
        );

        console.log('🔍 DEBUG REM - Linhas afetadas:', result.rowCount);

        if (result.rowCount > 0) return `${BOT_TITLE} 🟢 *Número* ${digits} *removido da blacklist* 🔓`;
        return `${BOT_TITLE} ⚠️ *Número* ${digits} *não está na blacklist.*`;
    } catch (err) {
        console.error(`${BOT_TITLE} ❌ Erro ao remover ${whatsappId}:`, err);
        return `${BOT_TITLE} ❌ Erro ao remover ${whatsappId} da blacklist.`;
    }
}

/**
 * Lista números da blacklist
 */
export async function listBlacklist() {
    try {
        const result = await pool.query('SELECT * FROM blacklist ORDER BY created_at DESC');
        
        console.log('🔍 DEBUG LISTA - Total na blacklist:', result.rows.length);
        console.log('🔍 DEBUG LISTA - Números:', result.rows.map(r => r.whatsapp_id));
        
        if (!result.rows.length) return `${BOT_TITLE} 📋 A blacklist está vazia.`;
        return `${BOT_TITLE}\n\n` + result.rows.map(r => `• ${r.whatsapp_id} - ${r.motivo || 'Sem motivo'}`).join('\n');
    } catch (err) {
        console.error(`${BOT_TITLE} ❌ Erro ao listar blacklist:`, err);
        return `${BOT_TITLE} ❌ Erro ao listar blacklist.`;
    }
}

/**
 * Faz varredura no grupo e remove todos da blacklist
 */
export async function scanAndRemoveBlacklisted(groupId, bot) {
    try {
        console.log(`${BOT_TITLE} 🔍 Iniciando varredura no grupo ${groupId}...`);
        
        const groupMetadata = await bot.groupMetadata(groupId);
        const participants = groupMetadata.participants.map(p => p.id);
        
        console.log(`${BOT_TITLE} 👥 Total de participantes: ${participants.length}`);
        
        const result = await pool.query('SELECT whatsapp_id FROM blacklist');
        const blacklistedNumbers = result.rows.map(r => r.whatsapp_id);
        
        console.log(`${BOT_TITLE} 🚫 Total na blacklist: ${blacklistedNumbers.length}`);
        console.log(`${BOT_TITLE} 📋 Números na blacklist:`, blacklistedNumbers);
        
        const toRemove = [];
        
        // 🔥 Processa cada participante (incluindo LIDs)
        for (const participant of participants) {
            console.log(`\n🔍 ===== Verificando participante =====`);
            console.log(`   📌 Participant ID: ${participant}`);
            
            let numberToCheck = participant;
            
            // Se for LID, resolve para número real
            if (participant.includes('@lid')) {
                const participantData = groupMetadata.participants.find(p => p.id === participant);
                console.log(`   📊 Dados do participante:`, JSON.stringify(participantData, null, 2));
                
                // 🔧 CORREÇÃO: Usar 'jid' ao invés de 'phoneNumber'
                if (participantData?.jid) {
                    numberToCheck = participantData.jid;
                    console.log(`   ✅ LID resolvido: ${participant} → ${numberToCheck}`);
                } else {
                    console.log(`   ⚠️ LID não tem jid! Usando o participant ID: ${participant}`);
                }
            }
            
            const digits = extractDigits(numberToCheck);
            console.log(`   🔢 Dígitos extraídos: ${digits}`);
            console.log(`   🔍 Comparando com blacklist:`, blacklistedNumbers);
            console.log(`   🔍 Array includes check: ${blacklistedNumbers.includes(digits)}`);
            
            // 🆕 TESTE DIRETO: Procura o número específico
            const isBlacklisted = blacklistedNumbers.includes(digits);
            console.log(`   🎯 Está na blacklist? ${isBlacklisted}`);
            
            if (isBlacklisted) {
                toRemove.push(participant); // Adiciona o ID original (LID ou número normal)
                console.log(`   🚨 ✅ ENCONTRADO NA BLACKLIST: ${participant} (${numberToCheck})`);
            } else {
                console.log(`   ✅ Não está na blacklist`);
            }
            console.log(`======================================\n`);
        }
        
        console.log(`${BOT_TITLE} 🎯 Encontrados para remover: ${toRemove.length}`);
        
        if (toRemove.length > 0) {
            for (const userId of toRemove) {
                try {
                    await bot.groupParticipantsUpdate(groupId, [userId], 'remove');
                    console.log(`${BOT_TITLE} 🚨 ${userId} foi removido do grupo ${groupId} (estava na blacklist)`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    console.error(`${BOT_TITLE} ❌ Erro ao remover ${userId}:`, err.message);
                }
            }
            
            return `${BOT_TITLE} ✅ Varredura concluída!\n🚨 ${toRemove.length} usuário(s) da blacklist foram removidos.`;
        } else {
            return `${BOT_TITLE} ✅ Varredura concluída!\n✨ Nenhum usuário da blacklist encontrado no grupo.`;
        }
        
    } catch (err) {
        console.error(`${BOT_TITLE} ❌ Erro ao fazer varredura no grupo ${groupId}:`, err);
        return `${BOT_TITLE} ❌ Erro ao fazer varredura no grupo.`;
    }
}

/**
 * Remove automaticamente usuário blacklist ao entrar no grupo
 * 🔧 VERSÃO COM DEBUG INTENSIVO + SUPORTE A LID
 */
export async function onUserJoined(userId, groupId, bot, originalId = null) {
    try {
        console.log('\n🔍 ==================== DEBUG onUserJoined ====================');
        console.log('📥 INPUT - userId:', userId);
        console.log('📥 INPUT - originalId:', originalId);
        console.log('📥 INPUT - groupId:', groupId);
        console.log('📥 INPUT - bot existe?', !!bot);
        
        // 🆕 BUSCA METADATA DO GRUPO PARA RESOLVER LID
        const groupMetadata = await bot.groupMetadata(groupId);
        let numberToCheck = userId;
        
        // Se for LID, resolve para número real usando 'jid'
        if (userId.includes('@lid')) {
            const participantData = groupMetadata.participants.find(p => p.id === userId);
            console.log('📊 Dados do participante:', JSON.stringify(participantData, null, 2));
            
            if (participantData?.jid) {
                numberToCheck = participantData.jid;
                console.log('✅ LID resolvido para:', numberToCheck);
            }
        }
        
        const digits = extractDigits(numberToCheck);
        console.log('🔄 DÍGITOS EXTRAÍDOS:', digits);
        
        console.log('\n🔍 Chamando isBlacklistedRealtime...');
        const blocked = await isBlacklistedRealtime(digits);
        
        console.log('📊 RESULTADO DA VERIFICAÇÃO:', blocked);
        console.log('📊 Tipo do resultado:', typeof blocked);

        if (blocked) {
            console.log('\n🚨 =============== USUÁRIO ESTÁ NA BLACKLIST ===============');
            console.log('🎯 Tentando remover...');
            
            // 🔥 USA O ID ORIGINAL (LID) PARA REMOVER, NÃO O NÚMERO REAL
            const idToRemove = originalId || userId;
            console.log('   - ID para remover:', idToRemove);
            console.log('   - Group ID:', groupId);
            
            try {
                const result = await bot.groupParticipantsUpdate(groupId, [idToRemove], 'remove');
                
                console.log('✅ RESULTADO DA REMOÇÃO:', JSON.stringify(result, null, 2));
                console.log(`✅ ${idToRemove} foi REMOVIDO do grupo ${groupId} (blacklist)`);
                
            } catch (removeError) {
                console.error('❌ ERRO AO REMOVER:', removeError.message);
                console.error('❌ Stack:', removeError.stack);
            }
            
        } else {
            console.log('\n✅ =============== USUÁRIO NÃO ESTÁ NA BLACKLIST ===============');
            console.log(`✅ ${userId} pode permanecer no grupo ${groupId}`);
        }
        
        console.log('==================== FIM DEBUG onUserJoined ====================\n');
        
    } catch (err) {
        console.error(`\n❌ =============== ERRO GERAL em onUserJoined ===============`);
        console.error('❌ Erro:', err.message);
        console.error('❌ Stack:', err.stack);
        console.error('❌ userId:', userId);
        console.error('❌ groupId:', groupId);
        console.error('===============================================================\n');
    }
}

/**
 * Mensagem de ajuda da blacklist
 */
export function getBlacklistHelp() {
    return `
${BOT_TITLE} \n\n
📋 *COMANDOS DE BLACKLIST* 📋

- #addlista [número] - Adiciona número à blacklist
- #remlista [número] - Remove número da blacklist
- #verilista [número] - Verifica se número está na blacklist
- #lista - Lista todos os números da blacklist
- #varredura - Faz varredura no grupo e remove quem está na blacklist
- #infolista - Mostra este guia

💡 *Como salvar números corretamente:*
- Apenas dígitos, sem símbolos ou espaços
- *Números brasileiros:* Adicione 55 na frente
  Exemplos: 5521979452941, 5511987654321
- *Números estrangeiros:* Digite o número completo com código do país
  Exemplos: 14078486684 (EUA), 447700900000 (Reino Unido)

⚠️ *IMPORTANTE:*
Se você digitar com 55, será tratado como brasileiro.
Se você digitar SEM 55, será tratado como estrangeiro.

🔍 *Varredura Automática:*
- O bot faz varredura automática ao entrar no grupo
- Use #varredura para fazer verificação manual a qualquer momento
`;
}