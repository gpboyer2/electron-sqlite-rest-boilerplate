const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  schema: './src/main/server/database/schema.js',
  out: './src/main/server/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './src/main/server/data/electron-boilerplate.db'
  }
});
