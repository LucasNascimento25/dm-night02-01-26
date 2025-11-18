// cartoonsHandler.js - SISTEMA DE CARTOONS COM NAVEGAÇÃO POR PÁGINAS
import fetch from 'node-fetch';
import axios from 'axios';
import Jimp from 'jimp';

console.log('✅ cartoonsHandler.js CARREGADO!');

// URL do seu repositório GitHub
const URL_CARTOONS = 'https://raw.githubusercontent.com/LucasNascimento25/cartoons/main/cartoons/cartoons.json';

// Cache dos cartoons em memória
let cartoons = [];
let ultimaAtualizacao = null;

// Armazena o cartoon atual de cada usuário para navegação
const sessoesUsuarios = new Map();

/**
 * Função para gerar thumbnail com Jimp
 */
async function gerarThumbnail(buffer, size = 256) {
    try {
        const image = await Jimp.read(buffer);
        image.scaleToFit(size, size);
        return await image.getBufferAsync(Jimp.MIME_JPEG);
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

/**
 * Função para baixar e processar imagem com Jimp
 */
async function baixarImagemComJimp(url) {
    try {
        console.log(`🖼️ Baixando imagem: ${url}`);
        
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*'
            },
            maxRedirects: 5,
            validateStatus: (status) => status === 200
        });

        const imageBuffer = Buffer.from(response.data);
        console.log(`📦 Buffer baixado: ${imageBuffer.length} bytes`);

        if (imageBuffer.length < 5000) {
            console.log(`⚠️ Imagem muito pequena (${imageBuffer.length} bytes)`);
            return null;
        }

        const image = await Jimp.read(imageBuffer);
        console.log(`📐 Dimensões originais: ${image.getWidth()}x${image.getHeight()}`);
        
        const maxWidth = 1280;
        const maxHeight = 1280;
        
        if (image.getWidth() > maxWidth || image.getHeight() > maxHeight) {
            console.log(`🔧 Redimensionando...`);
            image.scaleToFit(maxWidth, maxHeight);
            console.log(`✅ Nova dimensão: ${image.getWidth()}x${image.getHeight()}`);
        }

        const processedBuffer = await image
            .quality(90)
            .getBufferAsync(Jimp.MIME_JPEG);

        console.log(`✅ Imagem processada: ${processedBuffer.length} bytes`);
        
        if (processedBuffer.length > 5 * 1024 * 1024) {
            console.log(`⚠️ Imagem muito grande, reduzindo qualidade...`);
            return await image.quality(75).getBufferAsync(Jimp.MIME_JPEG);
        }
        
        return processedBuffer;

    } catch (error) {
        console.error(`❌ Erro ao baixar/processar imagem:`, error.message);
        return null;
    }
}

/**
 * Carrega os cartoons do GitHub
 */
async function carregarCartoons() {
    try {
        console.log('🔄 Iniciando carregamento dos cartoons...');
        const response = await fetch(URL_CARTOONS);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const dados = await response.json();
        cartoons = dados.cartoons || [];
        ultimaAtualizacao = new Date();
        
        console.log(`✅ ${cartoons.length} cartoons carregados com sucesso!`);
        console.log('🎬 Cartoons disponíveis:', cartoons.map(c => c.titulo).join(', '));
        return true;
    } catch (error) {
        console.error('❌ Erro ao carregar cartoons:', error);
        return false;
    }
}

/**
 * Retorna a lista de cartoons formatada
 */
function listarCartoons() {
    console.log('📋 listarCartoons() chamado. Total:', cartoons.length);
    
    if (cartoons.length === 0) {
        return '❌ Nenhum cartoon disponível no momento.';
    }

    let lista = '🎬 *CARTOONS DISPONÍVEIS*\n\n';
    cartoons.forEach((cartoon, index) => {
        lista += `${index + 1}. *${cartoon.titulo}*\n`;
        if (cartoon.categoria) {
            lista += `   _${cartoon.categoria}_\n`;
        }
        if (cartoon.paginas) {
            lista += `   📖 ${cartoon.paginas.length} páginas\n`;
        }
    });
    lista += '\n💡 Digite *#cartoon [número]* para visualizar um cartoon\n';
    lista += 'Exemplo: #cartoon 1';

    return lista;
}

