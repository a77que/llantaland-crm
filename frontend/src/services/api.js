import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
};

// Campos técnicos que la IA pudo haber dejado con basura ("null", "[object Object]"…).
const TECH_FIELDS = ['indice_carga', 'velocidad_max', 'garantia', 'cargaMaxNeumatico', 'velocidadMaxKmh', 'eficienciaCombustible', 'eficienciaFrenado', 'nivelRuido', 'paisFabricacion', 'origenMarca', 'fichaTecnica'];
const BASURA = new Set(['', 'null', 'undefined', 'nan', 'n/a', 'na', '-', '--', '.', '[object object]', 'none', 'no especificado', 'no disponible', 'sin información', 'sin informacion']);
// Limpia valores basura → null, para que la vista muestre "—" en vez del texto malo.
function limpiarProducto(p) {
  if (!p || typeof p !== 'object') return p;
  for (const f of TECH_FIELDS) {
    const v = p[f];
    if (typeof v === 'string' && BASURA.has(v.trim().toLowerCase())) p[f] = null;
    else if (v !== null && typeof v === 'object') p[f] = null;
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
};

export const usuariosApi = {
  listar:     ()          => api.get('/usuarios'),
  crear:      (data)      => api.post('/usuarios', data),
  actualizar: (id, data)  => api.put(`/usuarios/${id}`, data),
};

export const citasApi = {
  listar: (params) => api.get('/citas', { params }),
  poll:   ()       => api.get('/citas/poll'),
  actualizar: (id, data) => api.put(`/citas/${id}`, data),
  generarPdf: (id) => api.post(`/citas/${id}/pdf`),
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
};
