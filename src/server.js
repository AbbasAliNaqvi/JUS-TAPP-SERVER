import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import taskRoutes from './routes/taskRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import adaptiveRoutes from './routes/adaptiveRoutes.js';
import guidanceRoutes from './routes/guidanceRoutes.js';
import authRoutes from './routes/authRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import showcaseRoutes from './routes/showcaseRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import { connectDB } from './config/database.js';
import TaskPlanService from './services/taskPlanService.js';
import { existsSync } from 'fs';
import { join } from 'path';

dotenv.config();

// Initialize TaskPlanService with available API keys
TaskPlanService.initializeGroqKeys();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;
const HOST = process.env.HOST || '0.0.0.0';
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const corsOptions = corsOrigins.length
  ? { origin: corsOrigins, credentials: true }
  : { origin: true, credentials: false };

// Middleware
app.use(helmet());
app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
connectDB().catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'SmartAssist Backend'
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SmartAssist Backend',
    health: '/api/health'
  });
});

// Routes
app.use('/api/v1/task', taskRoutes);
app.use('/api/v1/session', sessionRoutes);
app.use('/api/v1/adaptive', adaptiveRoutes);
app.use('/api/v1/guidance', guidanceRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/showcase', showcaseRoutes);

const frontendDist = join(process.cwd(), 'frontend', 'dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: '1y', immutable: true }));
  app.get('/showcase', (req, res) => {
    res.sendFile(join(frontendDist, 'index.html'));
  });
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(join(frontendDist, 'index.html'));
  });
}

// Error Handler
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`SmartAssist Backend running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

export default app;
