const dotenv = require('dotenv');

dotenv.config();

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Fatal Error: Missing required environment variable: ${envVar}`);
  }
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('Fatal Error: JWT_SECRET must be at least 32 characters long');
}

const config = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || '',
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  ADMIN_NAME: process.env.ADMIN_NAME || 'Admin',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'replace_with_a_strong_password'
};

module.exports = config;
