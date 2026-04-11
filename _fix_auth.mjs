import { readFileSync, writeFileSync } from 'fs';

const file = 'client/src/contexts/AuthContext.tsx';
let content = readFileSync(file, 'utf8');

const oldStr = `      } catch (err) {
        console.error('Auth initialization error:', err);
        setLoading(false);
      }`;

const newStr = `      } catch (err) {
        console.error('Auth initialization error:', err);
        setLoading(false);
        return undefined;
      }`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  writeFileSync(file, content, 'utf8');
  console.log('FIXED: AuthContext.tsx - added return undefined to catch block');
} else {
  console.log('SKIP: Pattern not found or already fixed');
}
