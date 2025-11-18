// bot/connection/whatsappConnection.js
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import pino from 'pino';
import { setupEventListeners } from './eventListeners.js';
import { autoScanGroups } from "../bot-utils/autoScan.js";

const logger = pino({ level: 'silent' });
const BOT_TITLE = '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸';

let reconnectAttempts = 0;
let isConnecting = false;
let reconnectTimeout = null;
let currentSocket = null;
let qrRetryCount = 0;
const MAX_QR_RETRIES = 3;

// Função para limpar socket anterior
function cleanupSocket(sock) {
    if (!sock) return;
    
    try {
        console.log("🧹 Limpando socket anterior...");
        sock.ev.removeAllListeners();
        
        if (sock.ws) {
            try {
                sock.ws.close();
            } catch (e) {
                // Ignora erros ao fechar websocket
            }
        }
    } catch (err) {
        console.error("⚠️ Erro ao limpar socket:", err.message);
    }
}

// Função para calcular delay exponencial com limite
function getReconnectDelay(attempts) {
    const baseDelay = 3000;
    const maxDelay = 60000; // 1 minuto máximo
    const delay = Math.min(baseDelay * Math.pow(1.5, attempts), maxDelay);
    return delay;
}

export async function connectToWhatsApp() {
    // Evita múltiplas conexões simultâneas
    if (isConnecting) {
        console.log("⏳ Já existe uma tentativa de conexão em andamento...");
        return currentSocket;
    }
    
    isConnecting = true;

    // Limpa timeout anterior se existir
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    try {
        const delay = getReconnectDelay(reconnectAttempts);
        
        if (reconnectAttempts > 0) {
            console.log("\n" + "=".repeat(60));
            console.log(`🔄 Tentativa de reconexão #${reconnectAttempts + 1}`);
            console.log(`⏱️  Delay: ${(delay / 1000).toFixed(1)}s`);
            console.log("=".repeat(60) + "\n");
        } else {
            console.log("\n" + "=".repeat(60));
            console.log("🚀 Iniciando conexão com WhatsApp...");
            console.log("=".repeat(60) + "\n");
        }

        // Limpa socket anterior antes de criar um novo
        if (currentSocket) {
            cleanupSocket(currentSocket);
            currentSocket = null;
        }

        const { version } = await fetchLatestBaileysVersion();
        console.log(`📱 Versão Baileys: ${version.join('.')}`);
        
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            getMessage: async () => undefined,
            generateHighQualityLinkPreview: false,
            markMessageAsReadWhenReceived: false,
            browser: ['Damas da Night Bot', 'Chrome', '120.0.0'],
            connectTimeoutMs: 60000,
            retryRequestDelayMs: 500,
            maxMsgRetryCount: 3,
            transactionOpts: { 
                maxCommitRetries: 3, 
                delayBetweenTriesMs: 2000 
            },
            // Configurações importantes para estabilidade
            shouldIgnoreJid: jid => false,
            cachedGroupMetadata: async (jid) => null,
        });

        currentSocket = sock;

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr, isOnline, isNewLogin } = update;
            
            // Tratamento melhorado do QR Code
            if (qr) {
                qrRetryCount++;
                console.log("\n" + "=".repeat(60));
                console.log(`📱 QR CODE GERADO (Tentativa ${qrRetryCount}/${MAX_QR_RETRIES})`);
                console.log("=".repeat(60));
                console.log("📲 Abra o WhatsApp no seu celular");
                console.log("⚙️  Vá em: Configurações > Aparelhos conectados");
                console.log("➕ Toque em: Conectar um aparelho");
                console.log("📸 Escaneie o QR Code abaixo:\n");
                
                qrcode.generate(qr, { small: true });
                
                console.log("\n" + "=".repeat(60));
                console.log("⏳ Aguardando leitura do QR Code...");
                console.log("⚠️  O QR expira em ~30 segundos");
                console.log("=".repeat(60) + "\n");

                // Se ultrapassar o limite de QR, reconecta
                if (qrRetryCount >= MAX_QR_RETRIES) {
                    console.log("⚠️ Muitas tentativas de QR. Reiniciando conexão...\n");
                    qrRetryCount = 0;
                    
                    setTimeout(() => {
                        cleanupSocket(sock);
                        isConnecting = false;
                        connectToWhatsApp();
                    }, 2000);
                }
            }

            if (connection === "connecting") {
                console.log("🔌 Conectando ao WhatsApp...");
            }

            if (connection === "open") {
                console.log("\n" + "=".repeat(60));
                console.log(`✅ ${BOT_TITLE}`);
                console.log("=".repeat(60));
                console.log("🎉 Bot conectado com sucesso!");
                console.log("💾 Autenticação: OK");
                console.log("🌐 Conexão: Estável");
                console.log("🚀 Status: Operacional");
                console.log("=".repeat(60) + "\n");

                // Reset de contadores
                reconnectAttempts = 0;
                qrRetryCount = 0;
                isConnecting = false;

                if (isNewLogin) {
                    console.log("🆕 Novo login detectado!");
                }

                // Cria pasta de downloads
                if (!fs.existsSync('./downloads')) {
                    fs.mkdirSync('./downloads', { recursive: true });
                    console.log("📁 Pasta de downloads criada");
                }

                // Varredura automática com retry
                try {
                    console.log("🔍 Iniciando varredura de grupos...\n");
                    await autoScanGroups(sock);
                    console.log("✅ Varredura concluída com sucesso!\n");
                } catch (err) {
                    console.error("⚠️ Erro na varredura automática:", err.message);
                    console.log("🔄 A varredura será tentada novamente mais tarde\n");
                }
            }

            if (connection === "close") {
                isConnecting = false;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Desconhecido';
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

                console.log("\n" + "=".repeat(60));
                console.log("⚠️  DESCONEXÃO DETECTADA");
                console.log("=".repeat(60));
                console.log(`📊 Status Code: ${statusCode}`);
                console.log(`📝 Motivo: ${errorMessage}`);
                console.log(`🔌 Tipo: ${shouldReconnect ? 'Temporária' : 'Logout'}`);
                console.log("=".repeat(60) + "\n");

                // Limpa socket desconectado
                cleanupSocket(sock);

                if (shouldReconnect) {
                    // RECONEXÃO INFINITA para problemas de rede
                    reconnectAttempts++;
                    const nextDelay = getReconnectDelay(reconnectAttempts);
                    
                    console.log("🔄 Reconexão automática ativada");
                    console.log(`📈 Tentativa: ${reconnectAttempts}`);
                    console.log(`⏰ Próxima tentativa em: ${(nextDelay / 1000).toFixed(1)}s\n`);
                    
                    reconnectTimeout = setTimeout(() => {
                        reconnectTimeout = null;
                        connectToWhatsApp();
                    }, nextDelay);
                } else {
                    // Logout ou erro 401 - necessário novo QR
                    console.log("🚪 Sessão encerrada. Novo QR necessário.");
                    
                    // Remove arquivos de autenticação
                    try {
                        if (fs.existsSync('./auth_info')) {
                            fs.rmSync('./auth_info', { recursive: true, force: true });
                            console.log("🗑️  Credenciais antigas removidas");
                        }
                    } catch (err) {
                        console.error("⚠️ Erro ao remover auth:", err.message);
                    }
                    
                    console.log("🔄 Reiniciando para gerar novo QR Code...\n");
                    
                    // Reinicia após logout
                    reconnectAttempts = 0;
                    qrRetryCount = 0;
                    
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 3000);
                }
            }
        });

        // Configura todos os event listeners
        setupEventListeners(sock);

        return sock;

    } catch (error) {
        console.error("\n" + "=".repeat(60));
        console.error("❌ ERRO NA CONEXÃO");
        console.error("=".repeat(60));
        console.error("📝 Mensagem:", error.message);
        console.error("📚 Stack:", error.stack);
        console.error("=".repeat(60) + "\n");
        
        // CRÍTICO: Sempre reseta a flag em caso de erro
        isConnecting = false;

        // Limpa socket em caso de erro
        if (currentSocket) {
            cleanupSocket(currentSocket);
            currentSocket = null;
        }

        // RECONEXÃO INFINITA mesmo em erros
        reconnectAttempts++;
        const nextDelay = getReconnectDelay(reconnectAttempts);
        
        console.log("🔄 Tentando reconectar após erro...");
        console.log(`📈 Tentativa: ${reconnectAttempts}`);
        console.log(`⏰ Próxima tentativa em: ${(nextDelay / 1000).toFixed(1)}s\n`);
        
        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connectToWhatsApp();
        }, nextDelay);
        
        return null;
    }
}

// Função para desconectar manualmente
export function disconnectWhatsApp() {
    console.log("\n" + "=".repeat(60));
    console.log("🛑 Desconexão manual solicitada");
    console.log("=".repeat(60) + "\n");
    
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
        console.log("⏹️  Timeout de reconexão cancelado");
    }
    
    if (currentSocket) {
        cleanupSocket(currentSocket);
        currentSocket = null;
        console.log("🧹 Socket limpo");
    }
    
    isConnecting = false;
    reconnectAttempts = 0;
    qrRetryCount = 0;
    
    console.log("✅ Bot desconectado com sucesso\n");
}

// Função para obter status da conexão
export function getConnectionStatus() {
    return {
        isConnecting,
        reconnectAttempts,
        qrRetryCount,
        hasSocket: !!currentSocket,
        hasPendingReconnect: !!reconnectTimeout
    };
}