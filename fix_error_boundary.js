const fs = require('fs');
let code = fs.readFileSync('src/ErrorBoundary.tsx', 'utf8');
code = code.replace('class ErrorBoundary extends React.Component {', 'class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, errorInfo: React.ErrorInfo | null }> {');
fs.writeFileSync('src/ErrorBoundary.tsx', code);
