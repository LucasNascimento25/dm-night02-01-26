import pool from '../../../db.js';

// ============================================
// IMPORTAÇÃO DO SISTEMA DE ALERTAS
// ============================================
import { carregarAudios, sendAudiosSequencialComResposta } from './alertaHandler.js';

// ============================================
// FUNÇÕES DE BANCO DE DADOS
// ============================================

/**
 * Obtém o número de advertências de um usuário em um grupo
 */
async function getAdvertencias(userId, groupId) {
  const res = await pool.query(
    'SELECT count FROM advertencias WHERE user_id = $1 AND group_id = $2',
    [userId, groupId]
  );
  return res.rows[0]?.count || 0;
}

/**
 * Incrementa a advertência de um usuário
 */
async function incrementAdvertencia(userId, groupId) {
  const count = await getAdvertencias(userId, groupId);

  if (count === 0) {
    await pool.query(
      'INSERT INTO advertencias (user_id, group_id, count) VALUES ($1, $2, 1)',
      [userId, groupId]
    );
    return 1;
  } else {
    const newCount = count + 1;
    await pool.query(
      'UPDATE advertencias SET count = $1 WHERE user_id = $2 AND group_id = $3',
      [newCount, userId, groupId]
    );
    return newCount;
  }
}

/**
 * Reseta as advertências de um usuário
 */
async function resetAdvertencia(userId, groupId) {
  await pool.query(
    'DELETE FROM advertencias WHERE user_id = $1 AND group_id = $2',
    [userId, groupId]
  );
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Deleta uma mensagem com múltiplas tentativas
 */
const deleteCommandMessage = async (sock, groupId, messageKey) => {
  const delays = [0, 100, 500, 1000, 2000, 5000];
  
  for (let i = 0; i < delays.length; i++) {
    try {
      if (delays[i] > 0) {
        await new Promise(r => setTimeout(r, delays[i]));
      }
      
      const key = {
        remoteJid: messageKey.remoteJid || groupId,
        fromMe: false,
        id: messageKey.id,
        participant: messageKey.participant
      };
      
      await sock.sendMessage(groupId, { delete: key });
      console.log(`✅ Comando #adv deletado (tentativa ${i + 1})`);
      return true;
    } catch (error) {
      console.log(`❌ Tentativa ${i + 1} de deletar comando falhou`);
    }
  }
  return false;
};

/**
 * Envia mensagens com título padrão do grupo
 */
async function sendMessage(sock, chatId, message, senderId) {
  const title = "👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ💃🎶🍾🍸";
  const fullMessage = `${title}\n\n${message}`;
  await sock.sendMessage(chatId, { 
    text: fullMessage, 
    mentions: [senderId] 
  });
}

/**
 * Remove um usuário do grupo
 */
async function banUser(sock, groupId, userId) {
  await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
}

/**
 * Busca as regras do grupo na descrição
 */
async function getGroupDescription(sock, groupId) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    return metadata.desc || '📜 *Regras não disponíveis na descrição do grupo*';
  } catch (error) {
    console.error('❌ Erro ao buscar descrição do grupo:', error.message);
    return '📜 *Regras não disponíveis na descrição do grupo*';
  }
}

// ============================================
// LÓGICA PRINCIPAL DE ADVERTÊNCIAS
// ============================================

/**
 * Processa a advertência do usuário
 */
