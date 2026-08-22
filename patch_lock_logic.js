const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `    for (const group of sidebarItems) {
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
    }`;

const replacement = `    for (const group of sidebarItems) {
      if (group.isDeleted) continue;
      
      const isSecLocked = group.isLocked;
      
      for (const item of (group.items || [])) {
        if (item.isDeleted) continue;
        
        // Check main item
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
        
        // Check sub-items
        if (item.subItems && Array.isArray(item.subItems)) {
          for (const sub of item.subItems) {
            if (sub.isDeleted) continue;
            
            if (sub.id === activeTab) {
              if (isSecLocked) {
                return {
                  isLocked: true,
                  title: shopSettings?.systemLanguage === 'bn' ? (group.label_bn || group.label) : group.label,
                  message: shopSettings?.customLockMessage || (shopSettings?.systemLanguage === 'bn' ? 'দুঃখিত, এই সেকশনটি বর্তমানে অ্যাডমিন কর্তৃক লক করা রয়েছে!' : 'Sorry, this section is currently locked by the administrator.')
                };
              }
              if (sub.isLocked || item.isLocked) {
                return {
                  isLocked: true,
                  title: shopSettings?.systemLanguage === 'bn' ? (sub.label_bn || sub.label) : sub.label,
                  message: shopSettings?.customLockMessage || (shopSettings?.systemLanguage === 'bn' ? 'দুঃখিত, এই পেজটি বর্তমানে অ্যাডমিন কর্তৃক লক করা রয়েছে!' : 'Sorry, this page is currently locked by the administrator.')
                };
              }
            }
          }
        }
      }
    }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Lock logic patched!');
} else {
  console.error('Lock logic target not found!');
}
