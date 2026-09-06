const path = require('path');
const tsxCli = path.join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');

module.exports = {
  apps: [
    {
      name: 'saji-bot',
      script: tsxCli,
      args: 'src/index.ts',
      cwd: __dirname,
      interpreter: 'node',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'saji-api',
      script: tsxCli,
      args: 'src/api.ts',
      cwd: __dirname,
      interpreter: 'node',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
