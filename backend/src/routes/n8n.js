/**
 * Rutas n8n — reemplazan Google Sheets en el flujo de WhatsApp.
 * Autenticadas con N8N_API_KEY (header x-n8n-api-key o Authorization Bearer).
 */
const router = require('express').Router();
const { n8nAuth } = require('../middleware/n8nAuth');
const {
  leerCRM, crearCRM, actualizarCRM, resetearCRM,
  listarPrecios,
  obtenerCostoTraslado,
  listarLocales,
  guardarHistorial, leerHistorial,
  activarHumanTakeover, leerHumanTakeover,
  marcarOptOut, listarOptOut,
  guardarLogistica, listarLogistica, actualizarLogistica,
  registrarVenta,
  guardarColaReintento,
  listarRecordatorios, marcarRecordatorio,
  patronLead, patronListarPersonajes, patronCostoDistrito, patronCita,
} = require('../controllers/n8nController');

router.use(n8nAuth);

// ── CRM (hoja CRM) ────────────────────────────────────────────
router.get('/crm/:telefono',        leerCRM);          // LECTURA CRM | Base*
router.post('/crm',                 crearCRM);         // CRM | Crear Fila Nueva
router.patch('/crm/:telefono',      actualizarCRM);    // PASO | Guardar ...
router.post('/crm/:telefono/reset', resetearCRM);      // CRM | Resetear Paso_Actual

// ── Catálogo (hoja PRECIOS) ───────────────────────────────────
router.get('/precios',              listarPrecios);    // Consultar Catalogo Completo
router.get('/costo-traslado',       obtenerCostoTraslado); // Costo fijo de traslado entre tiendas (Precios y Margen)

// ── Locales (hoja LOCALES) ────────────────────────────────────
router.get('/locales',              listarLocales);    // MOD | Consultar Locales

// ── Historial (hoja HISTORIAL) ────────────────────────────────
router.post('/historial',                      guardarHistorial);  // HISTORIAL | Guardar Mensaje
router.get('/historial/:telefono',             leerHistorial);     // HISTORIAL | Leer Mensajes

// ── Human Takeover (hoja HUMAN_TAKEOVER) ─────────────────────
router.post('/human-takeover',                 activarHumanTakeover);
router.get('/human-takeover/:telefono',        leerHumanTakeover);

// ── Opt-Out (hoja OPT_OUT) ────────────────────────────────────
router.post('/opt-out',            marcarOptOut);
router.get('/opt-out',             listarOptOut);

// ── Logística pendiente (hoja LOGISTICA_PENDIENTE) ────────────
router.post('/logistica',          guardarLogistica);
router.get('/logistica',           listarLogistica);
router.patch('/logistica/:id',     actualizarLogistica);

// ── Registro de ventas (hoja Registro_Ventas) ─────────────────
router.post('/ventas',             registrarVenta);

// ── Cola de reintentos (hoja Cola_Reintentos) ─────────────────
router.post('/cola-reintentos',    guardarColaReintento);

// ── Recuperación de carrito (recordatorios 15min / 3h / 21h) ──
router.get('/recordatorios',          listarRecordatorios);  // ?nivel=15m|3h|21h
router.post('/recordatorios/marcar',  marcarRecordatorio);   // { telefono, nivel }

// ── Negocio "El Patrón" (shows de personajes) ─────────────────
router.post('/patron/lead',              patronLead);
router.get('/patron/personajes',         patronListarPersonajes);
router.get('/patron/distritos/:distrito', patronCostoDistrito);
router.post('/patron/cita',              patronCita);

module.exports = router;
