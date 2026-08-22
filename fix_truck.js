const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

// Find line 114 (1-indexed, so index 113)
if (lines[113].includes('Truck')) {
  lines.splice(113, 1);
  fs.writeFileSync('src/App.tsx', lines.join('\n'));
  console.log('Fixed duplicate Truck import');
} else {
  console.error('Truck not found on line 114');
}
