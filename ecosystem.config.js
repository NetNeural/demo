const path = require('path');

module.exports = {
  apps: [
    {
      name: 'netneural-nextjs',
      script: 'bash',
      args: ['pm2-nextjs.sh'],
      cwd: path.join(__dirname, 'development'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        FORCE_COLOR: '1'
      },
      error_file: path.join(__dirname, 'development', 'logs', 'pm2-nextjs-error.log'),
      out_file: path.join(__dirname, 'development', 'logs', 'pm2-nextjs-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'netneural-edge-functions',
      script: 'bash',
      args: ['pm2-edge-functions.sh'],
      cwd: path.join(__dirname, 'development'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      env: {
        FORCE_COLOR: '1'
      },
      error_file: path.join(__dirname, 'development', 'logs', 'pm2-edge-functions-error.log'),
      out_file: path.join(__dirname, 'development', 'logs', 'pm2-edge-functions-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
