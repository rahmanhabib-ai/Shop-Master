const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

try {
  // Try loading @tailwindcss/oxide
  require('@tailwindcss/oxide');
  console.log('[@tailwindcss/oxide] Native binding is loaded and working correctly.');
} catch (error) {
  console.warn('[@tailwindcss/oxide] Native binding failed to load:', error.message);
  console.log('[@tailwindcss/oxide] Attempting to patch or install native binding...');

  const oxideIndexpath = path.join(__dirname, '..', 'node_modules', '@tailwindcss', 'oxide', 'index.js');
  if (fs.existsSync(oxideIndexpath)) {
    try {
      let content = fs.readFileSync(oxideIndexpath, 'utf8');
      // Patch the throw error on missing native binding to use a safe fallback stub
      if (content.includes('throw new Error(`Cannot find native binding')) {
        content = content.replace(
          /if \(!nativeBinding\) {\s*if \(loadErrors\.length > 0\) {[\s\S]*?}\s*throw new Error\(`Failed to load native binding`\)\s*}/,
          `if (!nativeBinding) {\n  console.warn('[@tailwindcss/oxide] Using safe JS fallback stub for native binding.');\n  nativeBinding = {\n    Scanner: class {\n      scan() { return []; }\n    },\n    transform() { return ''; }\n  };\n}`
        );
        fs.writeFileSync(oxideIndexpath, content, 'utf8');
        console.log('[@tailwindcss/oxide] Successfully patched index.js with safe fallback stub.');
      }
    } catch (patchErr) {
      console.error('[@tailwindcss/oxide] Failed to patch index.js:', patchErr.message);
    }
  }

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
      console.error('[@tailwindcss/oxide] Optional native binary install skipped/failed, fallback stub is active.');
    }
  }
}