/**
 * Inicia a leitura de um cartoon específico (mostra página 1)
 */
async function iniciarCartoon(sock, remoteJid, numero, message) {
    const index = parseInt(numero) - 1;
    
    if (isNaN(index) || index < 0 || index >= cartoons.length) {
        return await sock.sendMessage(remoteJid, {
            text: `❌ Número inválido! Temos ${cartoons.length} cartoons disponíveis.\nUse *#cartoons* para ver a lista.`
        }, { quoted: message });
    }

    const cartoon = cartoons[index];
    
    if (!cartoon.paginas || cartoon.paginas.length === 0) {
        return await sock.sendMessage(remoteJid, {
            text: `❌ Este cartoon não possui páginas disponíveis.`
        }, { quoted: message });
    }

    // Salva a sessão do usuário
    sessoesUsuarios.set(remoteJid, {
        cartoonIndex: index,
        paginaAtual: 1,
        totalPaginas: cartoon.paginas.length
    });

    // Mostra a primeira página
    await mostrarPaginaCartoon(sock, remoteJid, 1, message);
}

/**
 * Mostra uma página específica do cartoon atual do usuário
 */
async function mostrarPaginaCartoon(sock, remoteJid, numeroPagina, message) {
    const sessao = sessoesUsuarios.get(remoteJid);
    
    if (!sessao) {
        return await sock.sendMessage(remoteJid, {
            text: `❌ Você não está lendo nenhum cartoon!\nUse *#cartoons* para ver a lista e *#cartoon [número]* para começar.`
        }, { quoted: message });
    }

    const cartoon = cartoons[sessao.cartoonIndex];
    const pagina = parseInt(numeroPagina);
    
    if (isNaN(pagina) || pagina < 1 || pagina > cartoon.paginas.length) {
        return await sock.sendMessage(remoteJid, {
            text: `❌ Página inválida! Este cartoon tem ${cartoon.paginas.length} páginas.\nUse *#pagcartoon [número]* (exemplo: #pagcartoon 1)`
        }, { quoted: message });
    }

    // Atualiza página atual na sessão
    sessao.paginaAtual = pagina;

    const urlPagina = cartoon.paginas[pagina - 1];
    console.log(`📖 Mostrando página ${pagina}/${cartoon.paginas.length} do cartoon "${cartoon.titulo}"`);

    // Baixa e processa a imagem
    const imageBuffer = await baixarImagemComJimp(urlPagina);
    
    if (!imageBuffer) {
        return await sock.sendMessage(remoteJid, {
            text: `❌ Erro ao carregar a página ${pagina}. Tente novamente.`
        }, { quoted: message });
    }

    // Monta a legenda
    let caption = `🎬 *${cartoon.titulo}*\n\n`;
    if (cartoon.categoria) {
        caption += `_${cartoon.categoria}_\n`;
    }
    caption += `\n📄 Página ${pagina} de ${cartoon.paginas.length}\n`;
    caption += `───────────────\n`;
    
    // Instruções de navegação
    if (pagina < cartoon.paginas.length) {
        caption += `➡️ Próxima: *#pagcartoon ${pagina + 1}*\n`;
    }
    if (pagina > 1) {
        caption += `⬅️ Anterior: *#pagcartoon ${pagina - 1}*\n`;
    }
    caption += `🔢 Ir para: *#pagcartoon [número]*\n`;
    caption += `🏠 Voltar: *#cartoons*`;

    try {
        const thumb = await gerarThumbnail(imageBuffer, 256);
        
        await sock.sendMessage(remoteJid, {
            image: imageBuffer,
            caption: caption,
            jpegThumbnail: thumb,
            contextInfo: {
                stanzaId: message.key.id,
                participant: message.key.participant || message.key.remoteJid,
                quotedMessage: message.message
            }
        });
        
        console.log(`✅ Página ${pagina} enviada com sucesso!`);
    } catch (err) {
        console.error('❌ Erro ao enviar página:', err.message);
        await sock.sendMessage(remoteJid, {
            text: `❌ Erro ao enviar a imagem. Tente novamente.`
        }, { quoted: message });
    }
}

