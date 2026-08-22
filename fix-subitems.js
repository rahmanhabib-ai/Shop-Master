const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex1 = /          \{hasSubItems && \([\s\S]*?<\/div>\s*\)\}\s*<\/div>\s*\{isSelfActive && \(/;
code = code.replace(regex1, `          </div>
        {isSelfActive && (`);

const regex2 = /      <\/motion\.button>\s*\{hasSubItems && \([\s\S]*?<\/AnimatePresence>\s*\)\}\s*<\/div>\s*\);\s*\};\s*function PremiumWarningPopup/m;
code = code.replace(regex2, `      </motion.button>
    </div>
  );
};

function PremiumWarningPopup`);

fs.writeFileSync('src/App.tsx', code);
