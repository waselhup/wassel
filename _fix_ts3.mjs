import { readFileSync, writeFileSync } from 'fs';

function fix(path, old, replacement) {
  const content = readFileSync(path, 'utf8');
  if (!content.includes(old)) {
    console.log('SKIP ' + path + ' - pattern not found');
    return;
  }
  writeFileSync(path, content.replace(old, replacement), 'utf8');
  console.log('FIXED ' + path);
}

// AuthContext: fix not all code paths return a value
// Add return undefined in catch block
fix(
  'client/src/contexts/AuthContext.tsx',
  "      } catch (err) {\n        console.error('Auth initialization error:', err);\n        setLoading(false);\n      }",
  "      } catch (err) {\n        console.error('Auth initialization error:', err);\n        setLoading(false);\n        return undefined;\n      }"
);

console.log('DONE');
