require('dotenv').config();

// Validar variables críticas antes de arrancar
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`❌ Variables de entorno faltantes: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET debe tener al menos 32 caracteres');
  process.exit(1);
}
if (process.env.JWT_SECRET === 'cambiar_en_produccion_por_secreto_seguro') {
  console.warn('⚠️  JWT_SECRET usa el valor por defecto — cambia en producción');
}

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
const cotizacionRoutes = require('./routes/cotizaciones');
const ventaRoutes = require('./routes/ventas');
const sunatRoutes = require('./routes/sunat');
const adminRoutes = require('./routes/admin');
const n8nRoutes = require('./routes/n8n');
const leadsRoutes = require('./routes/leads');
const citasRoutes = require('./routes/citas');
const importarRoutes = require('./routes/importar');
const vehiculoRoutes = require('./routes/vehiculos');
const clienteRoutes = require('./routes/clientes');
const usuarioRoutes = require('./routes/usuarios');
const patronRoutes = require('./routes/patron');
const chatRoutes = require('./routes/chat');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.CORS_EXTRA_ORIGIN,
  'https://crm.llantaland.com',    // dominio de producción
  'http://crm.llantaland.com',
  'http://localhost',
  'http://localhost:5173',
  `http://${process.env.VPS_IP || '161.97.102.3'}`,
].filter(Boolean);

// El chat del cliente es público (llantaland.com, landings de ads, etc.):
// CORS abierto solo para /api/chat y el socket, sin credenciales.
app.use('/api/chat', cors({ origin: true, credentials: false }));

const strictCors = cors({
  origin: (origin, cb) => {
    // Requests sin origin: n8n server-side, mobile apps, curl — permitir
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} no permitido por CORS`));
  },
  credentials: true,
});
// El resto de la API mantiene el CORS estricto; /api/chat ya quedó resuelto arriba.
app.use((req, res, next) => (req.path.startsWith('/api/chat') ? next() : strictCors(req, res, next)));
app.use(morgan('dev'));
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// Fallback: serve built-in audio files from src/assets/audios (never a Docker volume)
// so they survive EasyPanel rebuilds without manual restore.
app.use('/uploads/audios', express.static(path.join(__dirname, 'assets', 'audios')));
app.use('/media', express.static(path.join(__dirname, '..', 'media')));
app.use('/media/audios', express.static(path.join(__dirname, 'assets', 'audios')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sedes', sedeRoutes);
app.use('/api/cotizaciones', cotizacionRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/sunat', sunatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/n8n', n8nRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/importar', importarRoutes);
app.use('/api/vehiculos', vehiculoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/patron', patronRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', build: '2026-06-16-busqueda-factiliza-v13', timestamp: new Date() }));


app.use(errorHandler);

// ─── Servidor HTTP + WebSocket (chat interno en vivo) ───────────────────────
const http = require('http');
const { Server } = require('socket.io');
const { setIO } = require('./lib/io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
  path: '/socket.io',
});
setIO(io);

io.on('connection', (socket) => {
  // El cliente web se une a su sala de sesión; el vendedor a la sala general.
  socket.on('chat:join', (sessionId) => {
    if (typeof sessionId === 'string' && sessionId) socket.join('chat:' + sessionId);
  });
  socket.on('vendedor:join', () => socket.join('vendedores'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Llantaland CRM API + WebSocket en puerto ${PORT}`);
});

module.exports = app;
