const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Ensure Icon is safely resolved
code = code.replace(
  'const Icon = (LucideIcons as any)[item.iconName] || LucideIcons.Circle;',
  'const Icon = item.iconName && (LucideIcons as any)[item.iconName] ? (LucideIcons as any)[item.iconName] : LucideIcons.Circle;'
);

code = code.replace(
  'const SubIcon = (LucideIcons as any)[sub.iconName] || LucideIcons.Circle;',
  'const SubIcon = sub.iconName && (LucideIcons as any)[sub.iconName] ? (LucideIcons as any)[sub.iconName] : LucideIcons.Circle;'
);

fs.writeFileSync('src/App.tsx', code);
console.log('Icons patched safely!');
