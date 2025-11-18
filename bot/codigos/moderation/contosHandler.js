// contosHandler.js - VERSÃO CORRIGIDA COM FORMATAÇÃO MELHORADA
import fetch from 'node-fetch';
import axios from 'axios';
import Jimp from 'jimp';

console.log('✅ contosHandler.js CARREGADO!');

// URL do seu repositório GitHub
const URL_CONTOS = 'https://raw.githubusercontent.com/LucasNascimento25/meus-contos/main/contos/contos.json';

// Cache dos contos em memória
let contos = [];
let ultimaAtualizacao = null;

/**
 * Função para gerar thumbnail com Jimp (mantém proporção original)
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
            timeout: 10000,
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
        const maxHeight = 720;
        
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
 * Carrega os contos do GitHub
 */
async function carregarContos() {
    try {
        console.log('🔄 Iniciando carregamento dos contos...');
        const response = await fetch(URL_CONTOS);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const dados = await response.json();
        contos = dados.contos || [];
        ultimaAtualizacao = new Date();
        
        console.log(`✅ ${contos.length} contos carregados com sucesso!`);
        console.log('📚 Contos disponíveis:', contos.map(c => c.titulo).join(', '));
        return true;
    } catch (error) {
        console.error('❌ Erro ao carregar contos:', error);
        return false;
    }
}

/**
 * Formata o texto adicionando espaços entre parágrafos - VERSÃO AVANÇADA
 */
function formatarTexto(texto) {
    // Valida se é uma string
    if (!texto || typeof texto !== 'string') {
        console.warn('⚠️ formatarTexto recebeu valor inválido:', typeof texto);
        return '';
    }
    
    console.log('🔧 Formatando texto... Tamanho original:', texto.length);
    console.log('🔍 Primeiros 100 caracteres:', texto.substring(0, 100));
    
    // Remove espaços extras no início e fim
    let textoFormatado = texto.trim();
    
    // Normaliza quebras de linha (Windows para Unix)
    textoFormatado = textoFormatado.replace(/\r\n/g, '\n');
    
    // Remove múltiplas quebras consecutivas (mais de 3)
    textoFormatado = textoFormatado.replace(/\n{4,}/g, '\n\n\n');
    
    // Se o texto JÁ tem parágrafos bem separados (pelo menos 2 quebras), mantém
    if (textoFormatado.includes('\n\n')) {
        console.log('✅ Texto já possui parágrafos separados');
        // Limpa excesso de quebras mas mantém estrutura
        textoFormatado = textoFormatado.replace(/\n{3,}/g, '\n\n');
        return textoFormatado;
    }
    
    console.log('🔄 Texto sem parágrafos detectado, processando...');
    
    // ESTRATÉGIA 1: Detectar frases completas (termina com . ! ? seguido de espaço e letra maiúscula)
    // Adiciona quebra dupla após pontos finais seguidos de letra maiúscula
    textoFormatado = textoFormatado.replace(/([.!?])\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, '$1\n\n$2');
    
    // ESTRATÉGIA 2: Se ainda está tudo junto (sem quebras), força separação em sentenças
    if (!textoFormatado.includes('\n')) {
        console.log('⚠️ Texto totalmente junto, separando por sentenças...');
        
        // Separa em sentenças por ponto final
        textoFormatado = textoFormatado.replace(/\.\s+/g, '.\n\n');
        
        // Remove quebras indevidas (ex: "Dr." não deve quebrar)
        textoFormatado = textoFormatado.replace(/(Dr|Sr|Sra|Prof)\.\n\n/g, '$1. ');
    }
    
    // ESTRATÉGIA 3: Se tem quebras simples, transforma em duplas
    if (textoFormatado.includes('\n') && !textoFormatado.includes('\n\n')) {
        console.log('🔄 Convertendo quebras simples em duplas...');
        
        // Divide em linhas
        const linhas = textoFormatado
            .split('\n')
            .map(linha => linha.trim())
            .filter(linha => linha.length > 0);
        
        console.log(`📝 Total de linhas: ${linhas.length}`);
        
        // Junta com quebra dupla
        textoFormatado = linhas.join('\n\n');
    }
    
    // Limpeza final
    textoFormatado = textoFormatado
        .replace(/  +/g, ' ')           // Remove espaços múltiplos
        .replace(/\n{3,}/g, '\n\n')     // Remove quebras excessivas
        .trim();
    
    console.log('✅ Formatação concluída. Tamanho final:', textoFormatado.length);
    console.log('📊 Quebras duplas encontradas:', (textoFormatado.match(/\n\n/g) || []).length);
    
    return textoFormatado;
}

