import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function patchOxideFallback() {
  try {
    const oxideDir = path.resolve(process.cwd(), 'node_modules/@tailwindcss/oxide');
    const oxideIndexPath = path.join(oxideDir, 'index.js');
    if (fs.existsSync(oxideIndexPath)) {
      console.log('[@tailwindcss/oxide] Applying pure JavaScript Scanner fallback patch to index.js...');
      const fallbackCode = `// Pure JavaScript Fallback for @tailwindcss/oxide
const fs = require('node:fs');
const path = require('node:path');

let nativeBinding = null;
try {
  const { createRequire } = require('node:module');
  // Attempt original loader if possible
} catch (e) {}

class FallbackScanner {
  constructor(options = {}) {
    this.sources = options.sources || [];
    this.files = [];
    this.globs = [];
  }
  scan() {
    const candidates = new Set();
    const scanDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      try {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of list) {
          const full = path.join(dir, item.name);
          if (item.isDirectory()) {
            if (item.name !== 'node_modules' && item.name !== 'dist' && item.name !== '.git') {
              scanDir(full);
            }
          } else if (item.isFile() && /\\.(tsx|ts|jsx|js|html|css|json)$/.test(item.name)) {
            this.files.push(full);
            const content = fs.readFileSync(full, 'utf8');
            const matches = content.match(/[a-zA-Z0-9_\\-:\\[\\]/%.#]+/g);
            if (matches) {
              for (const m of matches) candidates.add(m);
            }
          }
        }
      } catch (err) {}
    };
    scanDir(path.resolve(process.cwd(), 'src'));
    const indexHtml = path.resolve(process.cwd(), 'index.html');
    if (fs.existsSync(indexHtml)) {
      this.files.push(indexHtml);
      try {
        const content = fs.readFileSync(indexHtml, 'utf8');
        const matches = content.match(/[a-zA-Z0-9_\\-:\\[\\]/%.#]+/g);
        if (matches) {
          for (const m of matches) candidates.add(m);
        }
      } catch (e) {}
    }
    return Array.from(candidates);
  }
}

module.exports = {
  Scanner: FallbackScanner
};
module.exports.Scanner = FallbackScanner;
`;
      // Backup original index.js once
      const backupPath = path.join(oxideDir, 'index.original.js');
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(oxideIndexPath, backupPath);
      }
      fs.writeFileSync(oxideIndexPath, fallbackCode, 'utf8');
      console.log('[@tailwindcss/oxide] Successfully patched with pure JavaScript fallback scanner.');
    }
  } catch (patchErr) {
    console.warn('[@tailwindcss/oxide] Warning: Could not write fallback patch:', patchErr?.message);
  }
}

let isWorking = false;
try {
  // Try loading @tailwindcss/oxide
  const oxide = require('@tailwindcss/oxide');
  if (oxide && oxide.Scanner) {
    new oxide.Scanner({ sources: [] });
    isWorking = true;
    console.log('[@tailwindcss/oxide] Native binding is loaded and working correctly.');
  }
} catch (error) {
  console.warn('[@tailwindcss/oxide] Native binding failed to load:', (error && error.message) || String(error));
}

if (!isWorking) {
  console.log('[@tailwindcss/oxide] Attempting to install native binding...');

  const platform = process.platform;
  const arch = process.arch;
  let targetPkg = '';

  if (platform === 'linux' && arch === 'x64') {
    let isMusl = false;
    try {
      if (fs.existsSync('/lib/ld-musl-x86_64.so.1') || fs.existsSync('/lib/ld-musl-x86_64.so')) {
        isMusl = true;
      }
    } catch (e) {}
    targetPkg = isMusl ? '@tailwindcss/oxide-linux-x64-musl' : '@tailwindcss/oxide-linux-x64-gnu';
  } else if (platform === 'linux' && arch === 'arm64') {
    targetPkg = '@tailwindcss/oxide-linux-arm64-gnu';
  } else if (platform === 'win32' && arch === 'x64') {
    targetPkg = '@tailwindcss/oxide-win32-x64-msvc';
  } else if (platform === 'darwin' && arch === 'x64') {
    targetPkg = '@tailwindcss/oxide-darwin-x64';
  } else if (platform === 'darwin' && arch === 'arm64') {
    targetPkg = '@tailwindcss/oxide-darwin-arm64';
  }

  if (targetPkg) {
    console.log(`[@tailwindcss/oxide] Selected package for installation: ${targetPkg}`);
    try {
      execSync(`npm install --no-save --legacy-peer-deps ${targetPkg}`, { stdio: 'inherit' });
      console.log('[@tailwindcss/oxide] Successfully installed native binary.');
    } catch (installError) {
      console.warn('[@tailwindcss/oxide] Optional native binary install failed or restricted.');
    }
  }

  // Re-verify after install attempt
  try {
    const oxide = require('@tailwindcss/oxide');
    if (oxide && oxide.Scanner) {
      new oxide.Scanner({ sources: [] });
      isWorking = true;
      console.log('[@tailwindcss/oxide] Native binding successfully verified.');
    }
  } catch (verifyErr) {
    console.warn('[@tailwindcss/oxide] Native binding still unavailable. Activating pure JavaScript fallback...');
    patchOxideFallback();
  }
}


