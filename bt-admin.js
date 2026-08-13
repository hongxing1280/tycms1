const { spawn } = require('node:child_process');

const child = spawn('pnpm', ['start:admin'], {
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
    API_URL: process.env.API_URL || 'http://api.pubcms.com',
  },
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
