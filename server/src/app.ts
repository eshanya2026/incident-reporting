import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sendSuccess } from './common/helpers/response.js';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import roleRoutes from './modules/roles/role.routes.js';
import departmentRoutes from './modules/departments/department.routes.js';
import locationRoutes from './modules/locations/location.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import attachmentRoutes from './modules/attachments/attachment.routes.js';
import incidentRoutes from './modules/incidents/incident.routes.js';
import investigationRoutes from './modules/investigations/investigation.routes.js';
import rcaRoutes from './modules/rca/rca.routes.js';
import capaRoutes from './modules/capa/capa.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import reportRoutes from './modules/reports/report.routes.js';

const app: Express = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: [env.APP_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Request Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Global Rate Limiter
app.use(globalLimiter);

// Serve uploads directory safely
const uploadDir = path.resolve(process.cwd(), env.FILE_STORAGE_PATH);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Healthcheck Route
app.get('/health', (req: Request, res: Response) => {
  sendSuccess(
    res,
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '1.0.0',
    },
    'Adhiparasakthi Incident System API operational'
  );
});

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/attachments', attachmentRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/v1', investigationRoutes);
app.use('/api/v1', rcaRoutes);
app.use('/api/v1', capaRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportRoutes);

// Global Error Handler Middleware
app.use(errorHandler);

export default app;
