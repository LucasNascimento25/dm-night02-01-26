// menuDamasHandler.js
const menuDamasHandler = async (sock, message, chatId) => {
    const menuText = `
👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸

╔══════════════════════════
║ 🎪 *MENU DE ENTRETENIMENTO*
║ 
║ Cᴏᴍᴀɴᴅᴏꜱ ʟɪʙᴇʀᴀᴅᴏꜱ ᴘᴀʀᴀ ᴅɪᴠᴇʀꜱãᴏ
║ ᴇ ᴇɴᴛʀᴇᴛᴇɴɪᴍᴇɴᴛᴏ ᴅᴏ ɢʀᴜᴘᴏ!
╚══════════════════════════

┏━━━━━━━━━━━━━━━━━━━━━━━
┃ 🎨 *STICKERS PERSONALIZADOS*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ 🖼️ *#stickerdamas*
┃ └ Cria sticker de imagem/vídeo
┃    (responda uma mídia)
┃
┃ 🖼️ *#stickerdamas [texto]*
┃ └ Cria sticker com texto
┃    (responda uma imagem)
┃    ⚠️ Texto em vídeos não suportado
┃
┃ 📝 *Exemplos:*
┃ • #stickerdamas
┃ • #stickerdamas Lucas
┃ • #stickerdamas leozinho
┃
┗━━━━━━━━━━━━━━━━━━━━━━━

┏━━━━━━━━━━━━━━━━━━━━━━━
┃ 📋 *HORÓSCOPO*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ 🔮 *#signos*
┃ └ Lista todos os signos do zodíaco
┃    com suas datas
┃
┃ 🔮 *#horoscopo [signo]*
┃ └ Consulta o horóscopo do dia
┃
┃ 🔮 *#horoscopo [signo] [período]*
┃ └ Consulta horóscopo específico
┃
┃ 📝 *Exemplos:*
┃ • #horoscopo áries hoje
┃ • #horoscopo leão amanhã
┃ • #horoscopo peixes ontem
┃
┗━━━━━━━━━━━━━━━━━━━━━━━

┏━━━━━━━━━━━━━━━━━━━━━━━
┃ 📚 *HQS (QUADRINHOS ADULTOS)* 🔞
┣━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ 📖 *#hqs*
┃ └ Lista todos os HQs disponíveis
┃
┃ 📖 *#hq [número]*
┃ └ Inicia a leitura de um HQ
┃
┃ 📖 *#pag [número]*
┃ └ Navega para uma página específica
┃
┃ 📖 *#randomhq*
┃ └ Seleciona um HQ aleatório
┃
┃ 📖 *#atualizarhqs*
┃ └ Atualiza a biblioteca de HQs
┃
┃ 📖 *#ajudahqs*
┃ └ Exibe ajuda sobre HQs
┃
┗━━━━━━━━━━━━━━━━━━━━━━━

┏━━━━━━━━━━━━━━━━━━━━━━━
┃ 🎵 *MÚSICA*
┣━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ 🎶 *#damas music [música - cantor/banda]*
┃ └ Busca e envia música
┃
┃ 🎶 *#damas musica [música - cantor/banda]*
┃ └ Busca e envia música
┃
┃ 📝 *Exemplos:*
┃ • #damas music Bohemian Rhapsody - Queen
┃ • #damas musica Imagine - John Lennon
┃
┗━━━━━━━━━━━━━━━━━━━━━━━

┏━━━━━━━━━━━━━━━━━━━━━━━
┃ 📚 *CONTOS PICANTES* 🌶️🔥
┣━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ 📖 *#contos*
┃ └ Lista todos os contos
┃
┃ 📖 *#ler [número]*
┃ └ Lê um conto específico
┃
┃ 📖 *#aleatorio*
┃ └ Envia um conto aleatório
┃
┃ 📖 *#atualizarcontos*
┃ └ Atualiza a lista de contos
┃
┃ 📖 *#ajudacontos*
┃ └ Mostra ajuda sobre contos
┃
┗━━━━━━━━━━━━━━━━━━━━━━━

╔══════════════════════════
║ 💡 *COMO USAR*
║ 
║ • Digite o comando começando com #
║ • Onde aparecer [texto], substitua
║   pelo valor desejado
║ • NÃO digite os colchetes [ ]
║ 
║ ❌ Errado: #horoscopo [áries]
║ ✅ Certo: #horoscopo áries
║
╚══════════════════════════

✨ _Aproveite e divirta-se!_ ✨

© *Damas da Night*
`;

    await sock.sendMessage(chatId, { 
        text: menuText 
    }, { 
        quoted: message 
    });
};

// ✅ Exportar usando ES Modules (compatível com import/export)
export default menuDamasHandler;