async function tratarAdvertencia(sock, groupId, userId) {
  let groupMetadata;
  
  try {
    groupMetadata = await sock.groupMetadata(groupId);
  } catch (err) {
    console.error("Erro ao obter metadados do grupo:", err);
    return;
  }

  const participante = groupMetadata.participants.find(p => p.id === userId);

  if (!participante) {
    await sendMessage(
      sock,
      groupId,
      `O usuário @${userId.split('@')[0]} não está mais neste grupo. Nenhuma advertência aplicada.`,
      userId
    );
    return;
  }

  const count = await incrementAdvertencia(userId, groupId);
  console.log(`Incrementando advertência para ${userId} no grupo ${groupId}. Total: ${count}/3`);

  // Usuário atingiu 3 advertências - banir
  if (count >= 3) {
    await banUser(sock, groupId, userId);
    await sendMessage(
      sock,
      groupId,
      `@${userId.split('@')[0]} completou 3 advertências e foi removido(a) do grupo ❌.

Mesmo após as advertências anteriores, continuou infringindo as regras estabelecidas. O respeito às normas do grupo é fundamental para a convivência de todos.

*Fiquem ligados!!!*`,
      userId
    );
    await resetAdvertencia(userId, groupId);
  } 
  // Usuário recebeu advertência
  else {
    // PRIMEIRA MENSAGEM: Aviso de advertência
    await sendMessage(
      sock,
      groupId,
      `@${userId.split('@')[0]}, 𝗩𝗢𝗖𝗘 𝗜𝗡𝗙𝗥𝗜𝗡𝗚𝗜𝗨 𝗨𝗠𝗔 𝗗𝗔𝗦 𝗥𝗘𝗚𝗥𝗔𝗦 𝗗𝗢 𝗚𝗥𝗨𝗣𝗢 𝗘 𝗥𝗘𝗖𝗘𝗕𝗘𝗨 𝗦𝗨𝗔 𝗔𝗗𝗩𝗘𝗥𝗧𝗘𝗡𝗖𝗜𝗔.
 ${count}/3 ⚠️

⚠️ 𝗔𝗢 𝗔𝗧𝗜𝗡𝗚𝗜𝗥 𝟯 𝗔𝗗𝗩𝗘𝗥𝗧𝗘𝗡𝗖𝗜𝗔𝗦, 𝗩𝗢𝗖𝗘̂ 𝗦𝗘𝗥𝗔 𝗥𝗘𝗠𝗢𝗩𝗜𝗗𝗢 𝗔𝗨𝗧𝗢𝗠𝗔𝗧𝗜𝗖𝗔𝗠𝗘𝗡𝗧𝗘 𝗗𝗢 𝗚𝗥𝗨𝗣𝗢
🚫👋

📋 Leia as regras do grupo abaixo para evitar futuras penalizações.`,
      userId
    );

    // SEGUNDA MENSAGEM: Regras do grupo (imediatamente)
    try {
      const regras = await getGroupDescription(sock, groupId);
      
      const regrasMessage = await sock.sendMessage(groupId, {
        text: `『🕺🍻 𝐑𝐄𝐆𝐑♞𝐒 ҉ 𝐃♛ ҉ 𝐆𝐑𝐔𝐏♛ 💃🍷』 \n\n
@${userId.split('@')[0]}, por favor leia atentamente as regras abaixo:


${regras}`,
        mentions: [userId]
      });

      console.log(`✅ Regras enviadas para @${userId.split('@')[0]}`);

      // TERCEIRA PARTE: Enviar 6 áudios imediatamente
      try {
        console.log('🎵 Carregando áudios do sistema de alertas...');
        const audios = await carregarAudios();
        
        if (audios && audios.length >= 6) {
          console.log(`🎵 Enviando 6 áudios para @${userId.split('@')[0]}`);
          await sendAudiosSequencialComResposta(
            sock, 
            groupId, 
            audios, 
            3,  // Começa do índice 3 (4º áudio)
            6,  // Envia 6 áudios
            regrasMessage,  // Responde a mensagem das regras
            userId  // Menciona o usuário infrator
          );
          console.log('✅ Áudios enviados com sucesso');
        } else {
          console.warn('⚠️ Não há áudios suficientes disponíveis');
        }
      } catch (error) {
        console.error('❌ Erro ao enviar áudios:', error);
      }

    } catch (error) {
      console.error('❌ Erro ao enviar regras:', error);
    }
  }
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

/**
 * Processa mensagens do grupo para detectar comandos #adv
 */
async function handleMessage(sock, message) {
  try {
    const { key, message: msg } = message;
    const from = key.remoteJid;
    const sender = key.participant || key.remoteJid;
    const botId = sock.user.id;

    console.log(`Mensagem recebida de ${sender} no grupo ${from}:`, msg);

    // ============================================
    // VERIFICAÇÃO DE COMANDO #adv
    // ============================================
    
    let isAdvCommand = false;

    // 1. Verificar imagem com caption #adv
    if (msg?.imageMessage?.caption?.includes('#adv')) {
      isAdvCommand = true;
    }

    // 2. Verificar resposta/quote com #adv
    if (msg?.extendedTextMessage?.text?.includes('#adv') && 
        msg?.extendedTextMessage?.contextInfo?.participant) {
      isAdvCommand = true;
    }

    // 3. Verificar menção direta com #adv
    const messageContent = msg?.conversation || msg?.extendedTextMessage?.text;
    if (messageContent) {
      if (/^#adv\s+@/.test(messageContent) || /^@[^\s]+\s+#adv/.test(messageContent)) {
        isAdvCommand = true;
      }
    }

    // Se não for comando #adv, ignorar
    if (!isAdvCommand) {
      return;
    }

    // ============================================
    // VERIFICAÇÃO DE PERMISSÃO (ADMIN)
    // ============================================

    let isAdmin = false;
    let groupMetadata;
    
    try {
      groupMetadata = await sock.groupMetadata(from);
      isAdmin = groupMetadata.participants.some(
        p => p.id === sender && p.admin
      );
    } catch (err) {
      console.error("Erro ao verificar admin:", err);
    }

    if (!isAdmin) {
      await sendMessage(
        sock,
        from,
        `@${sender.split('@')[0]}, você não possui permissão para executar este comando 🚫👨🏻‍✈️.  
Este recurso é exclusivo dos administradores do grupo.`,
        sender
      );
      return;
    }

    // Deletar mensagem do comando
    await deleteCommandMessage(sock, from, key);

    // ============================================
    // PROCESSAMENTO DO COMANDO #adv
    // ============================================

    // Caso 1: #adv em imagem
    if (msg?.imageMessage) {
      const imageCaption = msg.imageMessage.caption;
      if (imageCaption?.includes('#adv')) {
        const imageSender =
          msg.imageMessage.context?.participant ||
          msg.imageMessage.context?.key?.participant ||
          key.participant ||
          key.remoteJid;

        if (imageSender && imageSender !== botId) {
          await tratarAdvertencia(sock, from, imageSender);
        }
        return;
      }
    }

    // Caso 2: #adv em resposta/quote
    if (msg?.extendedTextMessage) {
      const commentText = msg.extendedTextMessage.text;
      if (commentText?.includes('#adv')) {
        const quotedMessage = msg.extendedTextMessage.contextInfo;
        
        if (quotedMessage?.participant) {
          const originalSender = quotedMessage.participant;

          if (originalSender && originalSender !== botId) {
            // Deletar mensagem original
            const originalMessageKey = {
              remoteJid: from,
              fromMe: false,
              id: quotedMessage.stanzaId,
              participant: originalSender
            };
            
            await deleteCommandMessage(sock, from, originalMessageKey);
            await tratarAdvertencia(sock, from, originalSender);
          }
          return;
        }
      }
    }

    // Caso 3: #adv com menção direta
    if (messageContent) {
      // Padrão: #adv @nome
      const pattern1 = /^#adv\s+@([^\s]+)/;
      const match1 = messageContent.match(pattern1);
      
      if (match1) {
        const mentionedUserName = match1[1].trim().toLowerCase();
        const userToWarn = groupMetadata.participants.find(p =>
          p.id.toLowerCase().includes(mentionedUserName.replace(/ /g, ''))
        );

        if (userToWarn && userToWarn.id !== botId) {
          await tratarAdvertencia(sock, from, userToWarn.id);
        }
        return;
      }

      // Padrão: @nome #adv
      const pattern2 = /^@([^\s]+)\s+#adv/;
      const match2 = messageContent.match(pattern2);
      
      if (match2) {
        const mentionedUserName = match2[1].trim().toLowerCase();
        const userToWarn = groupMetadata.participants.find(p =>
          p.id.toLowerCase().includes(mentionedUserName)
        );

        if (userToWarn && userToWarn.id !== botId) {
          await tratarAdvertencia(sock, from, userToWarn.id);
        }
        return;
      }
    }

  } catch (error) {
    console.error('Erro ao processar mensagem de advertência:', error);
  }
}

// ============================================
// EXPORTAÇÃO
// ============================================

export { 
  handleMessage,
  carregarAudios,
  sendAudiosSequencialComResposta
};