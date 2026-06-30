import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { importarApi } from '../../services/api';

const S = {
  card: { background: 'var(--color-surface)', borderRadius: 10, padding: 24, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 },
  cardSub: { fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 },
  dropzone: (active) => ({
    border: `2px dashed ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
    background: active ? '#eff6ff' : 'var(--color-bg)', transition: 'all .2s',
  }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', verticalAlign: 'middle' },
  select: { padding: '5px 10px', border: '1.5px solid var(--color-border)', borderRadius: 6, fontSize: 12.5, background: 'var(--color-surface)', color: 'var(--color-text)', minWidth: 190 },
  selectMatch: { padding: '5px 10px', border: '2px solid var(--color-primary)', borderRadius: 6, fontSize: 12.5, background: 'var(--color-surface)', color: 'var(--color-text)', minWidth: 190 },
  btn: (c, outline) => ({
    padding: '9px 22px', background: outline ? 'transparent' : c,
    color: outline ? c : '#fff', border: `2px solid ${c}`,
    borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
  }),
  step: (active, done) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 12.5, fontWeight: done ? 600 : active ? 700 : 500,
    color: done ? '#16a34a' : active ? 'var(--color-primary)' : 'var(--color-text-muted)',
  }),
  stepNum: (active, done) => ({
    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
    background: done ? '#dcfce7' : active ? 'var(--color-primary)' : 'var(--color-border)',
    color: done ? '#16a34a' : active ? '#fff' : 'var(--color-text-muted)',
  }),
  badge: (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '20', color: c }),
  diffArrow: { color: 'var(--color-text-muted)', margin: '0 6px' },
  diffNew: { fontWeight: 700, color: '#16a34a' },
};

const GRUPOS_COLOR = { 'Precios': '#f59e0b', 'Info producto': '#3b82f6', 'Stock por local': '#8b5cf6' };

export default function ActualizarStock() {
  const [archivo, setArchivo] = useState(null);
  const [info, setInfo] = useState(null);           // resultado de previewUpdate
  const [matchCol, setMatchCol] = useState(null);   // { colIdx, campoCRM }
  const [updateMapeo, setUpdateMapeo] = useState({}); // { colIdx: campoCRM }
  const [previewRes, setPreviewRes] = useState(null); // dry-run result
  const [resultado, setResultado] = useState(null);   // apply result
  const [descargando, setDescargando] = useState(false);
  const paso = resultado ? 4 : previewRes ? 3 : info ? (matchCol !== null ? 2 : 1) : 0;

  // ── Step 1: subir archivo ─────────────────────────────────────────────────
  const parseMut = useMutation({
    mutationFn: (file) => { const fd = new FormData(); fd.append('archivo', file); return importarApi.previewUpdate(fd); },
    onSuccess: (data) => {
      setInfo(data);
      setMatchCol(null);
      setUpdateMapeo({});
      setPreviewRes(null);
      setResultado(null);
      // Auto-sugerir match
      const matchIdx = data.columnas.findIndex(c => c.sugerencias?.matchSugerido);
      if (matchIdx >= 0) setMatchCol({ colIdx: matchIdx, campoCRM: data.columnas[matchIdx].sugerencias.matchSugerido });
      // Auto-sugerir updates
      const autoUpdate = {};
      data.columnas.forEach((c, i) => { if (c.sugerencias?.updateSugerido) autoUpdate[i] = c.sugerencias.updateSugerido; });
      setUpdateMapeo(autoUpdate);
    },
    onError: (e) => toast.error(e?.error || 'Error al leer el archivo'),
  });

  const onDrop = useCallback((files) => {
    const f = files[0]; if (!f) return;
    setArchivo(f); parseMut.mutate(f);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 1,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'text/csv': ['.csv'] },
  });

  // ── Step 3: dry-run preview ────────────────────────────────────────────────
  const previewMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('matchColIdx', matchCol.colIdx);
      fd.append('matchCampoCRM', matchCol.campoCRM);
      fd.append('updateMapeo', JSON.stringify(updateMapeo));
      fd.append('soloPreview', 'true');
      return importarApi.aplicarUpdate(fd);
    },
    onSuccess: setPreviewRes,
    onError: (e) => toast.error(e?.error || 'Error en preview'),
  });

  // ── Step 4: apply ─────────────────────────────────────────────────────────
  const applyMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('matchColIdx', matchCol.colIdx);
      fd.append('matchCampoCRM', matchCol.campoCRM);
      fd.append('updateMapeo', JSON.stringify(updateMapeo));
      fd.append('soloPreview', 'false');
      return importarApi.aplicarUpdate(fd);
    },
    onSuccess: (data) => { setResultado(data); toast.success(`${data.actualizados} productos actualizados`); },
    onError: (e) => toast.error(e?.error || 'Error al aplicar'),
  });

  const reset = () => { setArchivo(null); setInfo(null); setMatchCol(null); setUpdateMapeo({}); setPreviewRes(null); setResultado(null); setDescargando(false); };

  const descargarReporteDirecto = async () => {
    if (!archivo || !matchCol) return;

    // Si el backend ya devolvió el reporte en base64 (dentro de previewRes o resultado), usarlo directamente
    const b64 = resultado?.reporteBase64 || previewRes?.reporteBase64;
    if (b64) {
      descargarReporte(b64, !resultado);
      return;
    }

    // Fallback: pedir el reporte al endpoint dedicado (re-procesa el archivo)
    setDescargando(true);
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('matchColIdx', matchCol.colIdx);
      fd.append('matchCampoCRM', matchCol.campoCRM);
      fd.append('updateMapeo', JSON.stringify(updateMapeo));
      const blob = await importarApi.reporteUpdate(fd);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_actualizacion_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      let msg = 'No se pudo generar el reporte Excel';
      try {
        const text = err instanceof Blob ? await err.text() : (err?.error || err?.message || '');
        const parsed = typeof text === 'string' ? JSON.parse(text) : text;
        msg = parsed?.error || parsed?.message || msg;
      } catch {}
      toast.error(msg, { duration: 12000 });
    } finally {
      setDescargando(false);
    }
  };

  // Descarga el reporte Excel (base64) que devuelve el backend con filas sombreadas
  const descargarReporte = (base64, esPreview) => {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_actualizacion_${esPreview ? 'preview_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Bloque reutilizable: lista de valores de match que no existen en el CRM
  const ListaNoEncontrados = ({ lista }) => {
    if (!lista || lista.length === 0) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f97316', marginBottom: 6 }}>
          ⚠️ No encontrados en el CRM ({lista.length}) — verifica estos valores:
        </div>
        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
          {lista.map((it, i) => (
            <span key={i} style={{ padding: '3px 10px', background: '#fff', borderRadius: 12, border: '1px solid #fdba74', fontSize: 11.5, fontFamily: 'monospace' }}>
              Fila {it.fila}: <strong>{it.valor}</strong>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const updateMapeoActivo = Object.entries(updateMapeo).filter(([, v]) => v && v !== '_skip');
  const canPreview = matchCol && updateMapeoActivo.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Indicador de pasos */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        {['Subir archivo', 'Elegir columna de match', 'Elegir columnas a actualizar', 'Confirmar'].map((label, i) => (
          <div key={i} style={S.step(paso === i, paso > i)}>
            <div style={S.stepNum(paso === i, paso > i)}>{paso > i ? '✓' : i + 1}</div>
            {label}
          </div>
        ))}
      </div>

      {/* Paso 0: subir archivo */}
      <div style={S.card}>
        <div style={S.cardTitle}>1. Sube tu archivo Excel o CSV</div>
        <div style={S.cardSub}>El archivo debe tener una columna identificadora (SKU o Medida) y las columnas que quieres actualizar.</div>
        <div {...getRootProps()} style={S.dropzone(isDragActive)}>
          <input {...getInputProps()} />
          <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
          {isDragActive ? <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Suelta aquí</div> : (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Arrastra tu archivo o haz clic para seleccionar</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Excel (.xlsx) o CSV • Máx. 20MB</div>
            </>
          )}
        </div>
        {parseMut.isPending && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>⏳ Analizando archivo...</div>}
        {archivo && info && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13 }}>
            ✅ <strong>{archivo.name}</strong> — {info.totalFilas} filas · {info.columnas.length} columnas detectadas
          </div>
        )}
      </div>

      {info && !resultado && (
        <>
          {/* Paso 1: columna de match */}
          <div style={S.card}>
            <div style={S.cardTitle}>2. ¿Con qué columna buscar el producto en el CRM?</div>
            <div style={S.cardSub}>Elige la columna del archivo que contiene el identificador (SKU o Medida) para encontrar cada producto.</div>

            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Columna del archivo</th>
                    <th style={S.th}>Campo CRM para match</th>
                    {info.preview.slice(0, 5).map((_, i) => <th key={i} style={{ ...S.th, background: 'transparent' }}>Ej. {i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {info.columnas.map((col, colIdx) => {
                    const isMatch = matchCol?.colIdx === colIdx;
                    return (
                      <tr key={colIdx} style={{ background: isMatch ? '#eff6ff' : undefined }}>
                        <td style={{ ...S.td, fontWeight: isMatch ? 700 : 500, color: isMatch ? 'var(--color-primary)' : undefined }}>
                          {isMatch && <span style={{ marginRight: 6 }}>🎯</span>}{col.nombre}
                        </td>
                        <td style={S.td}>
                          <select
                            style={isMatch ? S.selectMatch : S.select}
                            value={isMatch ? matchCol.campoCRM : '_ninguno'}
                            onChange={e => {
                              if (e.target.value === '_ninguno') {
                                if (isMatch) setMatchCol(null);
                              } else {
                                setMatchCol({ colIdx, campoCRM: e.target.value });
                              }
                            }}
                          >
                            <option value="_ninguno">— No usar para match —</option>
                            {info.camposMatch.map(c => (
                              <option key={c.key} value={c.key}>{c.label} ({c.descripcion})</option>
                            ))}
                          </select>
                        </td>
                        {info.preview.slice(0, 5).map((row, ri) => (
                          <td key={ri} style={{ ...S.td, color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 11.5 }}>
                            {String(row[colIdx] ?? '').slice(0, 20)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {matchCol && (
              <div style={{ marginTop: 12, padding: '8px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 12.5 }}>
                🎯 Match por: <strong>{info.columnas[matchCol.colIdx]?.nombre}</strong> → campo CRM <strong>{matchCol.campoCRM}</strong>
              </div>
            )}
          </div>

          {/* Paso 2: columnas a actualizar */}
          {matchCol && (
            <div style={S.card}>
              <div style={S.cardTitle}>3. ¿Qué columnas actualizar en el CRM?</div>
              <div style={S.cardSub}>Selecciona el campo del CRM que cada columna del archivo va a actualizar. Deja "No actualizar" para ignorar esa columna.</div>

              {/* Grupos de campos disponibles */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {Object.entries(GRUPOS_COLOR).map(([grupo, color]) => (
                  <span key={grupo} style={S.badge(color)}>{grupo}</span>
                ))}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Columna del archivo</th>
                      <th style={S.th}>Actualiza campo CRM</th>
                      {info.preview.slice(0, 4).map((_, i) => <th key={i} style={{ ...S.th, background: 'transparent' }}>Ej. {i + 1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {info.columnas.map((col, colIdx) => {
                      if (colIdx === matchCol.colIdx) return null; // skip la columna de match
                      const campoSeleccionado = updateMapeo[colIdx] || '_skip';
                      const campoInfo = info.camposUpdate.find(c => c.key === campoSeleccionado);
                      const grupoColor = campoInfo ? GRUPOS_COLOR[campoInfo.grupo] : null;
                      return (
                        <tr key={colIdx} style={{ background: campoSeleccionado !== '_skip' ? '#f0fdf4' : undefined }}>
                          <td style={{ ...S.td, fontWeight: campoSeleccionado !== '_skip' ? 600 : 400 }}>
                            {campoSeleccionado !== '_skip' && <span style={{ marginRight: 4 }}>✏️</span>}{col.nombre}
                          </td>
                          <td style={S.td}>
                            <select
                              style={{ ...S.select, borderColor: grupoColor || 'var(--color-border)' }}
                              value={campoSeleccionado}
                              onChange={e => setUpdateMapeo(m => ({ ...m, [colIdx]: e.target.value }))}
                            >
                              <option value="_skip">— No actualizar —</option>
                              {/* Agrupar opciones */}
                              {Object.entries(GRUPOS_COLOR).map(([grupo]) => {
                                const opciones = info.camposUpdate.filter(c => c.grupo === grupo);
                                if (!opciones.length) return null;
                                return (
                                  <optgroup key={grupo} label={grupo}>
                                    {opciones.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                  </optgroup>
                                );
                              })}
                            </select>
                          </td>
                          {info.preview.slice(0, 4).map((row, ri) => (
                            <td key={ri} style={{ ...S.td, color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 11.5 }}>
                              {String(row[colIdx] ?? '').slice(0, 18)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumen del mapeo */}
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Resumen de actualización:</div>
                {updateMapeoActivo.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sin columnas seleccionadas todavía</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {updateMapeoActivo.map(([colIdx, campo]) => {
                      const campoInfo = info.camposUpdate.find(c => c.key === campo);
                      const color = campoInfo ? GRUPOS_COLOR[campoInfo.grupo] : '#64748b';
                      return (
                        <span key={colIdx} style={S.badge(color)}>
                          {info.columnas[parseInt(colIdx)]?.nombre || colIdx} → {campoInfo?.label || campo}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button style={S.btn('#f59e0b')} onClick={() => previewMut.mutate()} disabled={!canPreview || previewMut.isPending}>
                  {previewMut.isPending ? '⏳ Calculando...' : '🔍 Vista previa de cambios'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Paso 3: vista previa de cambios (dry-run) */}
      {previewRes && !resultado && (
        <div style={S.card}>
          <div style={S.cardTitle}>4. Vista previa — ¿Qué va a cambiar?</div>
          <div style={S.cardSub}>Revisa los cambios antes de aplicarlos. Esto es solo una previsualización, nada se ha guardado aún.</div>

          {/* Estadísticas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#2563eb' }}>{previewRes.actualizados}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb' }}>Productos a actualizar</div>
            </div>
            <div style={{ background: previewRes.noEncontrados > 0 ? '#fff7ed' : '#f8fafc', borderRadius: 8, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: previewRes.noEncontrados > 0 ? '#f97316' : '#64748b' }}>{previewRes.noEncontrados}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: previewRes.noEncontrados > 0 ? '#f97316' : '#64748b' }}>No encontrados en CRM</div>
            </div>
            <div style={{ background: previewRes.errores.length > 0 ? '#fef2f2' : '#f8fafc', borderRadius: 8, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: previewRes.errores.length > 0 ? '#dc2626' : '#64748b' }}>{previewRes.errores.length}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: previewRes.errores.length > 0 ? '#dc2626' : '#64748b' }}>Errores</div>
            </div>
          </div>

          {/* Muestra de cambios */}
          {previewRes.cambiosMuestra.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>
                Muestra de cambios (primeros {previewRes.cambiosMuestra.length} de {previewRes.actualizados}):
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Producto</th>
                      <th style={S.th}>Medida</th>
                      <th style={S.th}>Cambios en campos</th>
                      <th style={S.th}>Cambios en stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRes.cambiosMuestra.map((c, i) => (
                      <tr key={i}>
                        <td style={S.td}><strong>{c.sku}</strong><br /><span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.marca}</span></td>
                        <td style={S.td}>{c.medida}</td>
                        <td style={S.td}>
                          {Object.entries(c.cambiosProducto).length === 0 ? (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>Sin cambios</span>
                          ) : Object.entries(c.cambiosProducto).map(([k, v]) => (
                            <div key={k} style={{ fontSize: 11.5, marginBottom: 2 }}>
                              <span style={{ fontWeight: 600 }}>{k}:</span>
                              <span style={S.diffArrow}>→</span>
                              <span style={S.diffNew}>{String(v)}</span>
                            </div>
                          ))}
                        </td>
                        <td style={S.td}>
                          {c.cambiosStock.length === 0 ? (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>Sin cambios</span>
                          ) : c.cambiosStock.map((st, j) => (
                            <div key={j} style={{ fontSize: 11.5, marginBottom: 2 }}>
                              <span style={{ fontWeight: 600 }}>{st.codigoLocal}:</span>
                              <span style={{ marginLeft: 4, color: 'var(--color-text-muted)' }}>{st.antes}</span>
                              <span style={S.diffArrow}>→</span>
                              <span style={{ ...S.diffNew, color: st.despues > st.antes ? '#16a34a' : st.despues < st.antes ? '#dc2626' : '#64748b' }}>
                                {st.despues}
                              </span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRes.actualizados > previewRes.cambiosMuestra.length && (
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>
                  ...y {previewRes.actualizados - previewRes.cambiosMuestra.length} productos más
                </div>
              )}
            </div>
          )}

          <ListaNoEncontrados lista={previewRes.noEncontradosLista} />

          {previewRes.errores.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Filas con error:</div>
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {previewRes.errores.map((e, i) => (
                  <div key={i} style={{ padding: '5px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 4, fontSize: 11.5 }}>
                    <strong>Fila {e.fila} ({e.valor}):</strong> {e.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              style={S.btn('#16a34a')}
              onClick={() => applyMut.mutate()}
              disabled={applyMut.isPending || previewRes.actualizados === 0}
            >
              {applyMut.isPending ? '⏳ Actualizando...' : `✅ Aplicar ${previewRes.actualizados} actualizaciones`}
            </button>
            <button
              style={S.btn('#0891b2', true)}
              onClick={descargarReporteDirecto}
              disabled={descargando}
            >
              {descargando ? '⏳ Generando...' : '📥 Descargar Excel preview'}
            </button>
            <button style={S.btn('#64748b', true)} onClick={() => setPreviewRes(null)}>
              ← Volver a editar
            </button>
          </div>
        </div>
      )}

      {/* Paso 4: resultado final */}
      {resultado && (
        <div style={S.card}>
          <div style={S.cardTitle}>✅ Actualización completada</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#16a34a' }}>{resultado.actualizados}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>Actualizados</div>
            </div>
            <div style={{ background: resultado.noEncontrados > 0 ? '#fff7ed' : '#f8fafc', borderRadius: 8, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: resultado.noEncontrados > 0 ? '#f97316' : '#64748b' }}>{resultado.noEncontrados}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: resultado.noEncontrados > 0 ? '#f97316' : '#64748b' }}>No encontrados</div>
            </div>
            <div style={{ background: resultado.errores.length > 0 ? '#fef2f2' : '#f8fafc', borderRadius: 8, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: resultado.errores.length > 0 ? '#dc2626' : '#64748b' }}>{resultado.errores.length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: resultado.errores.length > 0 ? '#dc2626' : '#64748b' }}>Errores</div>
            </div>
          </div>

          <ListaNoEncontrados lista={resultado.noEncontradosLista} />

          {resultado.errores.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Errores:</div>
              {resultado.errores.map((e, i) => (
                <div key={i} style={{ padding: '5px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
                  <strong>Fila {e.fila} {e.valor ? `(${e.valor})` : ''}:</strong> {e.error}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              style={S.btn('#0891b2')}
              onClick={descargarReporteDirecto}
              disabled={descargando}
            >
              {descargando ? '⏳ Generando Excel...' : '📥 Descargar Excel con resultados'}
            </button>
            <button style={S.btn('#3b82f6')} onClick={reset}>
              Actualizar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
