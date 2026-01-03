// codigos/handlers/message/olhinhoHandler.js
// Handler para detectar e avisar quando alguém coloca reação de olhinho
// VERSÃO STANDALONE - NÃO USA githubCacheManager
// CORREÇÃO: Quote correto da mensagem original com olhinho

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ olhinhoHandler.js CARREGADO!');

// URL CORRETA DO REPOSITÓRIO GITHUB
const URL_AUDIOS_JSON = 'https://raw.githubusercontent.com/LucasNascimento25/olhinho-audio-bt/refs/heads/main/audios-bt.json';

// Cache dos áudios em memória
let audios = [];
let ultimaAtualizacao = null;

// Controle de rotação
let indiceAtual = 0;

export class OlhinhoHandler {
    constructor() {
        this.olhinhoEmojis = ['👁️', '👁', '👀'];
        this.processedReactions = new Set();
        
        // Array de mensagens em sequência
        this.mensagens = [
'👀 Ué, só o olho? O resto da cara ficou com preguiça?',
'😏 Olhinho sozinho? Vai revelar o resto quando, na próxima vida?',
'🤣 Tá de espiadinha ou tá escondendo o rosto por vergonha mesmo?',
'🙈 Manda o rosto todo, a gente não morde… pelo menos não muito!',
'😆 Só de olho? Tá economizando pixels pro resto da cara?',
'👁️ Olhinho fofo, mas a gente quer o pacote completo.',
'😂 Tá escondendo o resto da cara porque tá feio, né? Fala a verdade!',
'😏 Cara inteira é DLC ou é só preguiça mesmo?',
'🤣 Olho de paparazzi? Ou só preguiça de mostrar a cara?',
'🙃 Mais misterioso que isso só se mandar fumaça.',
'👀 Tá só espionando, ou vergonha mesmo?',
'😆 Um olho só? Quer deixar a gente curioso até quando?',
'😂 Olho de sardinha, cara de bagre?',
'🙈 Tá economizando o resto do rosto pra ocasião especial?',
'😏 Só o olho? Vai revelar o resto se a gente pagar ingresso?',
'🤣 Tá tímido(a), ou tá escondendo alguma coisa feia?',
'👁️ O resto da cara tá em quarentena, é?',
'😆 Olhinho fofo, mas cadê o sorriso?',
'😂 Só de olho? A preguiça venceu de novo, hein?',
'🙃 Tá de olho na fofoca ou no grupo só pra causar?',
'👀 Cadê a cara inteira? Sumiu na foto?',
'😏 Só olho? Tá virando meme sem querer, né?',
'🤣 Vai revelar o resto da cara ou é segredo de estado?',
'🙈 Olhinho escondido, vergonha total?',
'😆 Tá esperando a lua cheia pra mostrar o resto da cara?',
'😂 Um olho é pouco, queremos dois, pelo menos!',
'👁️ O resto da face tá em manutenção programada?',
'😏 Só olhando? Tá dando mole, hein!',
'🤣 Olhinho misterioso, suspense demais!',
'🙃 Tá escondendo o resto da cara porque tá feio?',
'👀 Ué, cara inteira é extra, né?',
'😆 Olhinho só? É preguiça de tirar a foto inteira?',
'😂 Tá com vergonha de quê? A gente também é feio!',
'🙈 Cara completa é só pra assinante premium, é?',
'😏 Um olho só? Fica difícil confiar assim!',
'🤣 Olho espião detectado, resto da cara desaparecido!',
'👁️ Tá tímido(a), ou só gosta de causar curiosidade?',
'😆 Olho de vidro ou preguiça mesmo?',
'😂 Manda o resto da cara antes que a gente faça meme!',
'🙃 Olhinho solitário, o resto da face em hibernação?',
'👀 Tá só observando, ou vergonha total mesmo?',
'😏 Só o olho? Vai revelar o resto em qual data?',
'🤣 Mais suspense que isso só se fechar o grupo inteiro!',
'🙈 Olhinho escondido, cara inteira escondida… timidez master!',
'😆 Tá preservando o resto da cara pra ocasião especial?',
'😂 Só o olho? Parece teaser de filme de terror!',
'👁️ Rosto completo tá em construção, é?',
'😏 Olhinho discreto, resto da cara desaparecido!',
'🤣 Tá tímido(a), ou tá escondendo a beleza que assusta?',
'🙃 Só o olho, hein? Tá dando trabalho pra gente adivinhar!',
'👀 Um olho só? Quer deixar a gente maluco de curiosidade?',
'😆 Olhinho tímido, cara inteira ausente!',
'😂 Rosto completo: função desativada, preguiça ativa!',
'🙈 Tá escondendo o resto da cara ou o Wi-Fi caiu?',
'😏 Só o olho? Tá dando show de mistério!',
'🤣 Olhinho de espionagem, cara inteira sumida!',
'👁️ Tá se preservando pro meme, é?',
'😆 Olho solitário, resto da cara em hibernação!',
'😂 Só olhando? Tá tímido(a) ou é malícia?',
'🙃 Um olho só? Suspense masterclass!',
'👀 Olhinho escondido, curiosidade ativada!',
'😏 Só de olho? Tá dando medo ou vergonha?',
'🤣 Olhinho tímido, resto da cara desaparecido!',
'🙈 Cara inteira escondida, só restou o olho?',
'😆 Olho solitário, suspense garantido!',
'😂 Tá preservando o resto da cara pra ocasião épica?',
'👁️ Só um olho? Vai revelar o resto se pagar entrada?',
'😏 Olhinho escondido, mistério máximo!',
'🤣 Só o olho? Tá deixando a gente maluco de curiosidade!',
'🙃 Cara completa é DLC, né?',
'👀 Olhinho tímido, cara inteira em hiato!',
'😆 Só o olho? Suspense total!',
'😂 Tá escondendo o resto da cara, vergonha master?',
'🙈 Olhinho curioso, resto da cara sumido!',
'😏 Um olho só? Tá testando nossa paciência?',
'🤣 Cara inteira? Em breve, quem sabe!',
'👁️ Só o olho? Suspense nível hard!',
'😆 Olhinho sozinho, cara completa ausente!',
'😂 Tá de espiadinha ou timidez total?',
'🙃 Só um olho? Quer deixar a gente maluco!',
'👀 Olhinho tímido, o resto da face sumido!',
'😏 Suspense demais, só um olho não é suficiente!',
'🤣 Cara completa em construção, só o olho pronto!',
'🙈 Tá economizando o resto da cara pro Black Friday?',
'😆 Olhinho de fora, resto da cara escondido!',
'😂 Só olhando? Vai revelar o resto ou vai morrer assim?',
'👁️ Um olho só? Quer provocar ou é timidez mesmo?',
'😏 Olhinho tímido, resto da cara ausente!',
'🤣 Cara inteira? Em modo stealth!',
'🙃 Olhinho solitário, suspense garantido!',
'👀 Só um olho? Tá zoando com a gente, né?',
'😆 Olhinho misterioso, cara completa sumida!',
'😂 Suspense master: só o olho visível!',
'🙈 Olhinho curioso, resto da face em hiato!',
'😏 Só olhando? Tá escondendo a beleza ou a feiura?',
'🤣 Um olho só, suspense infinito!',
'👁️ Cara inteira em construção, olhinho já pronto!',
'😆 Olhinho de fora, cara completa em manutenção!',
'😂 Só o olho? Vai revelar o resto na próxima vida?',
'🙃 Olhinho tímido, cara inteira desaparecida!',
'👀 Suspense master: só um olho visível!',
'😏 Só o olho? Tá deixando a gente doido de curiosidade!',
'🤣 Olhinho escondido, cara completa em hiato!',
'🙈 Cara completa é DLC, olhinho grátis!',
'😆 Olho solitário, resto da cara em construção!',
'😂 Só de olho? Tá economizando pro futuro?',
'👁️ Olhinho tímido, suspense total!',
'😏 Um olho só? Tá testando a paciência do grupo!',
'🤣 Só olhando? Tá dando show de mistério!',
'🙃 Olhinho curioso, cara completa desaparecida!',
'👀 Olho sozinho, suspense infinito!',
'😆 Só o olho? Vai revelar o resto ou vai morrer assim?',
'😂 Olhinho tímido, cara completa sumida!',
'🙈 Suspense master: só o olho visível!',
'😏 Um olho só? Tá zoando com a gente, hein?',
'🤣 Cara inteira? Em modo stealth!',
'👀 Olhinho só? Cadê a cara inteira, hein?',
'😏 Só de olho? Tá escondendo a beleza ou a feiura?',
'🤣 Tá tímido(a), ou tá preguiça de mostrar o rosto?',
'🙈 Um olho só? Vai revelar o resto quando, na vida real?',
'😆 Olhinho curioso, resto da cara sumido!',
'😂 Só olhando? Vai revelar ou é segredo de estado?',
'👁️ Cara completa tá de férias, é?',
'😏 Olhinho tímido, suspense total!',
'🤣 Só o olho? Tá de espiadinha ou vergonha mesmo?',
'🙃 Olhinho escondido, cara inteira escondida!',
'👀 Um olho só? Quer deixar a gente maluco de curiosidade?',
'😆 Só de olho? Parece teaser de filme de terror!',
'😂 Olhinho fofo, mas cadê a boca?',
'🙈 Rosto completo em hiato, só sobrou o olho?',
'😏 Olhinho tímido, suspense master!',
'🤣 Só olhando? Tá dando trabalho pra gente adivinhar!',
'👁️ Cara inteira em manutenção, só o olho pronto!',
'😆 Olhinho escondido, suspense infinito!',
'😂 Só o olho? Vai revelar o resto em 2050?',
'🙃 Um olho só, cara completa em construção!',
'👀 Olhinho solitário, suspense máximo!',
'😏 Só de olho? Tá economizando pixels pra ocasião especial!',
'🤣 Olho de curiosidade, resto da cara sumido!',
'🙈 Um olho só? Suspense nível hard!',
'😆 Olhinho tímido, cara completa ausente!',
'😂 Cara inteira em modo stealth, só o olho visível!',
'👁️ Só o olho? Tá deixando a gente doido de curiosidade!',
'😏 Olhinho curioso, resto da face em hiato!',
'🤣 Só olhando? Vai revelar o resto ou vai morrer assim?',
'🙃 Um olho só? Quer provocar ou é timidez mesmo?',
'👀 Olhinho tímido, cara completa sumida!',
'😆 Suspense master: só o olho visível!',
'😂 Só de olho? Tá economizando pro futuro?',
'🙈 Olhinho escondido, cara inteira em hiato!',
'😏 Um olho só? Tá testando a paciência do grupo!',
'🤣 Olho de espiadinha, cara completa desaparecida!',
'👁️ Só olhando? Suspense garantido!',
'😆 Olhinho curioso, resto da cara em construção!',
'😂 Um olho só? Tá de espiadinha ou vergonha total?',
'🙃 Olhinho tímido, cara completa sumida!',
'👀 Só de olho? Tá escondendo o resto da cara pra ocasião especial?',
'😏 Olhinho solitário, suspense máximo!',
'🤣 Cara inteira? Em modo stealth!',
'🙈 Um olho só, suspense master!',
'😆 Olhinho tímido, resto da face em hiato!',
'😂 Só olhando? Vai revelar o resto ou vai morrer assim?',
'👁️ Olhinho escondido, cara completa ausente!',
'😏 Um olho só? Tá testando nossa paciência!',
'🤣 Olho curioso, resto da cara sumido!',
'🙃 Só de olho? Suspense nível hard!',
'👀 Olhinho solitário, cara completa em construção!',
'😆 Só o olho? Vai revelar o resto quando?',
'😂 Olhinho tímido, suspense garantido!',
'🙈 Cara completa em hiato, só sobrou o olho!',
'😏 Um olho só? Tá economizando pixels pro futuro!',
'🤣 Só olhando? Vai revelar o resto ou vai morrer assim?',
'👁️ Olhinho curioso, cara completa sumida!',
'😆 Um olho só? Suspense master!',
'😂 Só de olho? Tá deixando a gente maluco de curiosidade!',
'🙃 Olhinho escondido, cara completa ausente!',
'👀 Um olho só? Vai revelar o resto em 2050?',
'😏 Olhinho tímido, suspense máximo!',
'🤣 Só olhando? Suspense nível hard!',
'🙈 Olhinho curioso, cara completa em hiato!',
'😆 Só de olho? Tá economizando pixels pro resto da cara?',
'😂 Um olho só? Vai revelar ou é segredo?',
'👁️ Olhinho tímido, suspense garantido!',
'😏 Cara completa em manutenção, só o olho pronto!',
'🤣 Só olhando? Tá dando trabalho pra gente adivinhar!',
'🙃 Um olho só, cara completa desaparecida!',
'👀 Olhinho escondido, suspense infinito!',
'😆 Só o olho? Vai revelar o resto quando?',
'😂 Olhinho curioso, cara completa sumida!',
'🙈 Um olho só? Tá provocando ou é vergonha mesmo?',
'😏 Só olhando? Suspense master!',
'🤣 Olhinho tímido, cara completa ausente!',
'👁️ Um olho só? Vai revelar o resto na próxima vida?',
'😆 Olhinho escondido, suspense garantido!',
'😂 Só de olho? Tá escondendo o resto da cara pra ocasião especial?',
'🙃 Olhinho curioso, cara completa em hiato!',
'👀 Um olho só? Tá deixando a gente maluco de curiosidade!',
'😏 Só olhando? Vai revelar o resto ou vai morrer assim?',
'🤣 Olhinho tímido, cara completa sumida!',
'🙈 Só o olho? Suspense máximo!',
'😆 Um olho só, cara completa em construção!',
'😂 Olhinho escondido, suspense infinito!',
'👁️ Só de olho? Tá testando a paciência do grupo!',
'😏 Olhinho curioso, cara completa desaparecida!',
'🤣 Só olhando? Vai revelar o resto ou vai morrer assim?',
'🙃 Um olho só? Suspense garantido!',
'👀 Olhinho tímido, cara completa ausente!',
'😆 Só o olho? Vai revelar o resto na próxima vida?',
'😂 Olhinho escondido, suspense master!',
'🙈 Um olho só? Tá provocando ou é vergonha mesmo?',
'😏 Só olhando? Suspense infinito!',
'🤣 Olhinho curioso, cara completa sumida!',
'👁️ Um olho só? Vai revelar o resto quando?',
'😆 Olhinho tímido, cara completa em hiato!',
'😂 Só de olho? Tá deixando a gente maluco de curiosidade!',
'🙃 Um olho só? Suspense máximo!',
'👀 Olhinho escondido, cara completa desaparecida!',
'😏 Só olhando? Vai revelar o resto ou vai morrer assim?',
'🤣 Olhinho tímido, suspense garantido!',
'🙈 Só o olho? Vai revelar o resto na próxima vida?',
'😆 Um olho só, cara completa em construção!',
'😂 Olhinho curioso, suspense infinito!',
'👁️ Só de olho? Tá testando a paciência do grupo!',
'😏 Olhinho tímido, cara completa sumida!',
'🤣 Só olhando? Suspense master!',
'👀 Olhinho solitário, o resto da cara tá de férias?',
'😏 Só um olho? Cadê o resto da face, hein?',
'🤣 Um olho só? Tá economizando o resto da cara?',
'🙈 Olhinho tímido, cara completa escondida!',
'😆 Só de olho? Vai revelar o resto quando, no século que vem?',
'😂 Cara inteira sumida, só sobrou o olho!',
'👁️ Olhinho escondido, suspense total!',
'😏 Só olhando? Tá tímido(a) ou só preguiça mesmo?',
'🤣 Um olho só? Tá dando show de mistério!',
'🙃 Olhinho curioso, cara completa ausente!',
'👀 Só de olho? Tá escondendo a feiura ou a beleza?',
'😆 Olhinho tímido, suspense master!',
'😂 Cara completa? Em breve… talvez nunca!',
'🙈 Um olho só, suspense nível hard!',
'😏 Olhinho solitário, vai revelar o resto quando?',
'🤣 Só olhando? Suspense infinito!',
'👁️ Olhinho escondido, cara inteira em hiato!',
'😆 Só de olho? Tá economizando pixels pro resto da face?',
'😂 Um olho só? Vai revelar ou vai morrer assim?',
'🙃 Olhinho curioso, cara completa sumida!',
'👀 Olho tímido, resto da cara em construção!',
'😏 Só olhando? Vai revelar o resto ou não?',
'🤣 Um olho só? Suspense master!',
'🙈 Olhinho escondido, cara completa ausente!',
'😆 Só de olho? Tá dando trabalho pra gente adivinhar!',
'😂 Olhinho tímido, suspense garantido!',
'👁️ Cara inteira em hiato, só sobrou o olho!',
'😏 Só um olho? Tá testando a paciência do grupo?',
'🤣 Olhinho curioso, suspense infinito!',
'🙃 Só de olho? Vai revelar o resto na próxima vida?',
'👀 Um olho só, cara completa desaparecida!',
'😆 Olhinho tímido, suspense total!',
'😂 Só olhando? Tá escondendo o resto da cara pra ocasião especial?',
'🙈 Olhinho escondido, cara completa em modo stealth!',
'😏 Só de olho? Vai revelar o resto ou vai morrer assim?',
'🤣 Um olho só? Suspense garantido!',
'👁️ Olhinho curioso, cara completa sumida!',
'😆 Só olhando? Vai revelar o resto ou não?',
'😂 Um olho só? Tá economizando o resto da cara pro futuro?',
'🙃 Olhinho tímido, suspense master!',
'👀 Olhinho escondido, cara completa ausente!',
'😏 Só de olho? Vai revelar o resto quando?',
'🤣 Um olho só? Suspense máximo!',
'🙈 Olhinho curioso, cara completa em hiato!',
'😆 Só olhando? Tá escondendo o resto da cara?',
'😂 Um olho só? Vai revelar o resto ou é segredo?',
'👁️ Olhinho tímido, suspense infinito!',
'😏 Só de olho? Vai revelar ou vai morrer assim?',
'🤣 Cara completa em hiato, só o olho visível!',
'🙃 Um olho só, suspense master!',
'👀 Olhinho escondido, cara completa sumida!',
'😆 Só olhando? Tá tímido(a) ou preguiçoso(a)?',
'😂 Um olho só? Vai revelar o resto na próxima vida?',
'🙈 Olhinho curioso, suspense garantido!',
'😏 Só de olho? Cadê o resto da cara, hein?',
'🤣 Olhinho tímido, cara completa desaparecida!',
'👁️ Só um olho? Vai revelar o resto algum dia?',
'😆 Olhinho solitário, suspense total!',
'😂 Só de olho? Tá escondendo a feiura ou beleza?',
'🙃 Um olho só, cara completa em construção!',
'👀 Olhinho tímido, suspense master!',
'😏 Só olhando? Vai revelar o resto ou não?',
'🤣 Um olho só? Tá provocando ou é vergonha mesmo?',
'🙈 Olhinho escondido, cara completa ausente!',
'😆 Só de olho? Vai revelar o resto quando, hein?',
'😂 Um olho só? Suspense infinito!',
'👁️ Olhinho curioso, cara completa sumida!',
'😏 Só olhando? Tá dando trabalho pra gente adivinhar!',
'🤣 Um olho só? Vai revelar ou vai morrer assim?',
'🙃 Olhinho tímido, suspense garantido!',
'👀 Olhinho escondido, cara completa em hiato!',
'😆 Só de olho? Tá economizando pixels pro resto da face?',
'😂 Um olho só? Vai revelar o resto ou é segredo?',
'🙈 Olhinho curioso, suspense master!',
'😏 Só de olho? Cadê o resto da cara, hein?',
'🤣 Olhinho tímido, cara completa sumida!',
'👁️ Um olho só? Suspense garantido!',
'😆 Só olhando? Vai revelar o resto na próxima vida?',
'😂 Olhinho escondido, cara completa ausente!',
'🙃 Um olho só? Suspense total!',
'👀 Olhinho curioso, cara completa em hiato!',
'😏 Só de olho? Vai revelar o resto ou vai morrer assim?',
'🤣 Um olho só? Vai deixar a gente doido de curiosidade?',
'🙈 Olhinho tímido, suspense infinito!',
'😆 Só olhando? Tá escondendo o resto da cara?',
'😂 Um olho só? Suspense master!',
'👁️ Olhinho solitário, cara completa desaparecida!',
'😏 Só de olho? Vai revelar o resto algum dia?',
'🤣 Olhinho curioso, suspense total!',
'🙃 Um olho só, cara completa em construção!',
'👀 Só olhando? Vai revelar o resto ou não?',
'😆 Olhinho tímido, suspense garantido!',
'😂 Um olho só? Vai revelar ou vai morrer assim?',
'🙈 Olhinho escondido, cara completa sumida!',
'😏 Só de olho? Tá dando trabalho pra gente adivinhar?',
'🤣 Um olho só? Suspense infinito!',
'👁️ Olhinho curioso, cara completa em hiato!',
'😆 Só olhando? Vai revelar o resto na próxima vida?',
'😂 Um olho só? Tá escondendo o resto da cara pro futuro?',
'🙃 Olhinho tímido, suspense master!',
'👀 Olhinho solitário, cara completa ausente!',
'😏 Só de olho? Vai revelar o resto algum dia?',
'🤣 Um olho só? Suspense garantido!',
'🙈 Olhinho escondido, cara completa desaparecida!',
'😆 Só olhando? Vai revelar o resto ou não?',
'😂 Um olho só? Suspense total!',
'👁️ Olhinho curioso, cara completa em construção!',
'😏 Só de olho? Tá dando trabalho pra gente adivinhar?',
'🤣 Um olho só? Vai deixar a gente maluco de curiosidade!',
'🙃 Olhinho tímido, suspense infinito!'
];
        
        // Índice para rotação sequencial das mensagens
        this.indiceMensagemAtual = 0;
        
        // Inicia carregamento
        this.inicializar();
    }
    
