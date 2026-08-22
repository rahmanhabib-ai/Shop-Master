const fs = require('fs');
const path = require('path');

const baileysEnginePath = path.join(__dirname, '..', 'node_modules', '@whiskeysockets', 'baileys', 'engine-requirements.js');

try {
  if (fs.existsSync(baileysEnginePath)) {
    fs.writeFileSync(baileysEnginePath, 'console.log("[Baileys] Node engine check bypassed for Node 18+");\n');
    console.log('[Fix Baileys] Successfully patched @whiskeysockets/baileys engine requirements check.');
  } else {
    console.log('[Fix Baileys] @whiskeysockets/baileys engine-requirements.js not found yet.');
  }
} catch (err) {
  console.error('[Fix Baileys] Error patching baileys:', err.message);
}
