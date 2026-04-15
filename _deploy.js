const { execSync } = require('child_process');
process.chdir('C:\\Users\\WIN11-24H2GPT\\Desktop\\wassel-v2');
try {
  const result = execSync('npx vercel deploy --prod --yes', {
    env: { ...process.env, PATH: 'C:\\Program Files\\nodejs;C:\\Users\\WIN11-24H2GPT\\AppData\\Roaming\\npm;C:\\Program Files\\Git\\bin;' + process.env.PATH },
    timeout: 300000,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  require('fs').writeFileSync('_deploy_out.txt', result, 'utf8');
} catch (e) {
  require('fs').writeFileSync('_deploy_out.txt', (e.stdout || '') + '\n' + (e.stderr || '') + '\nEXIT: ' + e.status, 'utf8');
}
