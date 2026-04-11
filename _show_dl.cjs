const fs = require('fs');
const dl = fs.readFileSync('C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2\\client\\src\\components\\DashboardLayout.tsx', 'utf8');
const lines = dl.split('\n');
for (let i = 60; i < 80; i++) {
  console.log((i+1) + ':', lines[i]);
}
