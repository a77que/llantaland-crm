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

// camposBD se obtiene dinámicamente del backend (incluye stock por sede)

export default function ImportadorStock() {
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapeo, setMapeo] = useState({});
  const [resultado, setResultado] = useState(null);
  const [descargando, setDescargando] = useState(false);

  const descargarTemplate = async () => {
    setDescargando(true);
    try {
      const blob = await importarApi.template();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_productos_llantaland.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar la plantilla');
    } finally {
      setDescargando(false);
    }
  };

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
      toast.success(`Importación completada: ${data.creados} creados, ${data.actualizados} actualizados, ${data.sinCambios ?? 0} sin cambios`);
    },
    onError: (e) => toast.error(e?.error || 'Error al importar'),
  });

  // Descarga el informe Excel (base64) que devuelve el backend.
  const descargarInforme = () => {
    if (!resultado?.reporteBase64) return;
    const bin = atob(resultado.reporteBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_importacion_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      {/* Banner descarga plantilla */}
      <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1.5px solid #93c5fd', borderRadius: 12, padding: '16px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1d4ed8', marginBottom: 4 }}>
            📋 Plantilla de ejemplo
          </div>
          <div style={{ fontSize: 12.5, color: '#3b82f6', lineHeight: 1.5 }}>
            Descarga el formato correcto con <strong>llantas de muestra</strong> y una hoja de instrucciones.<br />
            Obligatorias: <strong>SKU · Medida · Marca</strong>. Para el stock usa la columna <strong>Stock Total</strong> (va al almacén principal) sin llenar cada tienda.
          </div>
        </div>
        <button
          onClick={descargarTemplate}
          disabled={descargando}
          style={{ padding: '9px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: descargando ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: descargando ? 0.7 : 1, transition: 'opacity .15s' }}
        >
          {descargando ? '⏳ Descargando...' : '⬇️ Descargar plantilla .xlsx'}
        </button>
      </div>

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
                  {preview.preview.slice(0, 3).map((_, rowIdx) => (
                    <th key={rowIdx} style={{ ...S.th, background: '#fff' }}>Fila {rowIdx + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const cols = preview.columnas.map((col, idx) => ({ ...col, idx }));
                  const recognized   = cols.filter(c => c.sugerencia && c.sugerencia !== '_skip' && !c.nombre.includes('[AUTO]'));
                  const autoCalc     = cols.filter(c => c.nombre.includes('[AUTO]'));
                  const unrecognized = cols.filter(c => (!c.sugerencia || c.sugerencia === '_skip') && !c.nombre.includes('[AUTO]'));
                  const previewRows  = preview.preview.slice(0, 3);

                  const renderRow = (col, opts = {}) => {
                    const colIdx = col.idx;
                    return (
                      <tr key={colIdx} style={opts.rowStyle}>
                        <td style={{ ...S.td, fontWeight: 600, color: opts.dimText ? '#94a3b8' : undefined }}>
                          {opts.icon && <span style={{ marginRight: 4 }}>{opts.icon}</span>}
                          {col.nombre}
                        </td>
                        <td style={S.td}>
                          {opts.locked
                            ? <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Auto-calculado desde Medida</span>
                            : <select
                                style={{ ...S.select, ...(opts.warn && { borderColor: '#f59e0b' }) }}
                                value={mapeo[colIdx] || '_skip'}
                                onChange={(e) => setMapeoCampo(colIdx, e.target.value)}
                              >
                                {(preview.camposBD || []).map((c) => (
                                  <option key={c.key} value={c.key}>{c.label}</option>
                                ))}
                              </select>
                          }
                        </td>
                        {previewRows.map((row, rowIdx) => (
                          <td key={rowIdx} style={{ ...S.td, color: opts.dimText ? '#94a3b8' : 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                            {String(row[colIdx] ?? '').slice(0, 30)}
                          </td>
                        ))}
                      </tr>
                    );
                  };

                  const divider = (key, bg, txtColor, borderColor, label) => (
                    <tr key={key}>
                      <td colSpan={99} style={{ background: bg, padding: '4px 12px', fontSize: 10, fontWeight: 700, color: txtColor, textTransform: 'uppercase', letterSpacing: 1, borderTop: `2px solid ${borderColor}` }}>
                        {label}
                      </td>
                    </tr>
                  );

                  return [
                    ...recognized.map(col => renderRow(col)),
                    ...(autoCalc.length > 0 ? [
                      divider('_div_auto', '#f1f5f9', '#64748b', '#e2e8f0', 'Auto-calculado desde Medida — no importar'),
                      ...autoCalc.map(col => renderRow(col, { locked: true, dimText: true, rowStyle: { background: '#f8fafc', opacity: 0.7 } })),
                    ] : []),
                    ...(unrecognized.length > 0 ? [
                      divider('_div_unk', '#fef3c7', '#92400e', '#fde68a', `⚠️ ${unrecognized.length} columna(s) no reconocidas — asígnalas manualmente`),
                      ...unrecognized.map(col => renderRow(col, { icon: '⚠️', warn: true, rowStyle: { background: '#fffbeb' } })),
                    ] : []),
                  ];
                })()}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <div style={S.cardTitle}>3. Resultado de la importación</div>
            {resultado.reporteBase64 && (
              <button onClick={descargarInforme} style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ⬇️ Descargar informe (.xlsx)
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a' }}>{resultado.creados}</div>
              <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>Creados nuevos</div>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#2563eb' }}>{resultado.actualizados}</div>
              <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 600 }}>Actualizados</div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#64748b' }}>{resultado.sinCambios ?? 0}</div>
              <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Sin cambios</div>
            </div>
            <div style={{ background: resultado.errores.length > 0 ? '#fef2f2' : '#f8fafc', borderRadius: 8, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: resultado.errores.length > 0 ? '#dc2626' : '#64748b' }}>{resultado.errores.length}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: resultado.errores.length > 0 ? '#dc2626' : '#64748b' }}>Errores</div>
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
