require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const productoRoutes = require('./routes/productos');
const stockRoutes = require('./routes/stock');
const sedeRoutes = require('./routes/sedes');
const ventaRoutes = require('./routes/ventas');
const sunatRoutes = require('./routes/sunat');
const adminRoutes = require('./routes/admin');
const n8nRoutes = require('./routes/n8n');
const leadsRoutes = require('./routes/leads');
const importarRoutes = require('./routes/importar');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.CORS_EXTRA_ORIGIN,
  'http://localhost',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sin origin (n8n server-side, curl, etc.)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // En VPS propio, aceptar todo; ajustar en prod
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sedes', sedeRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/sunat', sunatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/n8n', n8nRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/importar', importarRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Llantaland CRM API corriendo en puerto ${PORT}`);
});

module.exports = app;
