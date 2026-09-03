const path = require('path');
const tsxCli = path.join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');

module.exports = {
  apps: [
    {
      name: 'hermes-mealplan-bot',
      script: tsxCli,
      args: 'src/index.ts',
      interpreter: 'node',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'hermes-mealplan-dashboard',
      script: tsxCli,
      args: 'src/dashboard.ts',
      interpreter: 'node',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
