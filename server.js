// Hostinger / cPanel / Cloud Production Entrypoint - Node Engine for Phusion Passenger
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logCrash(error) {
  const message = `[${new Date().toISOString()}] CRASH ERROR: ${error?.stack || error || 'Unknown Error'}\n`;
  console.error(message);
  try {
    fs.appendFileSync(path.join(__dirname, 'server_crash.log'), message);
  } catch (e) {
    // Ignore log write errors
  }
}

process.on('uncaughtException', (err) => {
  logCrash(err);
});

process.on('unhandledRejection', (reason) => {
  logCrash(reason);
});

// Detect Electron
const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;

if (isElectron) {
  console.log("[Electron Mode] Running inside Electron. Launching electron/main.cjs...");
  require('./electron/main.cjs');
} else {
  console.log("[Production Entrypoint] Initializing application...");

  const distServerPath = path.join(__dirname, 'dist', 'server.cjs');

  let serverLoaded = false;

  if (fs.existsSync(distServerPath)) {
    try {
      require(distServerPath);
      console.log("[Production Entrypoint] Successfully loaded dist/server.cjs.");
      serverLoaded = true;
    } catch (err) {
      console.error("[Production Entrypoint] Error requiring dist/server.cjs:", err);
      logCrash(err);
    }
  }

  // Emergency Fail-Safe Server to guarantee 0% 503 errors under Phusion Passenger
  if (!serverLoaded) {
    console.warn("[Emergency Server] dist/server.cjs not loaded. Starting instant diagnostic server to prevent 503...");
    try {
      const http = require('http');
      
      const server = http.createServer((req, res) => {
        let crashLog = '';
        try {
          const logPath = path.join(__dirname, 'server_crash.log');
          if (fs.existsSync(logPath)) {
            crashLog = fs.readFileSync(logPath, 'utf8');
          }
        } catch (e) {}

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Application Starting / Diagnostic</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; }
              .card { background: #1e293b; border: 1px solid #334155; padding: 24px; border-radius: 12px; max-width: 750px; margin: 40px auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
              h1 { color: #38bdf8; font-size: 22px; margin-top: 0; }
              pre { background: #020617; padding: 15px; border-radius: 8px; overflow-x: auto; color: #fb7185; white-space: pre-wrap; font-family: monospace; font-size: 13px; }
              .info { color: #94a3b8; font-size: 14px; margin-bottom: 15px; line-height: 1.6; }
              .btn { display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>🚀 Application is Ready / Deploying</h1>
              <p class="info">The server build is completed or initializing. If you just deployed, please click refresh below:</p>
              <a href="javascript:location.reload()" class="btn">🔄 Refresh Application</a>
              ${crashLog ? `
                <h3 style="color: #f43f5e; margin-top: 25px;">Recent Diagnostic Log:</h3>
                <pre>${crashLog}</pre>
              ` : ''}
            </div>
          </body>
          </html>
        `);
      });

      const onListen = () => {
        console.log(`[Emergency Server] Server listening and ready.`);
      };

      const targetPort = process.env.PORT || 3000;
      const numPort = Number(targetPort);
      if (!isNaN(numPort) && numPort > 0) {
        server.listen(numPort, '0.0.0.0', onListen);
      } else {
        server.listen(targetPort, onListen);
      }
    } catch (fallbackErr) {
      console.error("[Emergency Server] Critical failure in fallback server:", fallbackErr);
    }
  }
}
