import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/safe_solutions_db?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'safe_solutions_enterprise_jwt_super_secret_key_2026_change_in_prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadPath: process.env.UPLOAD_PATH || path.resolve(__dirname, '../../uploads'),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '15', 10),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5000,http://127.0.0.1:3000').split(','),
};
