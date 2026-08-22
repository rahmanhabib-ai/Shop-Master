const code = require('fs').readFileSync('src/App.tsx', 'utf8');
try {
  require('@babel/parser').parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  console.log('Syntax OK');
} catch (e) {
  console.log('Syntax Error:', e.message);
}