    /**
     * Retorna a próxima mensagem na sequência (rotação circular)
     */
    getProximaMensagem() {
        const mensagem = this.mensagens[this.indiceMensagemAtual];
        console.log(`💬 Mensagem ${this.indiceMensagemAtual + 1}/${this.mensagens.length}: ${mensagem}`);
        
        // Avança para próxima (circular)
        this.indiceMensagemAtual = (this.indiceMensagemAtual + 1) % this.mensagens.length;
        
        return mensagem;
    }

    async inicializar() {
        console.log('🎵 Iniciando carregamento dos áudios...');
        await carregarAudios();
    }

    /**
     * COMANDO #atualizaraudios - Atualiza áudios manualmente
     */
    async handleComandoAtualizar(sock, message) {
        try {
            const from = message.key.remoteJid;
            
            console.log('🔄 Comando #atualizaraudios recebido!');
            
            await sock.sendMessage(from, { 
                text: '🔄 *Atualizando áudios do GitHub...*\n\nAguarde um momento...' 
            }, { quoted: message });

            const totalAnterior = audios.length;
            
            const sucesso = await carregarAudios();

            if (sucesso) {
                const novos = audios.length - totalAnterior;
                let msgSucesso = `✅ *Áudios atualizados com sucesso!*\n\n` +
                    `📊 *Total de áudios:* ${audios.length}`;
                
                if (novos > 0) {
                    msgSucesso += `\n🆕 *Novos áudios:* ${novos}`;
                } else if (novos < 0) {
                    msgSucesso += `\n🗑️ *Removidos:* ${Math.abs(novos)}`;
                }

                await sock.sendMessage(from, { text: msgSucesso }, { quoted: message });
                return true;
            } else {
                await sock.sendMessage(from, { 
                    text: '❌ *Erro ao atualizar áudios!*\n\nVerifique o GitHub e tente novamente.' 
                }, { quoted: message });
                return false;
            }

        } catch (error) {
            console.error('❌ Erro no comando atualizaraudios:', error);
            return false;
        }
    }

