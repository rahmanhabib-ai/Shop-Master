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
  console.warn('[@tailwindcss/oxide] Native binding unavailable:', (error && error.message) || String(error));
}

if (!isWorking) {
  console.log('[@tailwindcss/oxide] Activating instant pure JavaScript fallback scanner...');
  patchOxideFallback();
}



