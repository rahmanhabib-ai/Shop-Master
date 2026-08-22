const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetObj = `{
    id: 'inventory_section',
    label: 'Inventory',
    label_bn: 'ইনভেন্টরি',
    isLocked: false,
    isDeleted: false,
    visibleToRoles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team', 'warehouse'],
    items: [
      { id: 'inventory_dashboard', label: 'Inventory Dashboard', label_bn: 'ইনভেন্টরি ড্যাশবোর্ড', iconName: 'LayoutDashboard', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team', 'warehouse'] },
      { id: 'inventory', label: 'Inventory', label_bn: 'ইনভেন্টরি তালিকা', iconName: 'Package', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
      { id: 'warehouse', label: 'Warehouse', label_bn: 'গুদাম', iconName: 'Warehouse', roles: ['admin', 'manager', 'warehouse'] },
      { id: 'supplier', label: 'Supplier', label_bn: 'সরবরাহকারী', iconName: 'Users', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
      { id: 'barcode', label: 'Barcode', label_bn: 'বারকোড', iconName: 'Barcode', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
      { id: 'damage_expire', label: 'Damage/Expire', label_bn: 'ক্ষতিগ্রস্ত/মেয়াদোত্তীর্ণ', iconName: 'Trash2', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
      { id: 'stock_transfer', label: 'Stock Transfer', label_bn: 'স্টক ট্রান্সফার', iconName: 'ArrowLeftRight', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team', 'warehouse'] }
    ]
  }`;

const replacement = `{
    id: 'inventory_section',
    label: 'Inventory',
    label_bn: 'ইনভেন্টরি',
    isLocked: false,
    isDeleted: false,
    visibleToRoles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team', 'warehouse'],
    items: [
      { 
        id: 'inventory_dashboard', 
        label: 'Inventory Dashboard', 
        label_bn: 'ইনভেন্টরি ড্যাশবোর্ড', 
        iconName: 'LayoutDashboard', 
        roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team', 'warehouse'],
        subItems: [
          { id: 'inventory', label: 'Inventory', label_bn: 'ইনভেন্টরি তালিকা', iconName: 'Package', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
          { id: 'warehouse', label: 'Warehouse', label_bn: 'গুদাম', iconName: 'Warehouse', roles: ['admin', 'manager', 'warehouse'] },
          { id: 'supplier', label: 'Supplier', label_bn: 'সরবরাহকারী', iconName: 'Users', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
          { id: 'barcode', label: 'Barcode', label_bn: 'বারকোড', iconName: 'Barcode', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
          { id: 'damage_expire', label: 'Damage/Expire', label_bn: 'ক্ষতিগ্রস্ত/মেয়াদোত্তীর্ণ', iconName: 'Trash2', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
          { id: 'stock_transfer', label: 'Stock Transfer', label_bn: 'স্টক ট্রান্সফার', iconName: 'ArrowLeftRight', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team', 'warehouse'] }
        ]
      }
    ]
  }`;

if (code.includes(targetObj)) {
  fs.writeFileSync('src/App.tsx', code.replace(targetObj, replacement));
  console.log('Inventory section patched!');
} else {
  console.error('Inventory section not found in file!');
}
