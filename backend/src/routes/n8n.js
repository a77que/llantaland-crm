/**
 * Rutas n8n — reemplazan Google Sheets en el flujo de WhatsApp.
 * Autenticadas con N8N_API_KEY (header x-n8n-api-key o Authorization Bearer).
 */
const router = require('express').Router();
const { n8nAuth } = require('../middleware/n8nAuth');
const {
  leerCRM, crearCRM, actualizarCRM, resetearCRM,
  listarPrecios,
  listarLocales,
  guardarHistorial, leerHistorial,
  activarHumanTakeover, leerHumanTakeover,
  marcarOptOut, listarOptOut,
  guardarLogistica, listarLogistica, actualizarLogistica,
  registrarVenta,
  guardarColaReintento,
} = require('../controllers/n8nController');

router.use(n8nAuth);

// ── CRM (hoja CRM) ────────────────────────────────────────────
router.get('/crm/:telefono',        leerCRM);          // LECTURA CRM | Base*
router.post('/crm',                 crearCRM);         // CRM | Crear Fila Nueva
router.patch('/crm/:telefono',      actualizarCRM);    // PASO | Guardar ...
router.post('/crm/:telefono/reset', resetearCRM);      // CRM | Resetear Paso_Actual

// ── Catálogo (hoja PRECIOS) ───────────────────────────────────
router.get('/precios',              listarPrecios);    // Consultar Catalogo Completo

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

module.exports = router;
