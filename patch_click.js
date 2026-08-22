const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `  const handleClick = () => {
    if (hasSubItems) {
      setIsExpanded(!isExpanded);
    } else {
      setActiveTab(item.id);
      if (!isDesktop) {
        setIsSidebarOpen(false);
      }
    }
  };`;

const replacement = `  const handleClick = () => {
    if (hasSubItems) {
      setIsExpanded(!isExpanded);
      setActiveTab(item.id); // Parent acts as its own dashboard
    } else {
      setActiveTab(item.id);
    }
    if (!isDesktop && !hasSubItems) {
      setIsSidebarOpen(false);
    }
  };`;

if (code.includes(targetStr)) {
  fs.writeFileSync('src/App.tsx', code.replace(targetStr, replacement));
  console.log('Click handler patched!');
} else {
  console.error('Target click handler not found!');
}
