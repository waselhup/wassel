const fs = require('fs');
const dl = fs.readFileSync('C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2\\client\\src\\components\\DashboardLayout.tsx', 'utf8');
// Show the outer div line
const lines = dl.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('flex h-screen') || lines[i].includes('flex-direction') || lines[i].includes('row-reverse') || lines[i].includes('direction:')) {
    console.log((i+1) + ':', lines[i]);
  }
}
console.log('---');
// Show sidebar aside section
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<aside') || lines[i].includes('aside>') || (lines[i].includes('borderInline') && !lines[i].includes('//'))) {
    console.log((i+1) + ':', lines[i]);
  }
}
console.log('--- Total lines:', lines.length);
