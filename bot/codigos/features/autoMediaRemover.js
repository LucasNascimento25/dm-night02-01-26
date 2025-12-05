// autoMediaRemover.js - Remove FOTOS e VÍDEOS automaticamente
// 🔄 Sistema otimizado - REMOVE DE TODOS (participantes E admins)
// ✅ VERSÃO CORRIGIDA - Funciona no WhatsApp Web

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class AutoMediaRemover {
  constructor(sock, ownerNumber) {
    this.sock = sock;
    this.ownerNumber = ownerNumber;
    
    this.config = {
      removePhotos: true,
      removeVideos: true,
      notifyOwner: false,
      exemptAdmins: false,
      whitelistGroups: [],
      deleteDelay: 500, // Reduzido para ser mais rápido
      allowedCaption: '👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ💃🎶🍾🍸',
      debugMode: false
    };
    
    this.stats = {
      photosRemoved: 0,
      videosRemoved: 0,
      errors: 0
    };
    
    this.pendingMedia = new Map();
    this.groupDelay = 2000;
  }

  async processMessage(msg) {
    try {
      const { key, message, messageTimestamp } = msg;
      
      if (!key || !message) {
        if (this.config.debugMode) {
          console.log('⚠️ Mensagem inválida - sem key ou message');
        }
        return;
      }

      const chatId = key.remoteJid;
      const senderId = key.participant || key.remoteJid;

      // Apenas em grupos
      if (!chatId || !chatId.endsWith('@g.us')) {
        return;
      }

      // Ignora grupos na whitelist
      if (this.config.whitelistGroups.includes(chatId)) {
        return;
      }

      // Ignora mensagens do próprio bot
      if (key.fromMe) {
        return;
      }

      // Detecta tipo de mensagem corretamente
      const messageType = this.getMessageType(message);

      if (!messageType) {
        return;
      }

      // 🔍 DEBUG MODE - Mostra estrutura completa
      if (this.config.debugMode) {
        console.log('\n🔍 ==================== DEBUG MODE ====================');
        console.log('📱 Tipo de mensagem:', messageType);
        console.log('👤 Remetente:', senderId.split('@')[0]);
        console.log('🆔 Chat ID:', chatId);
        console.log('🔑 Message Key:', JSON.stringify(key, null, 2));
        console.log('📋 ESTRUTURA COMPLETA DA MENSAGEM:');
        console.log(JSON.stringify(message, null, 2));
        console.log('🔍 ==================================================\n');
      }

      // 🔍 Verifica se tem legenda permitida
      if (this.hasAllowedCaption(message, messageType)) {
        console.log(`✅ Mídia com legenda permitida - NÃO será removida`);
        return;
      }

      // 📸 FOTOS ou 🎥 VÍDEOS
      if (
        (messageType === 'imageMessage' && this.config.removePhotos) ||
        (messageType === 'videoMessage' && this.config.removeVideos)
      ) {
        console.log(`🎯 Detectada mídia: ${messageType} de ${senderId.split('@')[0]}`);
        await this.handleMedia(chatId, senderId, key, messageType);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mídia:', error);
      this.stats.errors++;
    }
  }

  getMessageType(message) {
    // Verifica todos os tipos possíveis de mídia
    if (message.imageMessage) return 'imageMessage';
    if (message.videoMessage) return 'videoMessage';
    
    // Verifica mensagens encaminhadas ou com viewOnce
    if (message.viewOnceMessage) {
      const viewOnceMsg = message.viewOnceMessage.message;
      if (viewOnceMsg?.imageMessage) return 'imageMessage';
      if (viewOnceMsg?.videoMessage) return 'videoMessage';
    }
    
    if (message.viewOnceMessageV2) {
      const viewOnceMsg = message.viewOnceMessageV2.message;
      if (viewOnceMsg?.imageMessage) return 'imageMessage';
      if (viewOnceMsg?.videoMessage) return 'videoMessage';
    }

    if (message.viewOnceMessageV2Extension) {
      const viewOnceMsg = message.viewOnceMessageV2Extension.message;
      if (viewOnceMsg?.imageMessage) return 'imageMessage';
      if (viewOnceMsg?.videoMessage) return 'videoMessage';
    }

    return null;
  }

  hasAllowedCaption(message, messageType) {
    try {
      let caption = null;

      // Extrai a legenda baseado no tipo de mensagem
      if (messageType === 'imageMessage' && message.imageMessage) {
        caption = message.imageMessage.caption;
      } else if (messageType === 'videoMessage' && message.videoMessage) {
        caption = message.videoMessage.caption;
      }

      // Verifica viewOnce messages
      if (message.viewOnceMessage) {
        const viewOnceMsg = message.viewOnceMessage.message;
        if (viewOnceMsg?.imageMessage?.caption) {
          caption = viewOnceMsg.imageMessage.caption;
        } else if (viewOnceMsg?.videoMessage?.caption) {
          caption = viewOnceMsg.videoMessage.caption;
        }
      }

      if (message.viewOnceMessageV2) {
        const viewOnceMsg = message.viewOnceMessageV2.message;
        if (viewOnceMsg?.imageMessage?.caption) {
          caption = viewOnceMsg.imageMessage.caption;
        } else if (viewOnceMsg?.videoMessage?.caption) {
          caption = viewOnceMsg.videoMessage.caption;
        }
      }

      if (message.viewOnceMessageV2Extension) {
        const viewOnceMsg = message.viewOnceMessageV2Extension.message;
        if (viewOnceMsg?.imageMessage?.caption) {
          caption = viewOnceMsg.imageMessage.caption;
        } else if (viewOnceMsg?.videoMessage?.caption) {
          caption = viewOnceMsg.videoMessage.caption;
        }
      }

      if (!caption) {
        if (this.config.debugMode) {
          console.log('⚠️ Mídia SEM legenda - será removida');
        }
        return false;
      }

      // 🔧 REMOVE formatação do WhatsApp (negrito, itálico, etc)
      const cleanWhatsAppFormatting = (text) => {
        return text
          .replace(/\*([^*]+)\*/g, '$1')  // Remove *negrito*
          .replace(/_([^_]+)_/g, '$1')    // Remove _itálico_
          .replace(/~([^~]+)~/g, '$1')    // Remove ~riscado~
          .replace(/```([^`]+)```/g, '$1') // Remove ```código```
          .replace(/`([^`]+)`/g, '$1');   // Remove `monospace`
      };

      // 🔍 Pega apenas a PRIMEIRA LINHA da legenda (até o primeiro \n)
      const firstLine = caption.split('\n')[0].trim();
      const firstLineClean = cleanWhatsAppFormatting(firstLine);
      
      // 🔍 Normaliza a legenda esperada também
      const allowedClean = cleanWhatsAppFormatting(this.config.allowedCaption.trim());

      // 🔍 DEBUG DETALHADO (apenas se debugMode ativado)
      if (this.config.debugMode) {
        console.log('🔍 ==================== VERIFICAÇÃO DE LEGENDA ====================');
        console.log('📝 Caption completa:', caption.substring(0, 100) + '...');
        console.log('📝 Primeira linha original:', firstLine);
        console.log('📝 Primeira linha limpa:', firstLineClean);
        console.log('📝 Esperado limpo:', allowedClean);
        console.log('🔍 ================================================================\n');
      }

      // ✅ Comparação da primeira linha (sem formatação)
      const isMatch = firstLineClean === allowedClean;

      if (isMatch) {
        console.log(`✅ LEGENDA PERMITIDA ENCONTRADA - Mídia NÃO será removida`);
        if (this.config.debugMode) {
          console.log(`   Primeira linha: "${firstLineClean}"`);
        }
      } else {
        console.log(`❌ Legenda DIFERENTE - Mídia será removida`);
        if (this.config.debugMode) {
          console.log(`   Recebido: "${firstLineClean}"`);
          console.log(`   Esperado: "${allowedClean}"`);
        }
      }

      return isMatch;
    } catch (error) {
      console.error('❌ Erro ao verificar legenda:', error);
      return false;
    }
  }

  async handleMedia(chatId, senderId, messageKey, messageType) {
    try {
      // Aguarda um pouco antes de deletar
      await new Promise(resolve => setTimeout(resolve, this.config.deleteDelay));

      // 🗑️ Tenta deletar a mensagem com múltiplas estratégias
      let deleted = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!deleted && attempts < maxAttempts) {
        try {
          attempts++;
          
          if (this.config.debugMode) {
            console.log(`🔄 Tentativa ${attempts} de deletar mídia...`);
            console.log('🔑 Usando messageKey:', JSON.stringify(messageKey, null, 2));
          }
          
          // 🔥 MÉTODO CORRETO para deletar mensagens de OUTROS no grupo
          await this.sock.sendMessage(chatId, { 
            delete: {
              remoteJid: chatId,
              fromMe: false,
              id: messageKey.id,
              participant: messageKey.participant || senderId
            }
          });
          
          deleted = true;
          console.log(`✅ Mídia deletada com sucesso na tentativa ${attempts}`);
          
        } catch (error) {
          console.error(`❌ Tentativa ${attempts} falhou:`, error.message);
          
          if (attempts < maxAttempts) {
            // Aguarda progressivamente mais tempo entre tentativas
            await new Promise(resolve => setTimeout(resolve, 500 * attempts));
          } else {
            this.stats.errors++;
            console.error('❌ Falha ao deletar após 3 tentativas');
            if (this.config.debugMode) {
              console.error('📋 MessageKey completo:', JSON.stringify(messageKey, null, 2));
              console.error('📋 Erro completo:', error);
            }
          }
        }
      }

      // Se conseguiu deletar, adiciona ao grupo para notificação
      if (deleted) {
        await this.addToGroup(chatId, senderId, messageType);
      }
    } catch (error) {
      console.error('❌ Erro ao processar deleção:', error);
      this.stats.errors++;
    }
  }

  async addToGroup(chatId, senderId, messageType) {
    const groupKey = `${chatId}_${senderId}`;

    if (!this.pendingMedia.has(groupKey)) {
      this.pendingMedia.set(groupKey, {
        chatId,
        senderId,
        photos: 0,
        videos: 0,
        timeout: null
      });
    }

    const group = this.pendingMedia.get(groupKey);

    if (messageType === 'imageMessage') {
      group.photos++;
      this.stats.photosRemoved++;
    } else if (messageType === 'videoMessage') {
      group.videos++;
      this.stats.videosRemoved++;
    }

    if (group.timeout) {
      clearTimeout(group.timeout);
    }

    group.timeout = setTimeout(async () => {
      await this.processMediaGroup(groupKey);
    }, this.groupDelay);
  }

  async processMediaGroup(groupKey) {
    const group = this.pendingMedia.get(groupKey);
    if (!group) return;

    const { chatId, senderId, photos, videos } = group;
    this.pendingMedia.delete(groupKey);

    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      let mensagem = `⚠️ *ATENÇÃO!*\n\n`;
      const numero = senderId.split('@')[0];
      mensagem += `@${numero}, `;

      const itens = [];
      if (photos > 0) itens.push(`${photos} foto${photos > 1 ? 's' : ''}`);
      if (videos > 0) itens.push(`${videos} vídeo${videos > 1 ? 's' : ''}`);
      
      mensagem += `${itens.join(' e ')} removida${(photos + videos) > 1 ? 's' : ''}.\n\n`;
      mensagem += `📋 𝗥𝗘𝗚𝗥𝗔: Fotos e vídeos só com 𝗩𝗜𝗦𝗨𝗔𝗟𝗜𝗭𝗔𝗖̧𝗔𝗢 𝗨𝗡𝗜𝗖𝗔.\n\n`;
      mensagem += `✅ Isso garante privacidade e segurança de todos(as)! 💜✨🔐`;

      await this.sock.sendMessage(chatId, {
        text: mensagem,
        mentions: [senderId]
      });

      console.log(`✅ Notificação enviada - Fotos: ${photos}, Vídeos: ${videos}`);

      if (this.config.notifyOwner) {
        await this.sock.sendMessage(this.ownerNumber, {
          text: `🚫 *MÍDIAS REMOVIDAS*\n\n📍 Grupo: ${chatId}\n👤 Usuário: ${numero}\n📸 Fotos: ${photos}\n🎥 Vídeos: ${videos}\n⏰ ${new Date().toLocaleString('pt-BR')}`
        });
      }
    } catch (error) {
      console.error('❌ Erro ao processar grupo de mídias:', error);
      this.stats.errors++;
    }
  }

  getStats() {
    return {
      '📸 Fotos removidas': this.stats.photosRemoved,
      '🎥 Vídeos removidos': this.stats.videosRemoved,
      '📊 Total de mídias': this.stats.photosRemoved + this.stats.videosRemoved,
      '❌ Erros': this.stats.errors
    };
  }

  // Métodos de configuração
  setDebugMode(value) {
    this.config.debugMode = value;
    console.log(`🔍 Modo DEBUG: ${value ? 'ATIVADO ✅' : 'DESATIVADO ❌'}`);
    if (value) {
      console.log('📋 O bot mostrará TODA a estrutura das mensagens recebidas');
    }
  }

  setRemovePhotos(value) {
    this.config.removePhotos = value;
    console.log(`📸 Remoção de fotos: ${value ? 'ATIVADA' : 'DESATIVADA'}`);
  }

  setRemoveVideos(value) {
    this.config.removeVideos = value;
    console.log(`🎥 Remoção de vídeos: ${value ? 'ATIVADA' : 'DESATIVADA'}`);
  }

  setNotifyOwner(value) {
    this.config.notifyOwner = value;
    console.log(`📢 Notificar dono: ${value ? 'ATIVADO' : 'DESATIVADO'}`);
  }

  setDeleteDelay(ms) {
    this.config.deleteDelay = ms;
    console.log(`⏱️ Delay de deleção: ${ms}ms`);
  }

  setGroupDelay(ms) {
    this.groupDelay = ms;
    console.log(`⏱️ Delay de agrupamento: ${ms}ms`);
  }

  setAllowedCaption(caption) {
    this.config.allowedCaption = caption;
    console.log(`✅ Legenda permitida atualizada: "${caption}"`);
  }

  getAllowedCaption() {
    return this.config.allowedCaption;
  }

  addWhitelistGroup(groupId) {
    if (!this.config.whitelistGroups.includes(groupId)) {
      this.config.whitelistGroups.push(groupId);
      console.log(`✅ Grupo adicionado à whitelist: ${groupId}`);
    }
  }

  removeWhitelistGroup(groupId) {
    const index = this.config.whitelistGroups.indexOf(groupId);
    if (index > -1) {
      this.config.whitelistGroups.splice(index, 1);
      console.log(`❌ Grupo removido da whitelist: ${groupId}`);
    }
  }

  getConfig() {
    return {
      '📸 Remove fotos': this.config.removePhotos ? '✅' : '❌',
      '🎥 Remove vídeos': this.config.removeVideos ? '✅' : '❌',
      '👮 Remove de admins': '✅ SIM',
      '📢 Notifica dono': this.config.notifyOwner ? '✅' : '❌',
      '⏱️ Delay deleção': `${this.config.deleteDelay}ms`,
      '⏱️ Delay agrupamento': `${this.groupDelay}ms`,
      '📋 Grupos na whitelist': this.config.whitelistGroups.length,
      '✅ Legenda permitida': this.config.allowedCaption,
      '🔍 Debug mode': this.config.debugMode ? '✅' : '❌'
    };
  }

  resetStats() {
    this.stats.photosRemoved = 0;
    this.stats.videosRemoved = 0;
    this.stats.errors = 0;
    console.log('📊 Estatísticas resetadas');
  }
}