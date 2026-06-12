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

export const productosApi = {
  listar: (params) => api.get('/productos', { params }),
  obtener: (id) => api.get(`/productos/${id}`),
  crear: (data) => api.post('/productos', data),
  actualizar: (id, data) => api.put(`/productos/${id}`, data),
  eliminar: (id) => api.delete(`/productos/${id}`),
  eliminarMasivo: (ids) => api.post('/productos/eliminar-masivo', { ids }),
  compatibles: (params) => api.get('/productos/compatibles', { params }),
  marcas: () => api.get('/productos/marcas'),
  tipos: () => api.get('/productos/tipos'),
  enriquecer: (id) => api.post(`/productos/${id}/enriquecer-ia`),
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
  resumen: (params) => api.get('/admin/resumen', { params }),
};

export const citasApi = {
  listar: (params) => api.get('/citas', { params }),
  poll:   ()       => api.get('/citas/poll'),
  actualizar: (id, data) => api.put(`/citas/${id}`, data),
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

export const importarApi = {
  template: () => api.get('/importar/template', { responseType: 'blob' }),
  exportarCatalogo: () => api.get('/importar/exportar', { responseType: 'blob' }),
  preview: (formData) => api.post('/importar/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  ejecutar: (formData) => api.post('/importar/ejecutar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  previewUpdate: (formData) => api.post('/importar/preview-update', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  aplicarUpdate: (formData) => api.post('/importar/aplicar-update', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
