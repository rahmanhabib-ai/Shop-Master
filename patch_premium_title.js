const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `sidebarItems.flatMap(g => g.items.flatMap(i => i.subItems ? i.subItems : [i])).find(i => i.id === activeTab)?.label`;
const replacement = `sidebarItems.flatMap((g: any) => g.items.flatMap((i: any) => i.subItems ? [i, ...i.subItems] : [i])).find((i: any) => i.id === activeTab)?.label`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Premium title patched!');
} else {
  console.error('Premium title target not found!');
}
