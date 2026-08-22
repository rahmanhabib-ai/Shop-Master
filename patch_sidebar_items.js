const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `  const sidebarItems = useMemo(() => {
    const configSections = shopSettings?.sidebarConfig?.sections || DEFAULT_SIDEBAR_SECTIONS;
    
    return configSections.map((sec: any) => {
      const flattenedItems: any[] = [];
      
      (sec.items || []).forEach((item: any) => {
        const iconComponent = LucideIcons[item.iconName] || LucideIcons.FileText;
        
        // Add the main item
        flattenedItems.push({
          ...item,
          icon: iconComponent,
          subItems: undefined // Clear subItems since we flatten them
        });
        
        // If there are subItems, flatten them and add them as regular items
        if (item.subItems && Array.isArray(item.subItems)) {
          item.subItems.forEach((sub: any) => {
            flattenedItems.push({
              ...sub,
              icon: LucideIcons[sub.iconName] || LucideIcons.FileText,
              subItems: undefined
            });
          });
        }
      });
      
      return {
        ...sec,
        items: flattenedItems
      };
    });
  }, [shopSettings]);`;

const replacement = `  const sidebarItems = useMemo(() => {
    const configSections = shopSettings?.sidebarConfig?.sections || DEFAULT_SIDEBAR_SECTIONS;
    
    return configSections.map((sec: any) => {
      const parsedItems = (sec.items || []).map((item: any) => {
        return {
          ...item,
          icon: (LucideIcons as any)[item.iconName] || LucideIcons.FileText,
          subItems: item.subItems && Array.isArray(item.subItems) ? item.subItems.map((sub: any) => ({
            ...sub,
            icon: (LucideIcons as any)[sub.iconName] || LucideIcons.FileText
          })) : undefined
        };
      });
      
      return {
        ...sec,
        items: parsedItems
      };
    });
  }, [shopSettings]);`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('sidebarItems patched!');
} else {
  console.error('sidebarItems target not found!');
}
