// bot/handlers/removeHandler.js
import { configurarDespedida } from '../codigos/features/despedidaMembro.js';

export async function handleUserRemove(sock, groupId, participants, action, author) {
    console.log(`\n👋 ========= PROCESSANDO SAÍDA/REMOÇÃO =========`);
    console.log(`🎬 Ação detectada: "${action}"`);
    console.log(`👮 Author (quem executou): ${author || 'N/A'}`);
    console.log(`👥 Total de participantes afetados: ${participants.length}`);
    
    for (const participant of participants) {
        const userPhone = participant.split('@')[0];
        
        console.log(`\n📤 Processando despedida para: ${participant}`);
        console.log(`📱 Telefone: ${userPhone}`);
        console.log(`🔄 Chamando configurarDespedida com action="${action}" e author="${author}"`);
        
        try {
            await configurarDespedida(sock, groupId, participant, action, author);
            console.log(`✅ Despedida processada com sucesso para ${userPhone}`);
        } catch (err) {
            console.error(`❌ Erro ao processar despedida de ${userPhone}:`, err.message);
            console.error(err.stack);
        }
    }
    
    console.log(`==============================================\n`);
}