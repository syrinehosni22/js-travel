/**
 * PM2 — API JS Travel Tunisia
 *   cd server && pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [{
    name: 'js-travel-api',
    cwd: __dirname,
    script: 'src/index.js',
    env: { NODE_ENV: 'production', PORT: 4000 },
    instances: 1,
    autorestart: true,
    max_memory_restart: '400M',
    time: true,
    out_file: `${__dirname}/logs/api.out.log`,
    error_file: `${__dirname}/logs/api.err.log`,
  }],
};
