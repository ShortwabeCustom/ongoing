/**
 * PM2 Ecosystem Configuration
 *
 * PRODUCTION DEPLOYMENT ONLY
 *
 * This file ensures the app always runs in production mode.
 * Start with: pm2 start ecosystem.config.js
 * Save state: pm2 save
 *
 * DO NOT USE: pm2 start "npm run dev"
 * ONLY USE:   pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'uix',
      script: 'npm',
      args: 'start',  // ← CRITICAL: Runs 'next start' (production)
      instances: 1,
      exec_mode: 'fork',
      port: 3000,

      // Performance
      node_args: '--max-old-space-size=2048',
      max_memory_restart: '500M',

      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',

      // Safety
      autorestart: false,  // ← Explicit: require manual restart after crash
      watch: false,        // ← Explicit: don't watch for file changes

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
