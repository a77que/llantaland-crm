import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Endpoints genéricos compartidos entre los negocios (Llantas / Patrón) — se les
// inyecta automáticamente el tipoNegocio activo para que cada vista solo vea lo suyo.
const NEGOCIO_PATHS = ['/leads', '/citas', '/cotizaciones', '/ventas'];

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const url = config.url || '';
  if (NEGOCIO_PATHS.some(p => url === p || url.startsWith(p))) {
    const tipoNegocio = useAuthStore.getState().businessType === 'patron' ? 'PATRON' : 'LLANTAS';
    if (config.method === 'get') {
      config.params = { tipoNegocio, ...config.params };
    } else if (['post', 'put', 'patch'].includes(config.method) && config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
      if (config.data.tipoNegocio === undefined) config.data.tipoNegocio = tipoNegocio;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export default api;

// ─── Helpers por módulo ─────────────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const leadsApi = {
  listar:            (params)   => api.get('/leads', { params }),
  resumen:           ()         => api.get('/leads/resumen'),
  obtener:           (id)       => api.get(`/leads/${id}`),
  obtenerPorTelefono:(tel)      => api.get(`/leads/tel/${tel}`),
  actualizar:        (id, data) => api.put(`/leads/${id}`, data),
  eliminar:          (id)       => api.delete(`/leads/${id}`),
  noDesea:           (id)       => api.post(`/leads/${id}/no-desea`),
  deshacerNoDesea:   (id)       => api.post(`/leads/${id}/no-desea/deshacer`),
};

// Campos técnicos que la IA pudo haber dejado con basura ("null", "[object Object]"…).
const TECH_FIELDS = ['indice_carga', 'velocidad_max', 'garantia', 'cargaMaxNeumatico', 'velocidadMaxKmh', 'eficienciaCombustible', 'eficienciaFrenado', 'nivelRuido', 'paisFabricacion', 'origenMarca', 'fichaTecnica'];
const BASURA = new Set(['', 'null', 'undefined', 'nan', 'n/a', 'na', '-', '--', '.', '[object object]', 'none', 'no especificado', 'no disponible', 'sin información', 'sin informacion']);
// Índice de velocidad: si quedó como número (km/h), mostrar la LETRA correcta.
const KMH_A_LETRA = { 100:'J',110:'K',120:'L',130:'M',140:'N',150:'P',160:'Q',170:'R',180:'S',190:'T',200:'U',210:'H',240:'V',270:'W',300:'Y' };
function indiceVelocidadLetra(v) {
  let s = String(v).trim().toUpperCase();
  if (s === 'ZR') return 'ZR';
  if (/^[A-Z]\d?$/.test(s)) return s;
  const m = s.match(/(\d{2,3})/);
  if (m) {
    const n = parseInt(m[1]);
    if (KMH_A_LETRA[n]) return KMH_A_LETRA[n];
    const keys = Object.keys(KMH_A_LETRA).map(Number).sort((a, b) => a - b);
    for (const k of keys) if (n <= k) return KMH_A_LETRA[k];
    return 'Y';
  }
  return null;
}
// Limpia valores basura → null, y corrige los campos que deben ser LETRA.
function limpiarProducto(p) {
  if (!p || typeof p !== 'object') return p;
  for (const f of TECH_FIELDS) {
    const v = p[f];
    if (typeof v === 'string' && BASURA.has(v.trim().toLowerCase())) p[f] = null;
    else if (v !== null && typeof v === 'object') p[f] = null;
  }
  if (p.velocidad_max != null) p.velocidad_max = indiceVelocidadLetra(p.velocidad_max); // número → letra
  for (const f of ['eficienciaCombustible', 'eficienciaFrenado']) {                      // solo letras A–G
    if (p[f] != null && !/^[A-G]$/.test(String(p[f]).trim().toUpperCase())) p[f] = null;
  }
  return p;
}

export const productosApi = {
  listar: (params) => api.get('/productos', { params }).then(r => {
    if (r && Array.isArray(r.data)) r.data = r.data.map(limpiarProducto);
    return r;
  }),
  obtener: (id) => api.get(`/productos/${id}`).then(limpiarProducto),
  crear: (data) => api.post('/productos', data),
  actualizar: (id, data) => api.put(`/productos/${id}`, data),
  eliminar: (id) => api.delete(`/productos/${id}`),
  eliminarMasivo: (ids) => api.post('/productos/eliminar-masivo', { ids }),
  eliminarPorSku: (skus) => api.post('/productos/eliminar-sku', { skus }),
  compatibles: (params) => api.get('/productos/compatibles', { params }).then(r => Array.isArray(r) ? r.map(limpiarProducto) : r),
  marcas: () => api.get('/productos/marcas'),
  tipos: () => api.get('/productos/tipos'),
  medidas: (q) => api.get('/productos/medidas', { params: q ? { q } : {} }),
  enriquecer: (id) => api.post(`/productos/${id}/enriquecer-ia`),
  hermanasImagen: (id) => api.get(`/productos/${id}/hermanas`),
  aplicarImagen: (data) => api.post('/productos/aplicar-imagen', data),
  gruposImagen: (modo) => api.get('/productos/grupos-imagen', { params: modo ? { modo } : {}, timeout: 60000 }),
  subirImagenMultiple: (formData) => api.post('/productos/imagen-multiple', formData, { timeout: 120000 }),
  faltantesImagenExport: () => api.get('/productos/imagenes/faltantes-export', { responseType: 'blob', timeout: 120000 }),
  incompletos: () => api.get('/productos/incompletos', { timeout: 60000 }),
  enriquecerMasivo: (ids) => api.post('/productos/enriquecer-masivo', { ids }, { timeout: 240000 }),
  sincronizarPrecioRegular: () => api.post('/productos/sync-precios-regulares'),
  subirImagen: (id, formData) => api.post(`/productos/${id}/imagenes`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const stockApi = {
  listar: (params) => api.get('/stock', { params }),
  actualizar: (productoId, sedeId, data) => api.put(`/stock/${productoId}/${sedeId}`, data),
  movimiento: (data) => api.post('/stock/movimiento', data),
};

export const sedesApi = {
  listar:    ()         => api.get('/sedes'),
  obtener:   (id)       => api.get(`/sedes/${id}`),
  crear:     (data)     => api.post('/sedes', data),
  actualizar:(id, data) => api.put(`/sedes/${id}`, data),
};

export const cotizacionesApi = {
  listar:          (params)   => api.get('/cotizaciones', { params }),
  obtener:         (id)       => api.get(`/cotizaciones/${id}`),
  crear:           (data)     => api.post('/cotizaciones', data),
  actualizar:      (id, data) => api.put(`/cotizaciones/${id}`, data),
  convertirAVenta: (id)       => api.post(`/cotizaciones/${id}/convertir`),
  generarPdf:      (id)       => api.post(`/cotizaciones/${id}/pdf`),
};

export const ventasApi = {
  listar: (params) => api.get('/ventas', { params }),
  obtener: (id) => api.get(`/ventas/${id}`),
  crear: (data) => api.post('/ventas', data),
  generarPdf: (id) => api.post(`/ventas/${id}/pdf`),
};

export const sunatApi = {
  getConfig: () => api.get('/sunat/config'),
  saveConfig: (data) => api.post('/sunat/config', data),
  emitir: (ventaId) => api.post(`/sunat/emitir/${ventaId}`),
  comprobantes: (params) => api.get('/sunat/comprobantes', { params }),
};

export const adminApi = {
  descuentos: (params) => api.get('/admin/descuentos', { params }),
  marcarLeido: (id) => api.put(`/admin/descuentos/${id}/leida`),
  stockCritico: () => api.get('/admin/stock-critico'),
  exportarStock: (tipo) => api.get('/admin/stock-critico/export', { params: { tipo }, responseType: 'blob', timeout: 120000 }),
  diagnosticoApis: () => api.get('/admin/diagnostico-apis', { timeout: 60000 }),
  getConfigApis: () => api.get('/admin/config-apis'),
  saveConfigApis: (data) => api.post('/admin/config-apis', data),
  resumen: (params) => api.get('/admin/resumen', { params }),
  getCostos: () => api.get('/admin/costos'),
  saveCostos: (items) => api.post('/admin/costos', { items }),
};

export const usuariosApi = {
  listar:     ()          => api.get('/usuarios'),
  crear:      (data)      => api.post('/usuarios', data),
  actualizar: (id, data)  => api.put(`/usuarios/${id}`, data),
};

export const citasApi = {
  listar: (params) => api.get('/citas', { params }),
  poll:   (params) => api.get('/citas/poll', { params }),
  actualizar: (id, data) => api.put(`/citas/${id}`, data),
  generarPdf: (id) => api.post(`/citas/${id}/pdf`),
};

export const patronApi = {
  personajes:           ()         => api.get('/patron/personajes'),
  actualizarPersonaje:  (id, data) => api.put(`/patron/personajes/${id}`, data),
  distritos:            ()         => api.get('/patron/distritos'),
  crearDistrito:        (data)     => api.post('/patron/distritos', data),
  actualizarDistrito:   (id, data) => api.put(`/patron/distritos/${id}`, data),
  eliminarDistrito:     (id)       => api.delete(`/patron/distritos/${id}`),
  agregados:            ()         => api.get('/patron/agregados'),
  crearAgregado:        (data)     => api.post('/patron/agregados', data),
  actualizarAgregado:   (id, data) => api.put(`/patron/agregados/${id}`, data),
  eliminarAgregado:     (id)       => api.delete(`/patron/agregados/${id}`),
};

export const vehiculosApi = {
  placa:     (placa) => api.get(`/vehiculos/placa/${encodeURIComponent(placa)}`),
  versiones: (data)  => api.post('/vehiculos/versiones', data),
};

export const clientesApi = {
  listar:  (params) => api.get('/clientes', { params }),
  buscar:  (doc)    => api.get('/clientes/buscar', { params: { doc } }),
  lookup:  (data)   => api.post('/clientes/lookup', data),
  obtener: (id)     => api.get(`/clientes/${id}`),
  crear:   (data)   => api.post('/clientes', data),
};

// Importaciones masivas: archivos grandes (miles de filas) tardan más → timeout amplio
const IMPORT_OPTS = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 };

export const importarApi = {
  template: () => api.get('/importar/template', { responseType: 'blob', timeout: 120000 }),
  exportarCatalogo: () => api.get('/importar/exportar', { responseType: 'blob', timeout: 120000 }),
  preview: (formData) => api.post('/importar/preview', formData, IMPORT_OPTS),
  ejecutar: (formData) => api.post('/importar/ejecutar', formData, IMPORT_OPTS),
  previewUpdate: (formData) => api.post('/importar/preview-update', formData, IMPORT_OPTS),
  aplicarUpdate: (formData) => api.post('/importar/aplicar-update', formData, IMPORT_OPTS),
  reporteUpdate: (formData) => api.post('/importar/reporte-update', formData, { ...IMPORT_OPTS, responseType: 'blob' }),
};
