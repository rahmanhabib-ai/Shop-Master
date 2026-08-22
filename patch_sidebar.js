const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `const SidebarNavItem = ({ item, idx, activeTab, setActiveTab, setIsSidebarOpen, isDesktop, user, isMasterAdmin, shopSettings }: any) => {
  const hasSubItems = item.subItems && item.subItems.length > 0;
  
  // Is this item or any of its sub-items active?
  const isSelfActive = activeTab === item.id;
  const isAnySubActive = hasSubItems && item.subItems.some((sub: any) => sub.id === activeTab);
  const isItemActive = isSelfActive || isAnySubActive;

  const [isExpanded, setIsExpanded] = React.useState(() => {
    return isAnySubActive;
  });

  const Icon = (LucideIcons as any)[item.iconName] || LucideIcons.Circle;
  const theme = getThemeByModule(item.id);
  
  const isBn = shopSettings?.systemLanguage === 'bn';
  const label = isBn ? (item.label_bn || item.label) : item.label;

  const handleClick = () => {
    if (hasSubItems) {
      setIsExpanded(!isExpanded);
    } else {
      setActiveTab(item.id);
      if (!isDesktop) {
        setIsSidebarOpen(false);
      }
    }
  };

  const bgClass = item.bg || theme.bg;
  const colorClass = item.color || theme.color;
  const borderClass = item.border || theme.border;

  const checkPremiumStatus = () => {
    if (user?.email?.toLowerCase().trim() === 'stratproamz@gmail.com') return true;
    if (user?.role === 'master_admin' || user?.shopId === 'master') return true;
    if (shopSettings?.premiumActive) return true;
    if (shopSettings?.plan && shopSettings.plan !== 'free') return true;
    if (shopSettings?.packageType === 'lifetime' || (shopSettings as any)?.lifetime) return true;
    
    if (shopSettings?.premiumUntil) {
      const untilDate = safeDate(shopSettings.premiumUntil);
      if (untilDate.getTime() > new Date().getTime()) return true;
    }
    
    const createdDate = shopSettings?.createdAt ? safeDate(shopSettings.createdAt) : new Date();
    const trialEnd = new Date(createdDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (trialEnd.getTime() > new Date().getTime()) return true;
    
    return false;
  };
  
  const isPremiumUnlocked = checkPremiumStatus();
  const PREMIUM_ONLY_IDS = ['jarvis', 'payment_method', 'loan_management', 'live_tv', 'business_bio', 'business_mail', 'accounting', 'daily_closing', 'warranty', 'note', 'online_shop', 'store_builder', 'messaging_gateway', 'custom_domain'];

  return (
    <div className="flex flex-col w-full relative">
      <motion.button
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: idx * 0.02, ease: "easeOut" }}
        whileHover={{ x: 4, scale: 1.005 }}
        whileTap={{ scale: 0.99 }}
        onClick={handleClick}
        className={\`w-full flex items-center justify-between group px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden outline-none \${
          isItemActive                
            ? \`\${bgClass} dark:bg-indigo-950/30 \${colorClass} shadow-sm ring-1 \${borderClass} font-bold\` 
            : 'text-gray-500 dark:text-gray-400 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-gray-100 border border-transparent'
        }\`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
        <div className="flex items-center justify-between gap-2.5 relative z-10 w-full">
          <div className="flex items-center gap-2.5">
            <div className={\`p-2 rounded-lg transition-all duration-300 shadow-sm \${
              isItemActive 
                ? 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 shadow-sm' 
                : theme.iconInactive
            }\`}>
              <Icon className={\`w-4 h-4 transition-transform duration-300 group-hover:scale-110 \${
                isItemActive ? \`\${colorClass} dark:text-indigo-400\` : ''
              }\`} />
            </div>
            <span className={\`text-[12.5px] font-bold tracking-tight transition-colors duration-300 \${
              isItemActive ? '' : \`group-hover:\${colorClass}\`
            }\`}>{label}</span>
            
            {/* Version Badge for How To Use */}
            {item.id === 'how_to_use' && (
              <div className="relative group/version shrink-0 flex items-center justify-center pointer-events-auto">
                <Info className="w-3.5 h-3.5 text-indigo-400 hover:text-indigo-600 transition-colors animate-pulse" />
                <div className="absolute left-full ml-2 px-2 py-0.5 text-[9px] font-black bg-slate-800 text-white dark:bg-slate-755 rounded shadow-md opacity-0 group-hover/version:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 leading-relaxed font-mono">
                  v4.3.5
                </div>
              </div>
            )}

            {/* Premium locks indicator */}
            {PREMIUM_ONLY_IDS.includes(item.id) && !isPremiumUnlocked && (
              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
            )}
          </div>
          {hasSubItems && (
            <div className="flex items-center shrink-0">
              <ChevronDown className={\`w-4 h-4 text-gray-400 transition-transform duration-300 \${isExpanded ? 'rotate-180' : ''}\`} />
            </div>
          )}
        </div>
        {isItemActive && !hasSubItems && (
          <motion.div 
            layoutId="active-indicator"
            className={\`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full \${theme.accent}\`}
          />
        )}
      </motion.button>
      
      {/* Sub-items rendering */}
      {hasSubItems && (
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-1 space-y-1 ml-4 pl-3 border-l-2 border-indigo-100/50 dark:border-indigo-900/30"
            >
              {item.subItems.map((sub: any, subIdx: number) => {
                const isSubActive = activeTab === sub.id;
                const SubIcon = (LucideIcons as any)[sub.iconName] || LucideIcons.Circle;
                const subLabel = isBn ? (sub.label_bn || sub.label) : sub.label;
                const subTheme = getThemeByModule(sub.id);

                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setActiveTab(sub.id);
                      if (!isDesktop) setIsSidebarOpen(false);
                    }}
                    className={\`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group \${
                      isSubActive 
                        ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-bold ring-1 ring-slate-100/50' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                    }\`}
                  >
                    <div className={\`p-1.5 rounded-lg transition-colors \${
                      isSubActive ? subTheme.bg : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                    }\`}>
                      <SubIcon className={\`w-3.5 h-3.5 \${isSubActive ? subTheme.color : 'text-gray-400 group-hover:text-gray-600'}\`} />
                    </div>
                    <span className="text-[11.5px] font-bold tracking-tight">{subLabel}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};`;

const targetStart = `const SidebarNavItem = ({ item, idx, activeTab, setActiveTab, setIsSidebarOpen, isDesktop, user, isMasterAdmin, shopSettings }: any) => {`;
const targetEnd = `      </motion.button>
    </div>
  );
};`;

let startIndex = code.indexOf(targetStart);
let endIndex = code.indexOf(targetEnd, startIndex);
if (startIndex !== -1 && endIndex !== -1) {
  const finalCode = code.substring(0, startIndex) + replacement + code.substring(endIndex + targetEnd.length);
  fs.writeFileSync('src/App.tsx', finalCode);
  console.log('SidebarNavItem replaced successfully.');
} else {
  console.error('Target not found!');
}
