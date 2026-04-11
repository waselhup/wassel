const fs = require('fs');

const file = 'client/src/contexts/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldStr = "      } catch (err) {\n        console.error('Auth initialization error:', err);\n        setLoading(false);\n      }";

const newStr = "      } catch (err) {\n        console.error('Auth initialization error:', err);\n        setLoading(false);\n        return undefined;\n      }";

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log('FIXED: AuthContext.tsx - added return undefined to catch block');
} else {
  console.log('SKIP: Pattern not found or already fixed');
}
