import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import distributorRoutes from './routes/distributorRoutes.js';
import routeRoutes from './routes/routeRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dailyOperationsRoutes from './routes/dailyOperationsRoutes.js';

const app = express();
const PORT = process.env.PORT || 5055;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-distributor-id']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite Schema
initDatabase();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', distributorRoutes);
app.use('/api', routeRoutes);
app.use('/api', shopRoutes);
app.use('/api', vehicleRoutes);
app.use('/api', salesRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api', reportRoutes);
app.use('/api', dailyOperationsRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'OshadaDistribute Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Multi-Distributor API Server running at http://localhost:${PORT}`);
});

export default app;
