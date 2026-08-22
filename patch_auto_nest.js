const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `const configSections = shopSettings?.sidebarConfig?.sections || DEFAULT_SIDEBAR_SECTIONS;`;
const replacementStr = `let configSections = shopSettings?.sidebarConfig?.sections || DEFAULT_SIDEBAR_SECTIONS;
    
    // Auto-migrate flat inventory section to nested structure
    configSections = configSections.map((sec: any) => {
      if (sec.id === 'inventory_section') {
        const hasNested = sec.items.some((i: any) => i.id === 'inventory_dashboard' && i.subItems && i.subItems.length > 0);
        if (!hasNested) {
          const inventoryItemsIds = ['inventory', 'warehouse', 'supplier', 'barcode', 'damage_expire', 'stock_transfer'];
          const subItemsToNest = sec.items.filter((i: any) => inventoryItemsIds.includes(i.id));
          const otherItems = sec.items.filter((i: any) => !inventoryItemsIds.includes(i.id) && i.id !== 'inventory_dashboard');
          
          if (subItemsToNest.length > 0) {
            return {
              ...sec,
              items: [
                { 
                  id: 'inventory_dashboard', 
                  label: 'Inventory Dashboard', 
                  label_bn: 'ইনভেন্টরি ড্যাশবোর্ড', 
                  iconName: 'LayoutDashboard', 
                  roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team', 'warehouse'],
                  subItems: subItemsToNest
                },
                ...otherItems
              ]
            };
          }
        }
      }
      return sec;
    });`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Auto-nesting logic injected!');
} else {
  console.log('Target string not found.');
}