/**
 * Retorna um cartoon aleatório (primeira página)
 */
async function cartoonAleatorio(sock, remoteJid, message) {
    if (cartoons.length === 0) {
        return await sock.sendMessage(remoteJid, {
            text: '❌ Nenhum cartoon disponível no momento.'
        }, { quoted: message });
    }

    const indexAleatorio = Math.floor(Math.random() * cartoons.length);
    await iniciarCartoon(sock, remoteJid, (indexAleatorio + 1).toString(), message);
}

/**
 * Busca cartoons por categoria
 */
function buscarPorCategoria(categoria) {
    const cartoonsFiltrados = cartoons.filter(c => 
        c.categoria && c.categoria.toLowerCase().includes(categoria.toLowerCase())
    );

    if (cartoonsFiltrados.length === 0) {
        return `❌ Nenhum cartoon encontrado na categoria "${categoria}"`;
    }

    let lista = `🎬 *CARTOONS - ${categoria.toUpperCase()}*\n\n`;
    cartoonsFiltrados.forEach((cartoon) => {
        const numeroOriginal = cartoons.indexOf(cartoon) + 1;
        lista += `${numeroOriginal}. *${cartoon.titulo}*\n`;
        if (cartoon.paginas) {
            lista += `   📖 ${cartoon.paginas.length} páginas\n`;
        }
    });
    lista += `\n💡 Use *#cartoon [número]* para ler`;

    return lista;
}

/**
 * Handler principal para Baileys - processa comandos
 */