    /**
     * Verifica se a mensagem é o comando #atualizaraudios
     */
    isComandoAtualizar(message) {
        const content = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || '';
        return content.toLowerCase().trim() === '#atualizaraudios';
    }

    /**
     * Obtém o próximo áudio na rotação
     */
    getProximoAudio() {
        if (audios.length === 0) {
            console.error('❌ Nenhum áudio disponível');
            return null;
        }

        const audio = audios[indiceAtual];
        console.log(`🎵 Áudio atual: ${audio.nome} (${indiceAtual + 1}/${audios.length})`);
        
        // Avança para próximo (circular)
        indiceAtual = (indiceAtual + 1) % audios.length;
        
        return audio;
    }

    /**
     * Baixa o buffer do áudio
     */
    async downloadAudioBuffer(url) {
        try {
            console.log(`📥 Baixando áudio: ${url}`);
            
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
                    'Accept': 'audio/mpeg, audio/*, */*'
                }
            });

            if (response.data && response.data.byteLength > 0) {
                console.log(`✅ Áudio baixado: ${response.data.byteLength} bytes`);
                return Buffer.from(response.data);
            }
            return null;

        } catch (error) {
            console.error(`❌ Erro ao baixar áudio: ${error.message}`);
            return null;
        }
    }

    /**
     * Converte áudio para formato Opus usando fluent-ffmpeg
     */
    async converterParaOpus(inputBuffer) {
        return new Promise((resolve) => {
            try {
                console.log('🔄 Convertendo para Opus (formato PTT)...');
                const tempDir = path.join(__dirname, '../../../temp');

                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const timestamp = Date.now();
                const inputPath = path.join(tempDir, `input_${timestamp}.mp3`);
                const outputPath = path.join(tempDir, `output_${timestamp}.ogg`);

                fs.writeFileSync(inputPath, inputBuffer);

                ffmpeg(inputPath)
                    .audioCodec('libopus')
                    .audioBitrate('48k')
                    .audioChannels(1)
                    .audioFrequency(48000)
                    .format('ogg')
                    .output(outputPath)
                    .on('error', (err) => {
                        console.warn('⚠️ FFmpeg falhou:', err.message);
                        try {
                            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        } catch (e) {}
                        resolve(null);
                    })
                    .on('end', () => {
                        try {
                            if (!fs.existsSync(outputPath)) {
                                console.warn('⚠️ Arquivo de saída não foi criado');
                                fs.unlinkSync(inputPath);
                                resolve(null);
                                return;
                            }

                            const audioConvertido = fs.readFileSync(outputPath);
                            
                            try {
                                fs.unlinkSync(inputPath);
                                fs.unlinkSync(outputPath);
                            } catch (e) {}

                            console.log(`✅ Convertido para Opus: ${(audioConvertido.length / 1024).toFixed(2)} KB`);
                            resolve(audioConvertido);
                        } catch (error) {
                            console.error('❌ Erro ao ler arquivo convertido:', error.message);
                            resolve(null);
                        }
                    })
                    .run();

            } catch (error) {
                console.error('❌ Erro na conversão:', error.message);
                resolve(null);
            }
        });
    }

    /**
     * Envia o áudio como PTT (Push-to-Talk / Áudio de Voz)
     * CORREÇÃO: Passa a mensagem completa para quote, não apenas a key
     */
    async sendAudio(sock, jid, quotedMessage = null) {
        try {
            console.log('\n========== ENVIANDO ÁUDIO PTT ==========');

            const audioInfo = this.getProximoAudio();
            
            if (!audioInfo) {
                console.error('❌ Nenhum áudio disponível');
                return false;
            }

            console.log(`🎯 Enviando: ${audioInfo.nome}`);

            // Baixa o áudio
            const audioBuffer = await this.downloadAudioBuffer(audioInfo.url);
            
            if (!audioBuffer) {
                console.error('❌ Falha ao baixar áudio');
                return false;
            }

            // ✅ CORREÇÃO: Passa a mensagem completa, não apenas a key
            const sendOptions = quotedMessage ? { quoted: quotedMessage } : {};

            // ESTRATÉGIA 1: Opus com PTT (PREFERENCIAL - aparece como áudio de voz)
            console.log('🎤 Tentando enviar como Opus PTT...');
            const audioOpus = await this.converterParaOpus(audioBuffer);

            if (audioOpus) {
                try {
                    await sock.sendMessage(jid, {
                        audio: audioOpus,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    }, sendOptions);

                    console.log(`✅ Áudio PTT enviado com sucesso: ${audioInfo.nome}`);
                    console.log('========================================\n');
                    return true;
                } catch (err) {
                    console.error(`⚠️ Opus PTT falhou: ${err.message}`);
                    console.log('Tentando fallback...');
                }
            }

            // ESTRATÉGIA 2: MP3 com PTT (fallback)
            console.log('🎤 Tentando enviar como MP3 PTT...');
            try {
                await sock.sendMessage(jid, {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    ptt: true
                }, sendOptions);

                console.log(`✅ Áudio PTT enviado (MP3): ${audioInfo.nome}`);
                console.log('========================================\n');
                return true;
            } catch (err) {
                console.error(`❌ MP3 PTT falhou: ${err.message}`);
            }

            console.error('❌ Todas as estratégias PTT falharam');
            console.log('========================================\n');
            return false;

        } catch (error) {
            console.error('❌ Erro ao enviar áudio PTT:', error.message);
            console.log('========================================\n');
            return false;
        }
    }

    async isAdmin(sock, groupId, userId) {
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            return participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (error) {
            return false;
        }
    }

    async handleReactionFromMessage(sock, message) {
        try {
            if (!message?.key) return false;

            const from = message.key.remoteJid;
            const userId = message.key.participant || message.key.remoteJid;
            const content = message.message?.conversation || '';

            if (!from.endsWith('@g.us')) return false;
            if (!this.olhinhoEmojis.some(emoji => content.includes(emoji))) return false;

            const reactionKey = `${from}_${message.key.id}_${userId}`;
            if (this.processedReactions.has(reactionKey)) return true;

            this.processedReactions.add(reactionKey);
            setTimeout(() => this.processedReactions.delete(reactionKey), 5 * 60 * 1000);

            if (message.key.fromMe || userId === sock.user?.id) return true;

            const isUserAdmin = await this.isAdmin(sock, from, userId);

            const responseText = this.getProximaMensagem();

            // ✅ CORREÇÃO: Envia respondendo a mensagem ORIGINAL com olhinho
            await sock.sendMessage(from, { text: responseText }, { quoted: message });

            const delayAleatorio = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
            console.log(`⏰ Aguardando ${(delayAleatorio / 1000).toFixed(1)}s antes do áudio...`);

            setTimeout(async () => {
                // ✅ CORREÇÃO: Áudio também responde a mensagem ORIGINAL com olhinho
                await this.sendAudio(sock, from, message);
            }, delayAleatorio);

            const adminTag = isUserAdmin ? '👑 ADMIN' : '';
            console.log(`👁️ Olhinho de ${userId.split('@')[0]} ${adminTag} em ${from}`);

            return true;

        } catch (error) {
            console.error('❌ Erro ao processar reação:', error);
            return false;
        }
    }

    async handleReaction(sock, reaction) {
        try {
            if (!reaction || !reaction.key) return;

            const { key, reactions } = reaction;
            const from = key.remoteJid;

            if (!from.endsWith('@g.us')) return;
            if (!reactions || reactions.length === 0) return;

            for (const react of reactions) {
                const reactionKey = `${from}_${key.id}_${react.key.participant}_${react.text}`;

                if (this.processedReactions.has(reactionKey)) continue;

                if (this.olhinhoEmojis.includes(react.text)) {
                    const userId = react.key.participant || react.key.remoteJid;

                    if (userId === sock.user?.id) continue;

                    this.processedReactions.add(reactionKey);
                    setTimeout(() => this.processedReactions.delete(reactionKey), 5 * 60 * 1000);

                    const isUserAdmin = await this.isAdmin(sock, from, userId);

                    const responseText = this.getProximaMensagem();

                    // ✅ CORREÇÃO: Construir mensagem completa para quote
                    const quotedMsg = {
                        key: react.key,
                        message: reaction.message || {}
                    };

                    // ✅ CORREÇÃO: Responde a mensagem que recebeu a reação de olhinho
                    await sock.sendMessage(from, { text: responseText }, { quoted: quotedMsg });

                    const delayAleatorio = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
                    console.log(`⏰ Aguardando ${(delayAleatorio / 1000).toFixed(1)}s antes do áudio...`);

                    setTimeout(async () => {
                        // ✅ CORREÇÃO: Áudio também responde a mensagem que recebeu a reação
                        await this.sendAudio(sock, from, quotedMsg);
                    }, delayAleatorio);

                    console.log(`👁️ Olhinho de ${userId.split('@')[0]} em ${from}`);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao processar reação:', error);
        }
    }

    async diagnosticar() {
        console.log('\n========== DIAGNÓSTICO ==========');
        console.log(`Áudios carregados: ${audios.length}`);
        console.log(`Índice atual: ${indiceAtual + 1}/${audios.length}`);
        console.log(`Última atualização: ${ultimaAtualizacao}`);
        console.log(`URL configurada: ${URL_AUDIOS_JSON}`);

        if (audios.length > 0) {
            console.log('\n📋 Lista de áudios:');
            audios.slice(0, 5).forEach((audio, idx) => {
                const atual = idx === indiceAtual ? ' 👈 PRÓXIMO' : '';
                console.log(`  ${idx + 1}. ${audio.nome}${atual}`);
            });
            if (audios.length > 5) {
                console.log(`  ... e mais ${audios.length - 5} áudios`);
            }
        }

        console.log('=================================\n');
    }

    clearCache() {
        this.processedReactions.clear();
        console.log('🧹 Cache limpo');
    }
}

/**
 * Carrega os áudios do GitHub DIRETAMENTE (sem cache manager)
 */
async function carregarAudios() {
    try {
        console.log('🔄 [Audios] Carregando áudios do GitHub...');
        console.log(`📡 URL: ${URL_AUDIOS_JSON}`);
        
        const response = await fetch(URL_AUDIOS_JSON, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Filtra apenas áudios ativos
        const audiosAtivos = (data.audios || []).filter(a => a.ativo === true);
        
        if (audiosAtivos.length === 0) {
            console.error('❌ [Audios] Nenhum áudio ativo encontrado no JSON');
            return false;
        }

        audios = audiosAtivos;
        ultimaAtualizacao = new Date();
        
        console.log(`✅ [Audios] ${audios.length} áudios carregados com sucesso!`);
        console.log('📋 Primeiros áudios:');
        audios.slice(0, 3).forEach((a, i) => {
            console.log(`  ${i + 1}. ${a.nome} (${a.id})`);
        });
        
        return true;

    } catch (error) {
        console.error('❌ [Audios] Erro ao carregar:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Inicializar carregando os áudios
console.log('🚀 Iniciando carregamento inicial dos áudios...');
carregarAudios().then(success => {
    if (success) {
        console.log('✅ Sistema de áudios PTT pronto!');
    } else {
        console.error('❌ Falha ao inicializar sistema de áudios');
    }
});

export default new OlhinhoHandler();
