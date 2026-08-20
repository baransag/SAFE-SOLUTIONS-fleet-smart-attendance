import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employee.routes';
import vehicleRoutes from './routes/vehicle.routes';
import attendanceRoutes from './routes/attendance.routes';
import fuelRoutes from './routes/fuel.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import reportRoutes from './routes/report.routes';
import locationRoutes from './routes/location.routes';
import auditRoutes from './routes/audit.routes';
import notificationRoutes from './routes/notification.routes';

const app: Express = express();

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static file serving for uploads (selfies, meter photos, receipts, invoices)
app.use('/uploads', express.static(config.uploadPath));

// Health check
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    system: 'SAFE SOLUTIONS Fleet & Smart Attendance REST API',
    timestamp: new Date().toISOString(),
    env: config.env,
  });
});

// API Routes Mounting
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/employees`, employeeRoutes);
app.use(`${config.apiPrefix}/vehicles`, vehicleRoutes);
app.use(`${config.apiPrefix}/attendance`, attendanceRoutes);
app.use(`${config.apiPrefix}/fuel`, fuelRoutes);
app.use(`${config.apiPrefix}/maintenance`, maintenanceRoutes);
app.use(`${config.apiPrefix}/reports`, reportRoutes);
app.use(`${config.apiPrefix}/locations`, locationRoutes);
app.use(`${config.apiPrefix}/audit`, auditRoutes);
app.use(`${config.apiPrefix}/notifications`, notificationRoutes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// Global Centralized Error Handler
app.use(errorHandler);

export default app;