export async function handleCartoons(sock, message) {
    try {
        console.log('\n🎯 ========= handleCartoons CHAMADO =========');
        
        let texto = '';
        if (message.message.conversation) {
            texto = message.message.conversation;
        } else if (message.message.extendedTextMessage?.text) {
            texto = message.message.extendedTextMessage.text;
        } else if (message.message.imageMessage?.caption) {
            texto = message.message.imageMessage.caption;
        } else {
            return false;
        }

        console.log('💬 Texto original:', texto);
        texto = texto.toLowerCase().trim();
        
        const remoteJid = message.key.remoteJid;
        console.log('📱 RemoteJid:', remoteJid);

        // Comando: #cartoons - Lista todos
        if (texto === '#cartoons') {
            console.log('✅ Comando #cartoons reconhecido!');
            const resposta = listarCartoons();
            await sock.sendMessage(remoteJid, { 
                text: resposta 
            }, { quoted: message });
            return true;
        }

        // Comando: #cartoon [numero] - Inicia leitura do cartoon
        if (texto.startsWith('#cartoon ')) {
            console.log('✅ Comando #cartoon reconhecido!');
            const numero = texto.replace('#cartoon ', '').trim();
            await iniciarCartoon(sock, remoteJid, numero, message);
            return true;
        }

        // Comando: #pagcartoon [numero] - Navega para página específica
        if (texto.startsWith('#pagcartoon ')) {
            console.log('✅ Comando #pagcartoon reconhecido!');
            const numero = texto.replace('#pagcartoon ', '').trim();
            await mostrarPaginaCartoon(sock, remoteJid, numero, message);
            return true;
        }

        // Comando: #proximacartoon - Próxima página
        if (texto === '#proximacartoon' || texto === '#proxcartoon') {
            console.log('✅ Comando #proximacartoon reconhecido!');
            const sessao = sessoesUsuarios.get(remoteJid);
            if (sessao) {
                const proximaPag = sessao.paginaAtual + 1;
                await mostrarPaginaCartoon(sock, remoteJid, proximaPag, message);
            } else {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Você não está lendo nenhum cartoon!\nUse *#cartoons* para ver a lista.'
                }, { quoted: message });
            }
            return true;
        }

        // Comando: #anteriorcartoon - Página anterior
        if (texto === '#anteriorcartoon' || texto === '#antcartoon') {
            console.log('✅ Comando #anteriorcartoon reconhecido!');
            const sessao = sessoesUsuarios.get(remoteJid);
            if (sessao) {
                const anteriorPag = sessao.paginaAtual - 1;
                await mostrarPaginaCartoon(sock, remoteJid, anteriorPag, message);
            } else {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Você não está lendo nenhum cartoon!\nUse *#cartoons* para ver a lista.'
                }, { quoted: message });
            }
            return true;
        }

        // Comando: #aleatoriocartoon - Cartoon aleatório
        if (texto === '#aleatoriocartoon' || texto === '#randomcartoon') {
            console.log('✅ Comando #aleatoriocartoon reconhecido!');
            await cartoonAleatorio(sock, remoteJid, message);
            return true;
        }

        // Comando: #categoriacartoon [nome]
        if (texto.startsWith('#categoriacartoon ')) {
            console.log('✅ Comando #categoriacartoon reconhecido!');
            const categoria = texto.replace('#categoriacartoon ', '').trim();
            const resposta = buscarPorCategoria(categoria);
            await sock.sendMessage(remoteJid, { 
                text: resposta 
            }, { quoted: message });
            return true;
        }

        // Comando: #atualizarcartoons
        if (texto === '#atualizarcartoons') {
            console.log('✅ Comando #atualizarcartoons reconhecido!');
            await sock.sendMessage(remoteJid, { 
                text: '🔄 Atualizando cartoons...' 
            }, { quoted: message });
            
            const sucesso = await carregarCartoons();
            const resposta = sucesso 
                ? `✅ Cartoons atualizados!\nTotal: ${cartoons.length} cartoons`
                : '❌ Erro ao atualizar cartoons. Tente novamente.';
            
            await sock.sendMessage(remoteJid, { 
                text: resposta 
            }, { quoted: message });
            return true;
        }

        // Comando: #ajudacartoons
        if (texto === '#ajudacartoons' || texto === '#helpcartoons') {
            console.log('✅ Comando #ajudacartoons reconhecido!');
            const resposta = `🎬 *COMANDOS DE CARTOONS*\n\n` +
                       `*#cartoons* - Lista todos os cartoons\n` +
                       `*#cartoon [número]* - Inicia leitura de um cartoon\n` +
                       `*#pagcartoon [número]* - Vai para página específica\n` +
                       `*#proximacartoon* - Próxima página\n` +
                       `*#anteriorcartoon* - Página anterior\n` +
                       `*#aleatoriocartoon* - Cartoon aleatório\n` +
                       `*#categoriacartoon [nome]* - Cartoons de uma categoria\n` +
                       `*#atualizarcartoons* - Atualizar Cartoons\n` +
                       `*#ajudacartoons* - Esta mensagem\n\n` +
                       `📊 Total de cartoons: ${cartoons.length}\n\n` +
                       `💡 *Como usar:*\n` +
                       `1. Digite *#cartoons* para ver a lista\n` +
                       `2. Escolha um cartoon: *#cartoon 1*\n` +
                       `3. Navegue: *#pagcartoon 2*, *#pagcartoon 3*, etc.`;
            
            await sock.sendMessage(remoteJid, { 
                text: resposta 
            }, { quoted: message });
            return true;
        }

        console.log('❌ Nenhum comando de cartoon reconhecido');
        return false;
        
    } catch (error) {
        console.error('❌ Erro no handleCartoons:', error);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Inicializar carregando os cartoons
console.log('🚀 Iniciando carregamento inicial dos cartoons...');
carregarCartoons();

// Exportar funções
export {
    carregarCartoons,
    listarCartoons,
    buscarPorCategoria
};