/**
 * Retorna a lista de contos formatada
 */
function listarContos() {
    console.log('📋 listarContos() chamado. Total:', contos.length);
    
    if (contos.length === 0) {
        return '❌ Nenhum conto disponível no momento.';
    }

    let lista = 'ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓\n';
    lista += '💃 ⃝⃕፝⃟𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱 ⸵░⃟😈\n';
    lista += '*CONTOS ERÓTICOS*\n';
    lista += '᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦\n';
    lista += '𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱\n';
    lista += '⃢ 🌶️🍓 ⃢\n';
    lista += '───𖡜ꦽ̸ོ˚￫───ཹ💃🔥 ݇-݈ °︠︠︠︠︠︠︠︠𖡬 ᭄\n\n';
    lista += '📚 *CONTOS DISPONÍVEIS*\n\n';
    
    contos.forEach((conto, index) => {
        lista += `${index + 1}. *${conto.titulo}*\n`;
    });
    
    lista += '\n💡 Digite *#ler 1* ou *#ler1* para ler um conto\n';
    lista += 'Exemplo: #ler 1\n\n';
    lista += '_© 𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱_';

    return lista;
}

/**
 * Retorna um conto específico pelo número
 */
function obterConto(numero) {
    const index = parseInt(numero) - 1;
    
    if (isNaN(index) || index < 0 || index >= contos.length) {
        return {
            sucesso: false,
            mensagem: `❌ Número inválido! Temos ${contos.length} contos disponíveis.\nUse *#contos* para ver a lista.`,
            conto: null
        };
    }

    const conto = contos[index];
    
    console.log('📝 Conto selecionado:', {
        titulo: conto.titulo,
        temConteudo: !!conto.conteudo,
        tipoConteudo: typeof conto.conteudo,
        tamanhoConteudo: conto.conteudo ? conto.conteudo.length : 0,
        temImagem: !!conto.imagem
    });
    
    // Garante que conteudo seja string e formata
    const conteudoString = String(conto.conteudo || '');
    const conteudoFormatado = formatarTexto(conteudoString);
    
    let mensagem = 'ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓\n';
    mensagem += '💃 ⃝⃕፝⃟𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱 ⸵░⃟😈\n';
    mensagem += '*CONTOS ERÓTICOS*\n';
    mensagem += '᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦\n';
    mensagem += '𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱\n';
    mensagem += '⃢ 🌶️🍓 ⃢\n';
    mensagem += '───𖡜ꦽ̸ོ˚￫───ཹ💃🔥 ݇-݈ °︠︠︠︠︠︠︠︠𖡬 ᭄\n\n';
    mensagem += `📖 *${conto.titulo}*\n\n`;
    mensagem += `${conteudoFormatado}\n\n`;
    mensagem += `───────────────\n`;
    mensagem += `📚 Conto ${numero} de ${contos.length}\n`;
    mensagem += `_© 𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱_`;

    return {
        sucesso: true,
        mensagem: mensagem,
        conto: conto
    };
}

/**
 * Retorna um conto aleatório
 */
