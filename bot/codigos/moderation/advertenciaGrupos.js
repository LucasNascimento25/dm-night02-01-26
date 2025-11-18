import pool from '../../../db.js';

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
    await sendMessage(
      sock,
      groupId,
      `@${userId.split('@')[0]}, você infringiu uma das regras do grupo e recebeu sua advertência ${count}/3 ⚠️

📋 REGRAS PROIBIDAS:

❌ INVADIR O PRIVADO DOS MEMBROS SEM PERMISSÃO
🚫 NÃO É PERMITIDO ACESSAR OU ENVIAR MENSAGENS PARA O PRIVADO DE OUTRO MEMBRO SEM CONSENTIMENTO EXPLÍCITO NO GRUPO

❌ ENVIAR FOTOS OU VÍDEOS DE ÓRGÃOS GENITAIS SEM VISUALIZAÇÃO ÚNICA
🚫

❌ COMPARTILHAR PRINTS DE CONVERSAS PRIVADAS OU TRAZER ASSUNTOS DO PRIVADO PARA O GRUPO
💬 NAMOROS, BRIGAS, CIÚMES, ETC.

❌ PUBLICAR IMAGENS, STICKERS OU FIGURINHAS DE CRIANÇAS / CONTEÚDO ENVOLVENDO MENORES
👶❌

❌ COMPARTILHAR CONTEÚDO RELACIONADO A DROGAS ILÍCITAS
💊❌

❌ QUALQUER MATERIAL DE PEDOFILIA OU ABUSO INFANTIL
🚫👶

❌ CONTEÚDO DE VIOLÊNCIA EXPLÍCITA OU GORE
🔪⚰️❌

❌ DISCURSO DE ÓDIO, RACISMO OU QUALQUER TIPO DE DISCRIMINAÇÃO
✋🚫

❌ PROMOVER DISCUSSÕES OU BRIGAS NO GRUPO
🤬⚡

⚠️ AO ATINGIR 3 ADVERTÊNCIAS, VOCÊ SERÁ REMOVIDO AUTOMATICAMENTE DO GRUPO
🚫👋`,
      userId
    );
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

export { handleMessage };