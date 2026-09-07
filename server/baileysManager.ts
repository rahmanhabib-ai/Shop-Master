import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

interface BaileysSessionState {
  socket: any | null;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrRaw: string;
  qrDataUrl: string;
  phone: string;
  name: string;
  lastConnectedAt: string | null;
  reconnectAttempts: number;
}

const sessions = new Map<string, BaileysSessionState>();
const SESSIONS_DIR = path.join(process.cwd(), 'baileys_auth_sessions');

// Ensure sessions directory exists safely
if (!fs.existsSync(SESSIONS_DIR)) {
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  } catch (e) {
    console.error('[Baileys] Error creating sessions directory:', e);
  }
}

export function getSessionState(merchantId: string = 'merchant') {
  const mId = merchantId || 'merchant';
  if (!sessions.has(mId)) {
    sessions.set(mId, {
      socket: null,
      status: 'disconnected',
      qrRaw: '',
      qrDataUrl: '',
      phone: '',
      name: '',
      lastConnectedAt: null,
      reconnectAttempts: 0
    });
  }
  return sessions.get(mId)!;
}

export async function initBaileys(merchantId: string = 'merchant', forceNew: boolean = false) {
  const mId = merchantId || 'merchant';
  const state = getSessionState(mId);

  if (state.socket && state.status === 'connected' && !forceNew) {
    console.log(`[Baileys] Socket already connected for merchant ${mId}`);
    return state;
  }

  const authFolder = path.join(SESSIONS_DIR, `auth_${mId}`);
  if (forceNew && fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
    } catch (e) {
      console.warn(`[Baileys] Failed removing old auth directory:`, e);
    }
  }

  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  try {
    state.status = 'connecting';
    
    // Dynamic import to prevent dev-server crash on startup
    const baileys: any = await import('@whiskeysockets/baileys');
    const pinoModule: any = await import('pino');
    const makeWASocket = baileys.default?.makeWASocket || baileys.makeWASocket || baileys.default;
    const { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;
    const pinoFn = typeof pinoModule === 'function' ? pinoModule : (pinoModule.default || pinoModule.pino);

    const { state: authState, saveCreds } = await useMultiFileAuthState(authFolder);
    let version: [number, number, number] = [2, 3000, 1015901307];
    try {
      const vObj = await fetchLatestBaileysVersion();
      if (vObj && Array.isArray(vObj.version) && vObj.version.length >= 3) {
        version = [vObj.version[0], vObj.version[1], vObj.version[2]];
      }
    } catch (ve) {
      console.warn('[Baileys] fetchLatestBaileysVersion fallback used');
    }

    const sock = makeWASocket({
      version,
      logger: typeof pinoFn === 'function' ? pinoFn({ level: 'silent' }) : undefined,
      printQRInTerminal: false,
      auth: authState,
      browser: ['ShopMaster POS', 'Chrome', '120.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      emitOwnEvents: false,
      generateHighQualityLinkPreview: true
    });

    state.socket = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        state.qrRaw = qr;
        try {
          state.qrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 250,
            color: {
              dark: '#111b21',
              light: '#ffffff'
            }
          });
        } catch (qrErr) {
          console.error('[Baileys] Error generating QR data URL:', qrErr);
        }
        state.status = 'qr_ready';
        console.log(`[Baileys] New QR generated for merchant: ${mId}`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isTerminalLogout = statusCode === DisconnectReason?.loggedOut || statusCode === 401;
        const isConnectionReplaced = statusCode === DisconnectReason?.connectionReplaced || statusCode === 440;
        const shouldReconnect = !isTerminalLogout && !isConnectionReplaced;
        
        console.log(`[Baileys] Connection closed for ${mId}. Reason code: ${statusCode}, reconnect: ${shouldReconnect}`);

        state.status = 'disconnected';
        state.qrRaw = '';
        state.qrDataUrl = '';

        if (isTerminalLogout || isConnectionReplaced) {
          console.log(`[Baileys] Session disconnected (code ${statusCode}). Stopping auto-reconnect to prevent conflicts.`);
          if (isTerminalLogout) {
            try {
              if (fs.existsSync(authFolder)) {
                fs.rmSync(authFolder, { recursive: true, force: true });
              }
            } catch (e) {}
            state.phone = '';
            state.name = '';
          }
        } else if (shouldReconnect) {
          state.reconnectAttempts = (state.reconnectAttempts || 0) + 1;
          if (state.reconnectAttempts <= 5) {
            const delay = Math.min(5000 * state.reconnectAttempts, 30000);
            console.log(`[Baileys] Auto-reconnecting in ${delay}ms (Attempt ${state.reconnectAttempts}/5)...`);
            setTimeout(() => {
              initBaileys(mId, false).catch(err => console.error('[Baileys] Reconnect failed:', err));
            }, delay);
          } else {
            console.warn(`[Baileys] Max reconnect attempts reached for ${mId}. Standing by for user action.`);
          }
        }
      } else if (connection === 'open') {
        console.log(`[Baileys] ✅ Connection OPEN & Authenticated for merchant: ${mId}`);
        state.status = 'connected';
        state.qrRaw = '';
        state.qrDataUrl = '';
        state.lastConnectedAt = new Date().toISOString();

        // Reset reconnect attempts only after 20s of stable connection
        setTimeout(() => {
          if (state.status === 'connected') {
            state.reconnectAttempts = 0;
          }
        }, 20000);

        const userObj = sock.user;
        if (userObj) {
          state.phone = (userObj.id || '').split(':')[0] || (userObj.id || '').split('@')[0];
          state.name = userObj.name || 'WhatsApp Account';
        }
      }
    });

    return state;
  } catch (err: any) {
    console.error(`[Baileys] Failed to initialize Baileys for ${mId}:`, err);
    state.status = 'disconnected';
    return state;
  }
}

