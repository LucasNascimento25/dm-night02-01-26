// confissoesHandler.js - Sistema de confissões COM NOTIFICAÇÕES PARA ADMINS
import pool from '../../../../db.js';

class ConfissoesHandler {
    
    // ⚙️ CONFIGURAÇÃO - COLOQUE OS NÚMEROS DOS ADMINS AQUI
    constructor() {
        this.adminsResponsaveis = [
            '5521972337640@s.whatsapp.net'
        ];
    }

    // 🗑️ FUNÇÃO ROBUSTA PARA DELETAR MENSAGENS (igual ao alertaHandler)
    async deleteMessage(sock, groupId, messageKey) {
        const delays = [0, 100, 500, 1000, 2000, 5000];
        
        for (let i = 0; i < delays.length; i++) {
            try {
                if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
                
                const key = {
                    remoteJid: messageKey.remoteJid || groupId,
                    fromMe: false,
                    id: messageKey.id,
                    participant: messageKey.participant
                };
                
                await sock.sendMessage(groupId, { delete: key });
                console.log(`✅ Mensagem deletada (tentativa ${i + 1})`);
                return true;
            } catch (error) {
                console.log(`❌ Tentativa ${i + 1} falhou:`, error.message);
            }
        }
        return false;
    }
    
    // Inicializa a tabela (execute uma vez)
    async initDatabase() {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS confissoes (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(100) NOT NULL,
                    content TEXT NOT NULL,
                    status VARCHAR(20) DEFAULT 'pendente',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    posted_at TIMESTAMP
                )
            `);
            console.log('✅ Tabela de confissões criada/verificada');
        } catch (error) {
            console.error('❌ Erro ao criar tabela:', error);
        }
    }

    // 🔔 NOTIFICA OS ADMINS quando recebe nova confissão
    async notificarAdmins(sock, totalPendentes) {
        try {
            const mensagem = `🔔 *Nova Confissão Recebida!*\n\n` +
                           `📝 Total aguardando: *${totalPendentes}*\n\n` +
                           `💡 *Para postar no grupo:*\n` +
                           `Digite #postarconfissoes`;

            for (const adminId of this.adminsResponsaveis) {
                try {
                    await sock.sendMessage(adminId, { text: mensagem });
                    console.log(`✅ Admin notificado: ${adminId}`);
                } catch (error) {
                    console.error(`⚠️ Erro ao notificar admin ${adminId}:`, error.message);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao notificar admins:', error);
        }
    }
    
    // Processa mensagens no PRIVADO
    async handlePrivateMessage(sock, message, from, userId, content) {
        try {
            // Verifica se começa com #confissoes
            if (!content.toLowerCase().startsWith('#confissoes')) {
                return false;
            }

            // Remove o comando e pega só a confissão
            const confissao = content.replace(/^#confissoes\s*/i, '').trim();

            if (!confissao) {
                await sock.sendMessage(from, {
                    text: '❌ *Por favor, escreva sua confissão após #confissoes*\n\n' +
                          '*Exemplo:*\n' +
                          '#confissoes Minha confissão é: "Ontem comi brigadeiro escondido 😅"'
                });
                return true;
            }

            // Salva no banco de dados
            await pool.query(
                'INSERT INTO confissoes (user_id, content, status) VALUES ($1, $2, $3)',
                [userId, confissao, 'pendente']
            );

            await sock.sendMessage(from, {
                text: '💌 *Confissão Recebida!*\n\n' +
                      `📝 *Sua Confissão:*\n${confissao}\n\n` +
                      '🗓️ *Quando será postada?*\n' +
                      'Quando um dos admins mandar no grupo #postarconfissoes\n\n' +
                      '✨ *Seu anonimato está garantido!*'
            });

            console.log(`✅ Confissão salva no banco de ${userId}`);

            // 🔔 NOTIFICA OS ADMINS
            const totalPendentes = await this.getConfissoesPendentes();
            await this.notificarAdmins(sock, totalPendentes);

            return true;

        } catch (error) {
            console.error('❌ Erro ao processar confissão:', error);
            await sock.sendMessage(from, {
                text: '❌ Erro ao salvar sua confissão. Tente novamente!'
            });
            return false;
        }
    }

    // POSTAR confissões no grupo (chamado pelo scheduler ou manualmente)
    async postarConfissoes(sock, groupId) {
        try {
            console.log(`📢 Iniciando postagem de confissões no grupo ${groupId}`);

            // Busca confissões pendentes do banco
            const result = await pool.query(
                'SELECT id, content FROM confissoes WHERE status = $1 ORDER BY RANDOM()',
                ['pendente']
            );

            if (result.rows.length === 0) {
                await sock.sendMessage(groupId, {
                    text: `📭 *O CONFESSIONÁRIO ESTÁ VAZIO!* 🤐\n\n` +
                          `🛐 As *Noviças Rebeldes*, *Donzelas* e *Donzelos* ainda não enviaram seus segredinhos... 💭\n\n` +
                          `⏳ *Aguarde, administrador(a)!* ☕\n` +
                          `Enquanto isso, sirva-se de um cafezinho ☕💆‍♀️\n` +
                          `As confissões chegarão em breve! 💌✨`
                });
                return;
            }

            console.log(`📨 Postando ${result.rows.length} confissões...`);

            // Posta cada confissão
            const idsParaDeletar = [];
            
            for (let i = 0; i < result.rows.length; i++) {
                const confissao = result.rows[i];
                
                await sock.sendMessage(groupId, {
                    text: `ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬💃💌ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🗣️💬ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼🕯️💞\n` +
                          `💃💥 ⃝⃕፝⃟💌 *Momento do Segredinho* ⛪⸵░⃟📩\n` +
                          `᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦\n` +
                          `*Confessionário das Damas*\n` +
                          `🎭🔐\n\n\n` +
                          `🎭 *𝙲𝙾𝙽𝙵𝙸𝚂𝚂Ã𝙾 𝙰𝙽Ô𝙽𝙸𝙼𝙰* 💃💬\n\n` +
                          `${confissao.content}\n\n\n` +
                          `───𖡜ꦽ̸ོ˚￫───ཹ🛐🕯️🔥 ݇-݈ °︠︠︠︠︠︠︠︠𖡬 ᭄`
                });

                // Guarda ID para deletar depois
                idsParaDeletar.push(confissao.id);

                // Aguarda 2 segundos entre cada confissão
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Deleta todas as confissões postadas do banco
            if (idsParaDeletar.length > 0) {
                await pool.query(
                    'DELETE FROM confissoes WHERE id = ANY($1)',
                    [idsParaDeletar]
                );
                console.log(`🗑️ ${idsParaDeletar.length} confissões deletadas do banco`);
            }

            console.log(`✅ ${result.rows.length} confissões postadas com sucesso!`);

        } catch (error) {
            console.error('❌ Erro ao postar confissões:', error);
            await sock.sendMessage(groupId, {
                text: '❌ Erro ao postar confissões. Tente novamente!'
            });
        }
    }

    // Comando MANUAL para admins postarem (sem esperar quarta)
    async handleManualPost(sock, groupId, userId, messageKey) {
        try {
            // Verifica se é admin do grupo
            const groupMetadata = await sock.groupMetadata(groupId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            
            if (!participant || (!participant.admin && !participant.superAdmin)) {
                await sock.sendMessage(groupId, {
                    text: '❌ Apenas administradores podem usar este comando!'
                });
                return true;
            }

            // 🗑️ REMOVE A MENSAGEM DO COMANDO
            try {
                const adminKeyToDelete = {
                    remoteJid: groupId,
                    id: messageKey.id,
                    participant: userId
                };
                await this.deleteMessage(sock, groupId, adminKeyToDelete);
                console.log('✅ Mensagem do comando #postarconfissoes removida');
            } catch (err) {
                console.log('⚠️ Não foi possível remover comando:', err.message);
            }

            await this.postarConfissoes(sock, groupId);
            return true;

        } catch (error) {
            console.error('❌ Erro ao postar manualmente:', error);
            return false;
        }
    }

    // Retorna quantidade de confissões pendentes
    async getConfissoesPendentes() {
        try {
            const result = await pool.query(
                'SELECT COUNT(*) as total FROM confissoes WHERE status = $1',
                ['pendente']
            );
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('❌ Erro ao contar confissões:', error);
            return 0;
        }
    }

    // Comando para admins verem quantas confissões tem
    async getEstatisticas() {
        try {
            const stats = await pool.query(`
                SELECT COUNT(*) as pendentes
                FROM confissoes
                WHERE status = 'pendente'
            `);
            return {
                pendentes: parseInt(stats.rows[0].pendentes),
                mensagem: `📊 *Estatísticas:*\n\n📝 Confissões aguardando: ${stats.rows[0].pendentes}`
            };
        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas:', error);
            return null;
        }
    }

    // 📢 COMANDO: #avisarconfissoes - Posta o aviso/regras da brincadeira
    async postarAvisoConfissoes(sock, groupId, userId, messageKey) {
        try {
            // Verifica se é admin do grupo
            const groupMetadata = await sock.groupMetadata(groupId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            
            if (!participant || (!participant.admin && !participant.superAdmin)) {
                await sock.sendMessage(groupId, {
                    text: '❌ Apenas administradores podem usar este comando!'
                });
                return true;
            }

            // 🔥 GERA LISTA DE MENÇÕES (igual ao alertaHandler)
            const mentions = groupMetadata.participants
                .filter(p => !p.id.includes(':')) // Remove IDs inválidos
                .map(p => p.id);

            console.log(`📢 Enviando aviso para ${mentions.length} participantes`);

            // 🗑️ REMOVE A MENSAGEM DO COMANDO (igual ao alertaHandler)
            try {
                const adminKeyToDelete = {
                    remoteJid: groupId,
                    id: messageKey.id,
                    participant: userId
                };
                await this.deleteMessage(sock, groupId, adminKeyToDelete);
                console.log('✅ Mensagem do comando #avisarconfissoes removida');
            } catch (err) {
                console.log('⚠️ Não foi possível remover comando:', err.message);
            }

            // Posta o aviso marcando TODOS os membros do grupo
            await sock.sendMessage(groupId, {
                text: `ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬💃💌ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼̬🗣️💬ஓீᤢ✧͢⃟ᤢ̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̤̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̣̼🕯️💞\n` +
                      `💃💥 ⃝⃕፝⃟💌 *Momento do Segredinho* ⛪⸵░⃟📩\n` +
                      `᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦᭥ꩌ゚໋ ꯴᩠ꦽꦼ⛓️↦\n` +
                      `🎭 *Confessionário das Damas* 💌\n` +
                      `\n` +
                      `💌 *É hora da Brincadeira dos Segredinhos!*\n\n` +
                      `───𖡜ꦽ̸ོ˚￫───ཹ🛐🕯️🔥 ݇-݈ °︠︠︠︠︠︠︠︠𖡬 ᭄\n\n` +
                      `*O confessionário abriu* e com ele o momento das confissões leves, engraçadas e misteriosas! ✨\n` +
                      `Envie sua confissão *anônima* ao bot e veja ela aparecer aqui no grupo!\n` +
                      `────୨ৎ────\n` +
                      `💬 *Pode ser:*\n` +
                      `• Uma curiosidade divertida 😆\n` +
                      `• Um flerte misterioso 💌\n` +
                      `• Uma confissão romântica 💫\n` +
                      `• Um interesse secreto 🤐\n` +
                      `• Uma lembrança doce de alguém 💭\n` +
                      `• Uma quedinha por alguém do grupo (sem nomes!) 🤫\n` +
                      `• Um match que nunca virou papo 💔\n` +
                      `• Um desabafo leve (sem nomes, hein?) 😌\n` +
                      `────୨ৎ────\n` +
                      `⚠️ *Regras da Boa Brincadeira:*\n` +
                      `• Sem ofensas, palavrões ou acusações 🚫\n` +
                      `• Nada de nomes, números ou fotos 🙅‍♀️\n` +
                      `• Conteúdo pesado ou desrespeitoso será apagado 🧹\n` +
                      `✨ É tudo por diversão, leveza e respeito! 💖\n` +
                      `────୨ৎ────\n` +
                      `📝 *Como Participar:*\n` +
                      `1️⃣ Chame o bot no privado 🤖\n` +
                      `2️⃣ Escreva: *#confissoes* seguido da sua confissão 💬\n` +
                      `3️⃣ Aguarde para ver sua mensagem aparecer no grupo! ˋˏ ༻💌༺ ˎˊ-\n` +
                      `\n` +
                      `───𖡜ꦽ̸ོ˚￫───ཹ🛐🕯️🔥 ݇-݈ °︠︠︠︠︠︠︠︠𖡬 ᭄`,
                mentions: mentions // 🔥 AQUI ESTÁ A MÁGICA - MARCA TODOS!
            });

            console.log(`✅ Aviso de confissões postado no grupo ${groupId}`);
            console.log(`✅ ${mentions.length} pessoas notificadas`);
            return true;

        } catch (error) {
            console.error('❌ Erro ao postar aviso:', error);
            await sock.sendMessage(groupId, {
                text: '❌ Erro ao postar aviso. Tente novamente!'
            });
            return false;
        }
    }
}

export default new ConfissoesHandler();