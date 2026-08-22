const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');
if (!code.includes('ErrorBoundary')) {
  code = "import ErrorBoundary from './ErrorBoundary';\n" + code;
  code = code.replace('<App />', '<ErrorBoundary><App /></ErrorBoundary>');
  fs.writeFileSync('src/main.tsx', code);
  console.log('Error boundary added');
}