function contoAleatorio() {
    if (contos.length === 0) {
        return {
            sucesso: false,
            mensagem: '❌ Nenhum conto disponível no momento.',
            conto: null
        };
    }

    const indexAleatorio = Math.floor(Math.random() * contos.length);
    const conto = contos[indexAleatorio];
    
    console.log('🎲 Conto aleatório selecionado:', conto.titulo);
    
    const conteudoString = String(conto.conteudo || '');
    const conteudoFormatado = formatarTexto(conteudoString);
    
    let mensagem = 'ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🌶️🍓\n';
    mensagem += '💃 ⃝⃕፝⃟𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱 ⸵░⃟😈\n';
    mensagem += '*CONTOS ERÓTICOS*\n';
    mensagem += '᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦\n';
    mensagem += '𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱\n';
    mensagem += '⃢ 🌶️🍓 ⃢\n';
    mensagem += '───𖡜ꦽ̸ོ˚￫───ཹ💃🔥 ݇-݈ °︠︠︠︠︠︠︠︠𖡬 ᭄\n\n';
    mensagem += `🎲 *CONTO ALEATÓRIO*\n\n`;
    mensagem += `📖 *${conto.titulo}*\n\n`;
    mensagem += `${conteudoFormatado}\n\n`;
    mensagem += `_© 𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱_`;

    return {
        sucesso: true,
        mensagem: mensagem,
        conto: conto
    };
}

/**
 * Handler principal para Baileys - processa comandos
 */
