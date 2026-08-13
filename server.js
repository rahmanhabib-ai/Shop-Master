// Hostinger Entrypoint v1.0.4 - CommonJS Engine for Phusion Passenger (Auto-Build & Fail-Safe Server)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  console.log("[Hostinger Entrypoint Wrapper] Booting up...");

  const distServerPath = path.join(__dirname, 'dist', 'server.cjs');
  const distIndexPath = path.join(__dirname, 'dist', 'index.html');

  // Auto-build if dist/server.cjs or dist/index.html is missing
  if (!fs.existsSync(distServerPath) || !fs.existsSync(distIndexPath)) {
    console.log("[Hostinger Auto-Build] Build artifacts missing in dist/. Running npm run build...");
    try {
      execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
      console.log("[Hostinger Auto-Build] Build completed successfully.");
    } catch (buildErr) {
      console.error("[Hostinger Auto-Build] Build failed:", buildErr);
      logCrash(buildErr);
    }
  }

  let serverLoaded = false;

  if (fs.existsSync(distServerPath)) {
    try {
      require(distServerPath);
      console.log("[Hostinger Entrypoint Wrapper] Successfully loaded dist/server.cjs via CommonJS.");
      serverLoaded = true;
    } catch (err) {
      console.error("[Hostinger Entrypoint Wrapper] Error requiring dist/server.cjs:", err);
      logCrash(err);
    }
  }

  // Emergency Fallback Server if server.cjs failed to load or start
  if (!serverLoaded) {
    console.warn("[Hostinger Emergency Server] Starting fallback diagnostic server to prevent 503...");
    try {
      const express = require('express');
      const fallbackApp = express();
      const PORT = process.env.PORT && !isNaN(Number(process.env.PORT))
        ? parseInt(process.env.PORT, 10)
        : (process.env.PORT || 3000);

      fallbackApp.get('*', (req, res) => {
        let crashLog = '';
        try {
          const logPath = path.join(__dirname, 'server_crash.log');
          if (fs.existsSync(logPath)) {
            crashLog = fs.readFileSync(logPath, 'utf8');
          }
        } catch (e) {}

        res.status(500).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Application Startup Diagnostic</title>
            <style>
              body { font-family: sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; }
              .card { background: #1e293b; border: 1px solid #334155; padding: 24px; border-radius: 12px; max-width: 800px; margin: 40px auto; }
              h1 { color: #f43f5e; font-size: 22px; margin-top: 0; }
              pre { background: #020617; padding: 15px; border-radius: 8px; overflow-x: auto; color: #fb7185; white-space: pre-wrap; font-family: monospace; }
              .info { color: #94a3b8; font-size: 14px; margin-bottom: 15px; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Application Failed to Start</h1>
              <p class="info">The Node.js server encountered an issue during startup. Details are logged below:</p>
              <pre>${crashLog || 'No detailed crash log available. Check Hostinger logs.'}</pre>
            </div>
          </body>
          </html>
        `);
      });

      fallbackApp.listen(PORT, () => {
        console.log(`[Hostinger Emergency Server] Fallback server listening on ${PORT}`);
      });
    } catch (fallbackErr) {
      console.error("[Hostinger Emergency Server] Critical failure in fallback server:", fallbackErr);
    }
  }
}


