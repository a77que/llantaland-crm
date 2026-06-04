import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { importarApi } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';

const S = {
  dropzone: (isDragActive) => ({
    border: `2px dashed ${isDragActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 12,
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    background: isDragActive ? '#eff6ff' : '#f8fafc',
    transition: 'all .2s',
  }),
  card: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, overflow: 'auto', display: 'block' },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' },
  td: { padding: '7px 12px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' },
  select: { padding: '5px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, fontSize: 12, minWidth: 160 },
  btn: (c) => ({ padding: '10px 24px', background: c, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }),
};

const CAMPOS_BD = [
  { key: '_skip', label: '— No importar —' },
  { key: 'sku', label: 'SKU *' },
  { key: 'medida', label: 'Medida *' },
  { key: 'marca', label: 'Marca *' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'tipo', label: 'Tipo (AUTO/CAMIONETA...)' },
  { key: 'indice_carga', label: 'Índice de carga' },
  { key: 'velocidad_max', label: 'Velocidad máx.' },
  { key: 'ancho_mm', label: 'Ancho (mm)' },
  { key: 'aro', label: 'Aro' },
  { key: 'tipo_terreno', label: 'Tipo terreno' },
  { key: 'garantia', label: 'Garantía' },
  { key: 'precio', label: 'Precio *' },
  { key: '_stock_cantidad', label: 'Stock cantidad' },
  { key: '_stock_sede', label: 'Sede del stock' },
];

export default function ImportadorStock() {
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapeo, setMapeo] = useState({});
  const [resultado, setResultado] = useState(null);

  const previewMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return importarApi.preview(fd);
    },
    onSuccess: (data) => {
      setPreview(data);
      // Aplicar sugerencias automáticas
      const autoMapeo = {};
      data.columnas.forEach((col, idx) => {
        autoMapeo[idx] = col.sugerencia || '_skip';
      });
      setMapeo(autoMapeo);
    },
    onError: (e) => toast.error(e?.error || 'Error al previsualizar'),
  });

  const ejecutarMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('mapeo', JSON.stringify(mapeo));
      return importarApi.ejecutar(fd);
    },
    onSuccess: (data) => {
      setResultado(data);
      toast.success(`Importación completada: ${data.creados} creados, ${data.actualizados} actualizados`);
    },
    onError: (e) => toast.error(e?.error || 'Error al importar'),
  });

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setArchivo(file);
    setPreview(null);
    setResultado(null);
    previewMutation.mutate(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const setMapeoCampo = (colIdx, campo) => setMapeo((m) => ({ ...m, [colIdx]: campo }));

  return (
    <div>
      {/* Dropzone */}
      <div style={S.card}>
        <div style={S.cardTitle}>1. Subir archivo</div>
        <div {...getRootProps()} style={S.dropzone(isDragActive)}>
          <input {...getInputProps()} />
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          {isDragActive ? (
            <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Suelta el archivo aquí</div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Arrastra tu archivo Excel o CSV aquí</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>o haz clic para seleccionar</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>Soporta .xlsx y .csv • Máx. 20MB</div>
            </>
          )}
        </div>
        {archivo && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13 }}>
            ✅ <strong>{archivo.name}</strong> — {(archivo.size / 1024).toFixed(1)} KB
          </div>
        )}
        {previewMutation.isPending && <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><LoadingSpinner size={16} /> Analizando archivo...</div>}
      </div>

      {/* Mapeador de columnas */}
      {preview && !resultado && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={S.cardTitle}>2. Mapear columnas ({preview.columnas.length} detectadas, {preview.totalFilas} filas)</div>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Columna en archivo</th>
                  <th style={S.th}>Campo destino en CRM</th>
                  {preview.preview[0]?.map((_, i) => (
                    <th key={i} style={{ ...S.th, background: '#fff' }}>Fila {i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.columnas.map((col, colIdx) => (
                  <tr key={colIdx}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{col.nombre}</td>
                    <td style={S.td}>
                      <select style={S.select} value={mapeo[colIdx] || '_skip'} onChange={(e) => setMapeoCampo(colIdx, e.target.value)}>
                        {CAMPOS_BD.map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    {preview.preview.map((row, rowIdx) => (
                      <td key={rowIdx} style={{ ...S.td, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                        {String(row[colIdx] ?? '').slice(0, 30)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            style={S.btn('#16a34a')}
            onClick={() => ejecutarMutation.mutate()}
            disabled={ejecutarMutation.isPending}
          >
            {ejecutarMutation.isPending ? '⏳ Importando...' : `⬆️ Importar ${preview.totalFilas} filas`}
          </button>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div style={S.card}>
          <div style={S.cardTitle}>3. Resultado de la importación</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{resultado.creados}</div>
              <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Productos creados</div>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>{resultado.actualizados}</div>
              <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>Actualizados</div>
            </div>
            <div style={{ background: resultado.errores.length > 0 ? '#fef2f2' : '#f8fafc', borderRadius: 8, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: resultado.errores.length > 0 ? '#dc2626' : '#64748b' }}>{resultado.errores.length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: resultado.errores.length > 0 ? '#dc2626' : '#64748b' }}>Errores</div>
            </div>
          </div>

          {resultado.errores.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#dc2626' }}>Filas con error:</div>
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {resultado.errores.map((e, i) => (
                  <div key={i} style={{ padding: '6px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
                    <strong>Fila {e.fila}:</strong> {e.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button style={{ ...S.btn('#64748b'), marginTop: 16 }} onClick={() => { setArchivo(null); setPreview(null); setResultado(null); }}>
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  );
}
