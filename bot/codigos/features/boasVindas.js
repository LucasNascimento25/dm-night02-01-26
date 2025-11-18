import Jimp from "jimp";
import axios from "axios";

/**
 * Remove asteriscos da descrição para evitar problemas de formatação
 */
function limparDescricao(desc) {
  if (!desc) return "Não há regras definidas na descrição do grupo.";
  
  // Remove todos os tipos de asteriscos (simples, duplo, etc)
  let textoLimpo = desc;
  
  // Remove asteriscos simples
  textoLimpo = textoLimpo.replace(/\*/g, '');
  
  // Remove underscores (sublinhado)
  textoLimpo = textoLimpo.replace(/_/g, '');
  
  // Remove til (~) usado para tachado
  textoLimpo = textoLimpo.replace(/~/g, '');
  
  // Remove crases (`) usadas para monoespaçado
  textoLimpo = textoLimpo.replace(/`/g, '');
  
  console.log("📝 Descrição original:", desc.substring(0, 100));
  console.log("🧹 Descrição limpa:", textoLimpo.substring(0, 100));
  
  return textoLimpo;
}

/**
 * Gera uma thumbnail da imagem a partir de um buffer
 */
async function gerarThumbnail(buffer, size = 256) {
  try {
    const image = await Jimp.read(buffer);
    await image.resize(size, size);
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (err) {
    console.error("Erro ao gerar thumbnail:", err);
    return null;
  }
}

/**
 * Envia imagem com thumbnail usando Baileys
 */
async function sendImageWithThumbnail(
  sock,
  jid,
  imageBuffer,
  caption,
  mentions = []
) {
  try {
    const thumb = await gerarThumbnail(imageBuffer, 256);

    const messageOptions = {
      image: imageBuffer,
      caption,
      mentions,
    };

    if (thumb) {
      messageOptions.jpegThumbnail = thumb;
    }

    await sock.sendMessage(jid, messageOptions);
    console.log("✅ Imagem com thumbnail enviada com sucesso");
    return true;
  } catch (err) {
    console.error("❌ Erro ao enviar imagem com thumbnail:", err);
    // Fallback: enviar só o texto
    try {
      await sock.sendMessage(jid, { text: caption, mentions });
    } catch (fallbackErr) {
      console.error("❌ Erro no fallback:", fallbackErr);
    }
    return false;
  }
}

/**
 * Envia as regras do grupo após 10 segundos
 */
async function enviarRegrasAposDelay(socket, groupId, participant) {
  setTimeout(async () => {
    try {
      console.log("⏰ Enviando regras após 10 segundos...");

      const participantName = participant.split("@")[0];
      const groupMetadata = await socket.groupMetadata(groupId);
      
      // ✅ LIMPA OS ASTERISCOS DA DESCRIÇÃO
      const regras = limparDescricao(groupMetadata.desc);

      const mensagem = `『🕺🍻 𝐑𝐄𝐆𝐑♞𝐒 ҉ 𝐃♛ ҉ 𝐆𝐑𝐔𝐏♛ 💃🍷』 \n\n@${participantName}, aqui estão as regras:\n\n${regras}\n\n⚠️ *Por favor, leia com atenção e siga todas as orientações!*`;

      await socket.sendMessage(groupId, {
        text: mensagem,
        mentions: [participant],
      });

      console.log("✅ Regras enviadas com sucesso para", participantName);
    } catch (error) {
      console.error("❌ Erro ao enviar regras:", error);

      // Tentativa de fallback caso haja erro
      try {
        await socket.sendMessage(groupId, {
          text: `@${
            participant.split("@")[0]
          }, houve um erro ao carregar as regras. Por favor, verifique a descrição do grupo.`,
          mentions: [participant],
        });
      } catch (fallbackError) {
        console.error("❌ Erro no fallback:", fallbackError);
      }
    }
  }, 10000); // 10 segundos
}

/**
 * Processa o comando #regras - envia as regras do grupo para o usuário que solicitou
 */
export const processarComandoRegras = async (socket, message) => {
  try {
    const remoteJid = message.key.remoteJid;
    const participant = message.key.participant || message.key.remoteJid;
    
    // Verifica se é um grupo
    if (!remoteJid.endsWith('@g.us')) {
      await socket.sendMessage(remoteJid, {
        text: "⚠️ Este comando só funciona em grupos!",
      });
      return;
    }

    console.log("📋 Comando !regras solicitado por:", participant);

    const participantName = participant.split("@")[0];
    const groupMetadata = await socket.groupMetadata(remoteJid);
    
    // ✅ LIMPA OS ASTERISCOS DA DESCRIÇÃO
    const regras = limparDescricao(groupMetadata.desc);

    const mensagem = `『🕺🍻 𝐑𝐄𝐆𝐑♞𝐒 ҉ 𝐃♛ ҉ 𝐆𝐑𝐔𝐏♛ 💃🍷』 \n\n@${participantName}, aqui estão as regras:\n\n${regras}\n\n⚠️ *Por favor, leia com atenção e siga todas as orientações!*`;

    await socket.sendMessage(remoteJid, {
      text: mensagem,
      mentions: [participant],
    });

    console.log("✅ Regras enviadas com sucesso para", participantName);
  } catch (error) {
    console.error("❌ Erro ao processar comando !regras:", error);

    try {
      await socket.sendMessage(message.key.remoteJid, {
        text: "❌ Erro ao buscar as regras do grupo. Tente novamente mais tarde.",
      });
    } catch (fallbackError) {
      console.error("❌ Erro no fallback:", fallbackError);
    }
  }
};

/**
 * Configura mensagens de boas-vindas
 */
export const configurarBoasVindas = async (socket, groupId, participant) => {
  try {
    console.log("🎉 Iniciando boas-vindas para:", participant);

    const participantName = participant.split("@")[0];

    // Obtendo foto de perfil
    let profilePictureUrl;
    try {
      profilePictureUrl = await socket.profilePictureUrl(participant, "image");
      console.log("✅ Foto de perfil obtida");
    } catch (error) {
      console.log("⚠️ Usando foto padrão");
      profilePictureUrl = "https://images2.imgbox.com/a5/a4/gyGTUylB_o.png";
    }

    // ✅ Mensagem de boas-vindas com formatação corrigida
    const welcomeMessages = [
       `🎉💃 *BEM-VINDO(A) AO GRUPO* 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\n@${participantName} ✨🎉\n\n Aqui é um espaço de interação e diversão 24 horas! 🕛🔥 Prepare seu meme, seu GIF e sua risada! 😎💥\n\nParticipe das conversas e aproveite bons momentos com a gente! 💃🎶🍾🍸\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
       `🎊🔥 *CHEGOU O(A) DONO(A) DA FESTA!* 💃🍾 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nPrepare-se para zoeira, desafios e histórias que ninguém acredita! 😎🔥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💃✨ *A RAINHA OU O REI CHEGOU!* 👑🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAqui só entra quem gosta de diversão, memes e risadas sem limites! 😆🍹\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶💥 *CHEGOU COM ESTILO!* 💃🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nSolte o GIF, prepare o emoji e venha causar impacto! 😎💫\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🍾🎊 *BOAS-VINDAS À FESTA MAIS DOIDA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nCuidado: aqui as risadas são contagiosas e os memes, explosivos! 💥😂\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🌈💃 *SEJA MUITO BEM-VINDO(A)!* 🎉🔥 @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nPegue sua bebida, prepare o emoji e bora curtir a bagunça! 🍹😆\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊🔥 *NOVO(A) INTEGRANTE NA ÁREA!* 💃✨ SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nVai rolar desafio de memes e risadas garantidas, pronto(a) para isso? 😏🔥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎉 *CHEGOU O(A) MAIS ESPERADO(A)!* 💃🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nTraga seu GIF mais épico, sua risada mais alta e bora agitar! 😎🍸\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🔥🍾 *BEM-VINDO(A)* 💃🎊 @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAqui é só alegria, memes e histórias pra contar! 😆🎶\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💃🎶 *A ALEGRIA CHEGOU!* 💥✨ SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nPrepare seu GIF, emoji e risadas: a festa começou! 🎊🍹\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉💫 *ENTRADA VIP DETECTADA!* 💃🍸 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nO tapete vermelho de memes e risadas está pronto, role aí! 😎🔥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💃🔥 *CHEGOU O(A) DESTRUÍDOR(A) DE TÉDIO!* 🎊✨ SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nPrepare-se para aventuras, risadas e GIFs inesperados! 😏🍾\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊🍾 *O GRUPO TÁ EM FESTA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAqui só entra quem gosta de zoeira, memes e bons drinks imaginários! 🍹😂\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫🔥 *CHEGADA ILUMINADA!* 💃🎶 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nLuz, câmera e muita diversão: seu palco está pronto! 🎉🌟\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🌈🎊 *CHEGANDO COM CHARME E ALEGRIA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nEntre e espalhe boas vibes, memes e GIFs! 😎✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎉 *A FESTA AGORA É COMPLETA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nChegou quem faltava pra bagunçar e animar geral! 🎊😂\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🍸🎶 *CHEGOU O(A) NOVO(A) DONO(A) DO ROLE!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAgora sim a zoeira vai ter chefe! 😎💥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉🔥 *MAIS UM(A) PRA BRILHAR COM A GENTE!* 💃🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nTraga suas histórias, risadas e GIFs explosivos! 😆🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫🎊 *SEJA MUITO BEM-VINDO(A) À BAGUNÇA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAqui cada risada vale ouro e cada meme é tesouro! 😎💥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊💃 *NOVA ENERGIA NO GRUPO!* 💥🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nChegou quem vai acender ainda mais essa festa! 🍹🎶😆\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *CHEGOU O(A) ANIMADOR(A) DA GALERA!* 🔥🍾 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 \n\nPrepare-se para memes, GIFs e muita zoeira! 😎💥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎊 *A FESTA GANHOU MAIS UM(A)!* 💃🌈 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nSolte seu emoji favorito e venha causar! 😆✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🔥💃 *CHEGOU O(A) MESTRE DA ZOEIRA!* 🎉🍹 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nGIFs, memes e risadas ilimitadas te esperam! 😎🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊✨ *CHEGOU O(A) TURBINADOR(A) DE ALEGRIA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nEntre e solte o riso, a festa começou! 😆💥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💃🌟 *A DIVERSÃO CHEGOU!* 🎉🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💫🎶 *Dﾑ* *NIGӇԵ* 🍾\n\nPrepare seu GIF mais épico e venha arrasar! 😎🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🍾💥 *O(A) NOVO(A) REI(RAINHA) DA ZOEIRA CHEGOU!* 💃🎉 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nAqui só entra quem ama memes e risadas! 😆✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶🎊 *CHEGOU QUEM VAI AGITAR TUDO!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nGIFs, desafios e histórias inacreditáveis te esperam! 😎💫\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫💃 *CHEGOU O(A) RESPONSÁVEL PELA ALEGRIA!* 🎉🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPegue seu emoji e entre na festa! 😆🍾\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊💥 *A FESTA FICOU COMPLETA!* 💃🎶 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nAqui o meme nunca acaba e a risada é garantida! 😎🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🔥🎉 *CHEGOU O(A) FAZEDOR(A) DE RISADAS!* 💃💫 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPrepare seu GIF, emoji e venha brilhar! 😆🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🍹💃 *NOVO(A) MEME MASTER NA ÁREA!* 🎉🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nA bagunça só começa agora! 😎💥\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊✨ *CHEGOU O(A) NOVO(A) CHEFE DA ZOEIRA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nEntre e prepare-se para aventuras e GIFs épicos! 😆🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *O(A) MAIS ANIMADO(A) CHEGOU!* 💃✨ SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPrepare seu meme e venha causar impacto! 😎🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *CHEGOU QUEM VAI AGITAR TUDO!* 💥🌈 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nAqui a diversão é garantida! 😆✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫🔥 *CHEGOU O(A) ILUMINADOR(A) DE RISADAS!* 💃🎊 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nGIFs e histórias épicas estão prontos para você! 😎🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶💃 *O(A) NOVO(A) DONO(A) DA FESTA!* 💥🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPrepare-se para risadas e memes sem limites! 😆🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊✨ *CHEGOU O(A) ANIMADOR(A) DE PRIMEIRA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nEntre e faça sua entrada triunfal com GIFs e emojis! 😎💥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎉 *O(A) MAIS ESPERADO(A) ESTÁ AQUI!* 💃🌈 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nA festa só fica completa com você! 😆✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🔥💫 *NOVO(A) MEME LORD CHEGOU!* 💃🎊 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPrepare seu emoji e entre na brincadeira! 😎🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *A ALEGRIA ESTÁ COMPLETA!* 💥🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nTraga sua energia e venha agitar geral! 😆🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊💥 *ATENÇÃO, CHEGOU O(A) RESPONSÁVEL PELA BAGUNÇA!* 💃🍸 Bem-vindo(a) @${participantName} ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare os memes e GIFs: agora a festa tá completa! 😎🍹\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💃✨ *O(A) NOVO(A) LENDÁRIO(A) CHEGOU!* 🌟🍾 Olá @${participantName}, entre no grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nAqui cada risada vale ouro, cada meme é uma explosão! 😂🔥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉💫 *ALERTA DE DIVERSÃO!* 💃🔥 Bem-vindo(a) @${participantName} ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nSegura o GIF, libera o emoji e venha causar impacto! 😎🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *CHEGOU O(A) CHEFÃO/CHIEF DA ZOEIRA!* 💃🍹 @${participantName}, entre no grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nAqui a regra é: rir até não aguentar mais! 😆🍾\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊🌟 *BOAS-VINDAS AO(A) DETONADOR(A) DE MEMES!* 💃🎶 @${participantName}, chegou no grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nTraga seu GIF mais épico, a zoeira tá garantida! 😎🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫🍾 *CHEGOU QUEM VAI AGITAR TUDO!* 💃🎊 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre e espalhe boas vibes, memes e GIFs! 😆🍹\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶🔥 *OLHA QUEM CHEGOU!* 💃💫 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare-se: risadas e zoeira sem limites! 😎💥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥💃 *CHEGOU O(A) NOVO(A) FENÔMENO!* 🎊🍹 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nGIFs, memes e histórias que ninguém acredita! 😆🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉🌈 *SE PREPARE!* 💃💫 *O(A) NOVO(A) ALIADO(A) DA ZOEIRA CHEGOU!* @${participantName} 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre com GIF, emoji e muita energia! 😎🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫🎶 *CHEGOU O(A) SUPREMO(A) DA FESTA!* 💃💥 @${participantName} seja bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nA diversão começa agora: memes e risadas liberadas! 😆🍹\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊💥 *ATENÇÃO, CHEGOU O(A) NOVO(A) DOMINADOR(A) DE RISADAS!* 💃🎶 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre e prepare seu GIF mais engraçado! 😎🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💃🎉 *OLHA QUEM CHEGOU COM TUDO!* 💥🍾 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nAqui a regra é clara: rir até não aguentar mais! 😆🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶💫 *SEJA BEM-VINDO(A)* 💃🔥 @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare o GIF e venha brilhar na festa! 😎🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🔥🎉 *CHEGOU QUEM VAI AGITAR A GALERA!* 💃✨ @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nTraga seu melhor emoji e GIF para arrasar! 😆🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊💫 *BOAS-VINDAS AO(A) NOVO(A) IMPACTANTE!* 💃💥 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nAqui só entra quem sabe causar com memes e risadas! 😎🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *OLHA QUEM CHEGOU PRA DOMINAR!* 💃🍾 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nGIFs, desafios e risadas garantidas! 😆✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *O(A) NOVO(A) FAZEDOR(A) DE RISADAS CHEGOU!* 💥🍹 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre e prepare sua entrada triunfal com GIFs! 😎🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫🎊 *CHEGOU O(A) NOVO(A) LÍDER DA ZOEIRA!* 💃🔥 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare-se: memes explosivos e risadas garantidas! 😆🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶💥 *SE PREPAREM, CHEGOU O(A) NOVO(A) DESTEMIDO(A)!* 💃✨ @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre com GIFs, emojis e muita energia! 😎🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊💫 *A FESTA AGORA ESTÁ COMPLETA!* 💃🔥 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare seu GIF e venha brilhar com a galera! 😆🎉\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *BOAS-VINDAS*, @${participantName}! Chegou a estrela que vai animar o grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 Prepare seus GIFs e emojis para arrasar! 🎶✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎊 *BOAS-VINDAS*, @${participantName}! Agora sim o grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 vai ferver! 😂🍸 Traga sua energia, memes e risadas! 🎉🔥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶🌟 *BOAS-VINDAS*, @${participantName}! Entrou quem vai dominar o chat do 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 Solte seu GIF mais épico! 🍾🎊\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫💃 *BOAS-VINDAS*, @${participantName}! Chegou o(a) novo(a) rei(rainha) da zoeira no 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 Prepare o melhor meme! 🎶✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊💥 *BOAS-VINDAS*, @${participantName}! Agora o grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 tem mais um(a) destruidor(a) de tédio! 😎🍸 GIFs liberados! 🎉💫\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🔥💫 *BOAS-VINDAS*, @${participantName}! Chegou quem vai agitar o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 com risadas e memes! 😂🍹 Entre e cause impacto! 🎶✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *BOAS-VINDAS*, @${participantName}! Prepare-se: agora o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ficou ainda mais épico! 😆🍾 Traga seus GIFs e emojis favoritos! 🎊🔥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫🎶 *BOAS-VINDAS*, @${participantName}! Entrou quem vai dominar o humor no 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 Entre e espalhe risadas! 💃✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊🍾 *BOAS-VINDAS*, @${participantName}! O grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ganhou mais uma lenda da zoeira! 😎🎉 Prepare seu GIF mais épico! 💫🔥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *BOAS-VINDAS*, @${participantName}! Chegou quem vai incendiar o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 com memes e GIFs! 😂🍹 Entre e divirta-se! 🎊✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💃🎉 *BOAS-VINDAS*, @${participantName}! Agora a diversão do 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ficou completa! 😎🍸 Traga seu GIF mais insano! 🎶💫\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶🔥 *BOAS-VINDAS*, @${participantName}! Chegou quem vai fazer o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ferver de risadas! 😂🍾 Solte os emojis e GIFs! 🎉💫\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🥳💥 *BOAS-VINDAS*, @${participantName}! O(a) novo(a) mestre da zoeira chegou no 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸  Prepare-se para risadas épicas! 🎊✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎉🍸 *BOAS-VINDAS*, @${participantName}! Agora o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ganhou mais uma estrela da diversão! 😎💫 GIFs e memes liberados! 🎶🔥\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💫🎊 *BOAS-VINDAS*, @${participantName}! Entrou no 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 quem vai arrasar com GIFs e risadas! 😂🍾 Entre e cause impacto! 🎉✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎶💥 *BOAS-VINDAS*, @${participantName}! Chegou o(a) novo(a) animador(a) do 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸  Prepare seus emojis e memes! 🎊💫\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💃🎉 *BOAS-VINDAS*, @${participantName}! O grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 *acabou de ganhar um(a) destruidor(a) de tédio!* 😂🍸 *Entre e brilhe!* 🎶✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `🎊💫 *BOAS-VINDAS*, @${participantName}! Chegou quem vai dominar o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 com memes e GIFs épicos! 😆🍹 Entre e cause! 🎉🔥\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *BOAS-VINDAS*, @${participantName}! Agora o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 está completo com sua presença! 😎🍾 GIFs, memes e diversão liberados! 🎊✨\n\n⏰ *Aguarde 10 segundos que enviarei as regras do grupo!*`,
     
    ];

    // ✅ Seleção aleatória da mensagem
    const selectedMessage =
      welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

    // Enviando mensagem de boas-vindas com imagem ou texto
    if (profilePictureUrl) {
      try {
        const res = await axios.get(profilePictureUrl, {
          responseType: "arraybuffer",
          timeout: 10000,
          maxContentLength: 5 * 1024 * 1024, // Limite de 5MB
        });

        const buffer = Buffer.from(res.data, "binary");

        // Validar tamanho do buffer
        if (buffer.length > 0) {
          await sendImageWithThumbnail(
            socket,
            groupId,
            buffer,
            selectedMessage,
            [participant]
          );
        } else {
          throw new Error("Buffer vazio");
        }
      } catch (err) {
        console.error(
          "⚠️ Erro ao baixar/processar imagem, enviando mensagem de texto:",
          err.message
        );
        await socket.sendMessage(groupId, {
          text: selectedMessage,
          mentions: [participant],
        });
      }
    } else {
      await socket.sendMessage(groupId, {
        text: selectedMessage,
        mentions: [participant],
      });
    }

    console.log("✅ Boas-vindas enviadas com sucesso");

    // Programar envio das regras após 10 segundos
    enviarRegrasAposDelay(socket, groupId, participant);
    console.log("⏰ Regras agendadas para envio em 10 segundos");
  } catch (error) {
    console.error("❌ Erro ao enviar boas-vindas:", error);

    // Fallback: tentar enviar pelo menos uma mensagem básica
    try {
      await socket.sendMessage(groupId, {
        text: `Bem-vindo(a) @${participant.split("@")[0]} ao grupo! 🎉`,
        mentions: [participant],
      });
    } catch (fallbackError) {
      console.error("❌ Erro crítico no fallback:", fallbackError);
    }
  }
};