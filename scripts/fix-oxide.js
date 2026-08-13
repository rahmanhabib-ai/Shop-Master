const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Try loading @tailwindcss/oxide
  require('@tailwindcss/oxide');
  console.log('[@tailwindcss/oxide] Native binding is loaded and working correctly.');
} catch (error) {
  console.warn('[@tailwindcss/oxide] Native binding failed to load:', error.message);
  console.log('[@tailwindcss/oxide] Attempting to install the correct native binary for this platform...');

  const platform = process.platform;
  const arch = process.arch;
  let targetPkg = '';

  if (platform === 'linux' && arch === 'x64') {
    // Check if musl or gnu
    let isMusl = false;
    try {
      if (fs.existsSync('/lib/ld-musl-x86_64.so.1') || fs.existsSync('/lib/ld-musl-x86_64.so')) {
        isMusl = true;
      } else if (process.report && typeof process.report.getReport === 'function') {
        const report = process.report.getReport();
        const reportStr = typeof report === 'string' ? report : JSON.stringify(report);
        if (reportStr.indexOf('musl') !== -1) {
          isMusl = true;
        }
      }
    } catch (e) {
      // ignore check errors
    }
    targetPkg = isMusl ? '@tailwindcss/oxide-linux-x64-musl' : '@tailwindcss/oxide-linux-x64-gnu';
  } else if (platform === 'linux' && arch === 'arm64') {
    let isMusl = false;
    try {
      if (fs.existsSync('/lib/ld-musl-aarch64.so.1') || fs.existsSync('/lib/ld-musl-aarch64.so')) {
        isMusl = true;
      } else if (process.report && typeof process.report.getReport === 'function') {
        const report = process.report.getReport();
        const reportStr = typeof report === 'string' ? report : JSON.stringify(report);
        if (reportStr.indexOf('musl') !== -1) {
          isMusl = true;
        }
      }
    } catch (e) {
      // ignore check errors
    }
    targetPkg = isMusl ? '@tailwindcss/oxide-linux-arm64-musl' : '@tailwindcss/oxide-linux-arm64-gnu';
  } else if (platform === 'win32' && arch === 'x64') {
    targetPkg = '@tailwindcss/oxide-win32-x64-msvc';
  } else if (platform === 'win32' && arch === 'arm64') {
    targetPkg = '@tailwindcss/oxide-win32-arm64-msvc';
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
      console.error('[@tailwindcss/oxide] Failed to install native binary:', installError.message);
    }
  } else {
    console.warn(`[@tailwindcss/oxide] Unsupported platform/architecture: ${platform}/${arch}`);
  }
}