export async function sendBaileysMessage(merchantId: string, recipientPhone: string, textMessage: string) {
  const mId = merchantId || 'merchant';
  const state = getSessionState(mId);

  if (!state.socket || state.status !== 'connected') {
    throw new Error('WhatsApp Baileys socket is not connected. Please scan QR code in settings.');
  }

  let cleanPhone = recipientPhone.replace(/[^\d]/g, '');
  if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
    cleanPhone = '88' + cleanPhone;
  }

  const jid = `${cleanPhone}@s.whatsapp.net`;
  console.log(`[Baileys Dispatch] Sending text to ${jid}...`);

  const result = await state.socket.sendMessage(jid, { text: textMessage });
  return result;
}

export async function disconnectBaileys(merchantId: string) {
  const mId = merchantId || 'merchant';
  const state = getSessionState(mId);

  if (state.socket) {
    try {
      await state.socket.logout();
    } catch (e) {
      try {
        state.socket.end(new Error('Manual logout'));
      } catch (err) {}
    }
  }

  state.status = 'disconnected';
  state.qrRaw = '';
  state.qrDataUrl = '';
  state.phone = '';
  state.name = '';

  const authFolder = path.join(SESSIONS_DIR, `auth_${mId}`);
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
    } catch (e) {}
  }

  return { success: true };
}

// Auto bootstrap existing sessions safely on server boot
export async function autoResumeExistingBaileysSessions() {
  if (fs.existsSync(SESSIONS_DIR)) {
    try {
      const dirs = fs.readdirSync(SESSIONS_DIR);
      for (const dir of dirs) {
        if (dir.startsWith('auth_')) {
          const mId = dir.replace('auth_', '');
          console.log(`[Baileys Boot] Found existing session directory for merchant: ${mId}. Resuming socket...`);
          initBaileys(mId, false).catch(err => {
            console.error(`[Baileys Boot] Failed resuming session for ${mId}:`, err);
          });
        }
      }
    } catch (err) {
      console.error('[Baileys Boot] Error reading sessions directory:', err);
    }
  }
}
