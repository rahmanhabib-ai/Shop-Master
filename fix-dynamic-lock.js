const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const dynamicLockInfo = useMemo\(\(\) => \{[\s\S]*?\}, \[shopSettings, activeTab, user\?\.email\]\);/;

const replacement = `const dynamicLockInfo = useMemo(() => {
    const userEmail = user?.email?.toLowerCase().trim();
    if (userEmail === 'stratproamz@gmail.com') {
      return { isLocked: false, title: '', message: '' };
    }
    
    for (const group of sidebarItems) {
      if (group.isDeleted) continue;
      
      const isSecLocked = group.isLocked;
      
      for (const item of (group.items || [])) {
        if (item.isDeleted) continue;
        
        if (item.id === activeTab) {
          if (isSecLocked) {
            return {
              isLocked: true,
              title: shopSettings?.systemLanguage === 'bn' ? (group.label_bn || group.label) : group.label,
              message: shopSettings?.customLockMessage || (shopSettings?.systemLanguage === 'bn' ? 'দুঃখিত, এই সেকশনটি বর্তমানে অ্যাডমিন কর্তৃক লক করা রয়েছে!' : 'Sorry, this section is currently locked by the administrator.')
            };
          }
          if (item.isLocked) {
            return {
              isLocked: true,
              title: shopSettings?.systemLanguage === 'bn' ? (item.label_bn || item.label) : item.label,
              message: shopSettings?.customLockMessage || (shopSettings?.systemLanguage === 'bn' ? 'দুঃখিত, এই পেজটি বর্তমানে অ্যাডমিন কর্তৃক লক করা রয়েছে!' : 'Sorry, this page is currently locked by the administrator.')
            };
          }
        }
      }
    }
    
    return { isLocked: false, title: '', message: '' };
  }, [sidebarItems, activeTab, shopSettings, user?.email]);`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', code);
