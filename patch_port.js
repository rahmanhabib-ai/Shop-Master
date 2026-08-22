const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  'const PORT = process.env.PORT && !isNaN(Number(process.env.PORT))\n    ? parseInt(process.env.PORT, 10)\n    : (process.env.PORT || 3000);',
  'const PORT = 3000;'
);
fs.writeFileSync('server.ts', code);
console.log('Port patched');