export async function handleContos(sock, message) {
    try {
        console.log('\n🎯 ========= handleContos CHAMADO =========');
        console.log('📦 Message keys:', Object.keys(message));
        console.log('📦 Message.message keys:', Object.keys(message.message || {}));
        
        let texto = '';
        if (message.message.conversation) {
            texto = message.message.conversation;
            console.log('✅ Texto extraído de conversation');
        } else if (message.message.extendedTextMessage?.text) {
            texto = message.message.extendedTextMessage.text;
            console.log('✅ Texto extraído de extendedTextMessage');
        } else if (message.message.imageMessage?.caption) {
            texto = message.message.imageMessage.caption;
            console.log('✅ Texto extraído de imageMessage');
        } else {
            console.log('❌ Nenhum texto encontrado na mensagem');
            return false;
        }

        console.log('💬 Texto original:', texto);
        texto = texto.toLowerCase().trim();
        console.log('💬 Texto processado:', texto);
        
        const remoteJid = message.key.remoteJid;
        console.log('📱 RemoteJid:', remoteJid);
        
        let resposta = null;

        // Comando: #contos - Lista todos
        if (texto === '#contos') {
            console.log('✅ Comando #contos reconhecido!');
            resposta = listarContos();
            await sock.sendMessage(remoteJid, { 
                text: resposta 
            }, { quoted: message });
        }

        // Comando: #ler [numero] - Aceita #ler1, #ler 1, #ler123, etc
        else if (texto.startsWith('#ler')) {
            console.log('✅ Comando #ler reconhecido!');
            // Remove '#ler' e pega o número (com ou sem espaço)
            let numero = texto.replace('#ler', '').trim();
            
            if (!numero) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Use: *#ler 1* ou *#ler1*\nExemplo: #ler 1' 
                }, { quoted: message });
                return true;
            }
            
            const resultado = obterConto(numero);
            
            if (resultado.sucesso && resultado.conto && resultado.conto.imagem) {
                console.log('📷 Conto tem imagem, baixando...');
                
                const imageBuffer = await baixarImagemComJimp(resultado.conto.imagem);
                
                if (imageBuffer) {
                    try {
                        const thumb = await gerarThumbnail(imageBuffer, 256);
                        
                        await sock.sendMessage(remoteJid, {
                            image: imageBuffer,
                            caption: resultado.mensagem,
                            jpegThumbnail: thumb,
                            contextInfo: {
                                stanzaId: message.key.id,
                                participant: message.key.participant || message.key.remoteJid,
                                quotedMessage: message.message
                            }
                        });
                        console.log('✅ Conto com imagem enviado!');
                    } catch (err) {
                        console.error('❌ Erro ao enviar imagem:', err.message);
                        await sock.sendMessage(remoteJid, { 
                            text: resultado.mensagem 
                        }, { quoted: message });
                    }
                } else {
                    console.log('⚠️ Falha no download, enviando apenas texto');
                    await sock.sendMessage(remoteJid, { 
                        text: resultado.mensagem 
                    }, { quoted: message });
                }
            } else {
                console.log('📝 Enviando conto sem imagem');
                await sock.sendMessage(remoteJid, { 
                    text: resultado.mensagem 
                }, { quoted: message });
            }
        }

        // Comando: #aleatorio ou #random - Conto aleatório
        else if (texto === '#aleatorio' || texto === '#random') {
            console.log('✅ Comando #aleatorio reconhecido!');
            const resultado = contoAleatorio();
            
            if (resultado.sucesso && resultado.conto && resultado.conto.imagem) {
                console.log('📷 Conto aleatório tem imagem, baixando...');
                
                const imageBuffer = await baixarImagemComJimp(resultado.conto.imagem);
                
                if (imageBuffer) {
                    try {
                        const thumb = await gerarThumbnail(imageBuffer, 256);
                        
                        await sock.sendMessage(remoteJid, {
                            image: imageBuffer,
                            caption: resultado.mensagem,
                            jpegThumbnail: thumb,
                            contextInfo: {
                                stanzaId: message.key.id,
                                participant: message.key.participant || message.key.remoteJid,
                                quotedMessage: message.message
                            }
                        });
                        console.log('✅ Conto aleatório com imagem enviado!');
                    } catch (err) {
                        console.error('❌ Erro ao enviar imagem:', err.message);
                        await sock.sendMessage(remoteJid, { 
                            text: resultado.mensagem 
                        }, { quoted: message });
                    }
                } else {
                    console.log('⚠️ Falha no download, enviando apenas texto');
                    await sock.sendMessage(remoteJid, { 
                        text: resultado.mensagem 
                    }, { quoted: message });
                }
            } else {
                console.log('📝 Enviando conto aleatório sem imagem');
                await sock.sendMessage(remoteJid, { 
                    text: resultado.mensagem 
                }, { quoted: message });
            }
        }

        // Comando: #atualizarcontos ou #atualizar
        else if (texto === '#atualizarcontos' || texto === '#atualizar') {
            console.log('✅ Comando #atualizarcontos reconhecido!');
            await sock.sendMessage(remoteJid, { 
                text: '🔄 Atualizando contos...' 
            }, { quoted: message });
            
            const sucesso = await carregarContos();
            resposta = sucesso 
                ? `✅ Contos atualizados!\nTotal: ${contos.length} contos`
                : '❌ Erro ao atualizar contos. Tente novamente.';
            
            await sock.sendMessage(remoteJid, { 
                text: resposta 
            }, { quoted: message });
        }

        // Comando: #ajudacontos
        else if (texto === '#ajudacontos') {
            console.log('✅ Comando #ajudacontos reconhecido!');
            resposta = `📚 *COMANDOS DE CONTOS*\n\n` +
                       `*#contos* - Lista todos os contos\n` +
                       `*#ler 1* ou *#ler1* - Lê um conto específico\n` +
                       `*#aleatorio* ou *#random* - Conto aleatório\n` +
                       `*#atualizarcontos* - Atualiza a lista de contos\n` +
                       `*#ajudacontos* - Esta mensagem\n\n` +
                       `📊 Total de contos: ${contos.length}`;
            
            await sock.sendMessage(remoteJid, { 
                text: resposta 
            }, { quoted: message });
        }

        else {
            console.log('❌ Nenhum comando reconhecido');
            console.log('========================================\n');
            return false;
        }

        console.log(`✅ Comando de conto executado: ${texto}`);
        console.log('========================================\n');
        return true;
        
    } catch (error) {
        console.error('❌ Erro no handleContos:', error);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Inicializar carregando os contos
console.log('🚀 Iniciando carregamento inicial dos contos...');
carregarContos();

// Exportar funções
export {
    carregarContos,
    listarContos,
    obterConto,
    contoAleatorio
};