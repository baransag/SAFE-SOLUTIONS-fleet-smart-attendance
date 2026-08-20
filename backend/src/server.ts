import app from './app';
import { config } from './config/env';
import prisma from './config/prisma';

const server = app.listen(config.port, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 SAFE SOLUTIONS Backend Server Running`);
  console.log(`📡 Port:        ${config.port}`);
  console.log(`🌐 Base URL:    http://localhost:${config.port}${config.apiPrefix}`);
  console.log(`📁 Uploads:     ${config.uploadPath}`);
  console.log(`🔧 Environment: ${config.env}`);
  console.log(`=======================================================`);

  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL Database via Prisma.');
  } catch (error) {
    console.error('❌ Failed to connect to Database:', error);
  }
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server and Database connection closed.');
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server and Database connection closed.');
  });
});
