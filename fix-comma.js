const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const bad = `        </AnimatePresence>
        document.body
      )}
    </div>`;
const good = `        </AnimatePresence>,
        document.body
      )}
    </div>`;

code = code.replace(bad, good);
fs.writeFileSync('src/App.tsx', code);
