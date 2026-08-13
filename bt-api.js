const { spawn } = require('node:child_process');

const child = spawn('pnpm', ['start:api'], {
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
    API_PORT: process.env.API_PORT || '4000',
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
