const path = require('node:path');

const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'sports-api',
      cwd: path.join(root, 'apps/api'),
      script: 'node_modules/.bin/tsx',
      args: 'src/server.ts',
      env: {
        NODE_ENV: 'production',
        API_PORT: '4000',
      },
      max_memory_restart: '512M',
      autorestart: true,
      watch: false,
    },
    {
      name: 'sports-web',
      cwd: path.join(root, 'apps/web'),
      script: 'node_modules/.bin/next',
      args: 'start --hostname 127.0.0.1 --port 3000',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '768M',
      autorestart: true,
      watch: false,
    },
    {
      name: 'sports-admin',
      cwd: path.join(root, 'apps/admin'),
      script: 'node_modules/.bin/next',
      args: 'start --hostname 127.0.0.1 --port 3001',
      env: {
        NODE_ENV: 'production',
        API_URL: process.env.API_URL || 'http://api.pubcms.com',
      },
      max_memory_restart: '768M',
      autorestart: true,
      watch: false,
    },
  ],
};
