import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientesApi, productosApi, sedesApi, vehiculosApi, cotizacionesApi } from '../services/api';
import { useIsMobileOrTablet } from '../hooks/useIsMobile';
import ProductoModal from '../components/ProductoModal';
import ComparadorModal from '../components/ComparadorModal';

const S = {
  card: { background: 'var(--color-surface)', borderRadius: 10, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 16, textTransform: 'uppercase' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-surface)', color: 'var(--color-text)' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 },
  group: { marginBottom: 12 },
  tab: (active) => ({ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, background: active ? 'var(--color-primary)' : 'var(--color-surface)', color: active ? '#f5c400' : 'var(--color-text-muted)' }),
  btn: (c) => ({ padding: '9px 16px', background: c, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }),
};

const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;

function StockCell({ value }) {
  const c = value > 10 ? '#16a34a' : value > 3 ? '#ca8a04' : value > 0 ? '#f97316' : '#dc2626';
  return <span style={{ fontWeight: 700, color: c }}>{value}</span>;
}

export default function CotizacionNueva() {
  const navigate = useNavigate();
  const isMobile = useIsMobileOrTablet();

  // ── Cliente ──
  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [numDoc, setNumDoc] = useState('');
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', dniCe: '' });

  // ── Vehículo / medida ──
  const [modoMedida, setModoMedida] = useState('directa'); // directa | placa | vehiculo
  const [placa, setPlaca] = useState('');
  const [veh, setVeh] = useState({ marca: '', modelo: '', anio: '' });
  const [versiones, setVersiones] = useState([]);
  const [medida, setMedida] = useState('');

  // ── Catálogo / llanta elegida ──
  const [buscarQuery, setBuscarQuery] = useState('');
  const [buscarActivo, setBuscarActivo] = useState(false);
  const [llanta, setLlanta] = useState(null); // producto elegido
  const [cantidad, setCantidad] = useState(4);
  const [descuento, setDescuento] = useState('');
  const [notas, setNotas] = useState('');
  const [modalProdId, setModalProdId] = useState(null);
  const [comparar, setComparar] = useState([]);

  // ── Cita ──
  const [generarCita, setGenerarCita] = useState(false);
  const [sedeCita, setSedeCita] = useState('');
  const [fechaCita, setFechaCita] = useState('');
  const [horaCita, setHoraCita] = useState('');

  const { data: sedes = [] } = useQuery({ queryKey: ['sedes'], queryFn: sedesApi.listar, staleTime: Infinity });

  const { data: productos } = useQuery({
    queryKey: ['cot-catalogo', buscarQuery],
    queryFn: () => productosApi.listar({ q: buscarQuery, limit: 50, ...(medida && !buscarQuery ? { medida } : {}) }),
    enabled: buscarActivo,
  });

  // ── Lookup documento ──
  const lookupMut = useMutation({
    mutationFn: () => clientesApi.lookup({ tipoDoc, numDoc }),
    onSuccess: (r) => {
      if (!r.encontrado) { toast.error(r.mensaje || 'No encontrado'); return; }
      const d = r.datos || {};
      const nombre = tipoDoc === 'RUC' ? (d.razonSocial || '') : `${d.nombre || ''} ${d.apellidos || ''}`.trim();
      setCliente(c => ({ ...c, nombre: nombre || c.nombre, dniCe: numDoc }));
      toast.success('Datos autorrellenados');
    },
    onError: (e) => toast.error(e?.error || 'Error en la consulta'),
  });

  // ── Lookup placa ──
  const placaMut = useMutation({
    mutationFn: () => vehiculosApi.placa(placa),
    onSuccess: (r) => {
      if (!r.encontrado) { toast.error(r.mensaje || 'Placa no encontrada'); return; }
      setVeh({ marca: r.marca || '', modelo: r.modelo || '', anio: r.anio || '' });
      toast.success(`${r.marca || ''} ${r.modelo || ''} ${r.anio || ''}`.trim());
      if (r.marca && r.modelo) versionesMut.mutate({ marca: r.marca, modelo: r.modelo, anio: r.anio });
    },
    onError: (e) => toast.error(e?.error || 'Error al consultar placa'),
  });

  // ── Versiones del vehículo ──
  const versionesMut = useMutation({
    mutationFn: (v) => vehiculosApi.versiones(v || veh),
    onSuccess: (r) => {
      if (!r.encontrado || !r.versiones?.length) { toast.error(r.mensaje || 'Sin versiones'); setVersiones([]); return; }
      setVersiones(r.versiones);
      toast.success(`${r.versiones.length} versiones encontradas`);
    },
    onError: (e) => toast.error(e?.error || 'Error al buscar versiones'),
  });

  // ── Crear cotización ──
  const crearMut = useMutation({
    mutationFn: () => {
      const sede = sedes.find(s => s.id === sedeCita);
      const local = sede ? { ID: sede.codigoLocal, Nombre: sede.nombre, Direccion: sede.direccion || '', Distrito: sede.distrito || '' } : undefined;
      return cotizacionesApi.crear({
        nombreCliente: cliente.nombre, telefonoCliente: cliente.telefono, dniCe: cliente.dniCe,
        marcaAuto: veh.marca, modeloAuto: veh.modelo, anioAuto: veh.anio,
        medidaLlanta: medida || llanta?.medida,
        marcaLlanta: llanta?.marca, modeloLlanta: llanta?.nombreComercial,
        cantidad, precioUnit: llanta ? parseFloat(llanta.precioRegular) : 0,
        descuento: descuento || undefined, notas: notas || undefined,
        generarCita,
        ...(generarCita ? { fechaInstalacion: fechaCita || undefined, horaInstalacion: horaCita || undefined, localInstalacion: local } : {}),
      });
    },
    onSuccess: (data) => { toast.success(`Cotización ${data.numero} creada`); navigate(`/cotizaciones/${data.id}`); },
    onError: (e) => toast.error(e?.error || 'Error al crear cotización'),
  });

  const stockDeSede = (prod, sedeId) => prod?.stocks?.find(s => s.sedeId === sedeId || s.sede?.id === sedeId)?.cantidad ?? 0;
  const precioUnit = llanta ? parseFloat(llanta.precioRegular) : 0;
  const totalCalc = Math.max(0, precioUnit * cantidad - parseFloat(descuento || 0));
  const puedeGuardar = cliente.nombre && llanta && (!generarCita || (fechaCita && sedeCita));

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Nueva Cotización</h1>
      </div>

      <div style={isMobile ? {} : { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
        <div>
          {/* 1. Cliente */}
          <div style={S.card}>
            <div style={S.cardTitle}>1. Cliente</div>
            <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr auto', gap: 8, marginBottom: 12 }}>
              <select style={S.input} value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                <option value="DNI">DNI (nombres)</option>
                <option value="RUC">RUC (razón social)</option>
                <option value="CE">Carnet Ext.</option>
              </select>
              <input style={S.input} value={numDoc} onChange={e => setNumDoc(e.target.value.replace(/\D/g, ''))} placeholder="Número de documento" onKeyDown={e => { if (e.key === 'Enter' && numDoc) lookupMut.mutate(); }} />
              <button onClick={() => lookupMut.mutate()} disabled={!numDoc || lookupMut.isPending} style={S.btn('var(--color-primary)')}>
                {lookupMut.isPending ? '...' : '🔍 Autorrellenar'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div style={S.group}><label style={S.label}>Nombre / Razón social</label><input style={S.input} value={cliente.nombre} onChange={e => setCliente(c => ({ ...c, nombre: e.target.value }))} placeholder="Cliente" /></div>
              <div style={S.group}><label style={S.label}>Teléfono</label><input style={S.input} value={cliente.telefono} onChange={e => setCliente(c => ({ ...c, telefono: e.target.value }))} placeholder="51..." /></div>
            </div>
          </div>

          {/* 2. Medida del cliente */}
          <div style={S.card}>
            <div style={S.cardTitle}>2. Medida de la llanta</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={S.tab(modoMedida === 'directa')} onClick={() => setModoMedida('directa')}>📏 Medida directa</div>
              <div style={S.tab(modoMedida === 'placa')} onClick={() => setModoMedida('placa')}>🔢 Por placa</div>
              <div style={S.tab(modoMedida === 'vehiculo')} onClick={() => setModoMedida('vehiculo')}>🚗 Marca/Modelo/Año</div>
            </div>

            {modoMedida === 'directa' && (
              <div style={S.group}><label style={S.label}>Medida</label>
                <input style={S.input} value={medida} onChange={e => setMedida(e.target.value)} placeholder="195/65R15" />
              </div>
            )}

            {modoMedida === 'placa' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input style={{ ...S.input, textTransform: 'uppercase' }} value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="ABC123" onKeyDown={e => { if (e.key === 'Enter' && placa) placaMut.mutate(); }} />
                <button onClick={() => placaMut.mutate()} disabled={!placa || placaMut.isPending} style={S.btn('var(--color-primary)')}>{placaMut.isPending ? '...' : '🔍 Buscar'}</button>
              </div>
            )}

            {modoMedida === 'vehiculo' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px auto', gap: 8, marginBottom: 12 }}>
                <input style={S.input} value={veh.marca} onChange={e => setVeh(v => ({ ...v, marca: e.target.value }))} placeholder="Marca" />
                <input style={S.input} value={veh.modelo} onChange={e => setVeh(v => ({ ...v, modelo: e.target.value }))} placeholder="Modelo" />
                <input style={S.input} value={veh.anio} onChange={e => setVeh(v => ({ ...v, anio: e.target.value }))} placeholder="Año" />
                <button onClick={() => versionesMut.mutate()} disabled={!veh.marca || !veh.modelo || versionesMut.isPending} style={S.btn('var(--color-primary)')}>{versionesMut.isPending ? '...' : 'Versiones'}</button>
              </div>
            )}

            {/* Selector de versiones */}
            {(modoMedida === 'placa' || modoMedida === 'vehiculo') && versiones.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Elige la versión correcta del vehículo:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {versiones.map((v, i) => (
                    <div key={i} onClick={() => setMedida(v.medida)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${medida === v.medida ? 'var(--color-primary)' : 'var(--color-border)'}`, background: medida === v.medida ? '#fffbeb' : 'var(--color-bg)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{v.version}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary)' }}>{v.medida} {medida === v.medida ? '✓' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {medida && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>Medida: <strong>{medida}</strong></span>
                <button onClick={() => { setBuscarActivo(true); setBuscarQuery(''); }} style={S.btn('#16a34a')}>🔍 Buscar en catálogo</button>
              </div>
            )}
          </div>

          {/* 3. Catálogo / llanta */}
          {buscarActivo && (
            <div style={S.card}>
              <div style={S.cardTitle}>3. Elegir llanta del catálogo</div>
              <input style={{ ...S.input, marginBottom: 12 }} value={buscarQuery} onChange={e => setBuscarQuery(e.target.value)} placeholder="Filtrar por medida, marca, SKU..." />
              {comparar.length === 1 && <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 8 }}>📌 1 llanta marcada — abre otra para comparar</div>}
              <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead><tr style={{ background: 'var(--color-bg)' }}>
                    {['', 'Medida', 'Marca', 'Modelo', 'Precio', 'Stock', ''].map((h, i) => <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {(productos?.data || []).map(p => {
                      const elegida = llanta?.id === p.id;
                      const stockTotal = p.stocks?.reduce((a, s) => a + s.cantidad, 0) ?? 0;
                      return (
                        <tr key={p.id} style={{ background: elegida ? '#fffbeb' : undefined, borderBottom: '1px solid var(--color-border)', outline: elegida ? '2px solid #f5c400' : 'none', outlineOffset: '-1px' }}>
                          <td style={{ padding: '6px 10px' }}><input type="radio" checked={elegida} onChange={() => setLlanta(p)} style={{ accentColor: '#f5c400', cursor: 'pointer' }} /></td>
                          <td style={{ padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }} onClick={() => setModalProdId(p.id)}>{p.medida}</td>
                          <td style={{ padding: '6px 10px' }}>{p.marca}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)' }}>{p.nombreComercial || '—'}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700 }}>{fmt(p.precioRegular)}</td>
                          <td style={{ padding: '6px 10px' }}><StockCell value={stockTotal} /></td>
                          <td style={{ padding: '6px 10px' }}><button onClick={() => setModalProdId(p.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer' }}>Ver</button></td>
                        </tr>
                      );
                    })}
                    {productos?.data?.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin resultados</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Cantidad / descuento / notas */}
          {llanta && (
            <div style={S.card}>
              <div style={S.cardTitle}>4. Detalle</div>
              <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                <strong>{llanta.marca} {llanta.nombreComercial || ''}</strong> · {llanta.medida} · {fmt(llanta.precioRegular)} c/u
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={S.group}><label style={S.label}>Cantidad</label><input style={S.input} type="number" min={1} value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 1)} /></div>
                <div style={S.group}><label style={S.label}>Descuento S/</label><input style={S.input} type="number" min={0} value={descuento} onChange={e => setDescuento(e.target.value)} placeholder="0" /></div>
              </div>
              <div style={S.group}><label style={S.label}>Notas</label><textarea style={{ ...S.input, height: 50, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Incluye instalación, garantía..." /></div>
            </div>
          )}

          {/* 5. Generar cita */}
          <div style={S.card}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: generarCita ? 16 : 0 }}>
              <input type="checkbox" checked={generarCita} onChange={e => setGenerarCita(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#16a34a' }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>🗓️ Generar cita de instalación ahora</span>
            </label>
            {generarCita && (
              <>
                <div style={S.group}>
                  <label style={S.label}>Tienda de instalación (con stock)</label>
                  <select style={S.input} value={sedeCita} onChange={e => setSedeCita(e.target.value)}>
                    <option value="">— Elegir tienda —</option>
                    {sedes.map(s => {
                      const stk = llanta ? stockDeSede(llanta, s.id) : null;
                      return <option key={s.id} value={s.id}>{s.nombre}{stk !== null ? ` — stock: ${stk}` : ''}</option>;
                    })}
                  </select>
                  {llanta && sedeCita && (
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: stockDeSede(llanta, sedeCita) >= cantidad ? '#16a34a' : '#dc2626' }}>
                      {stockDeSede(llanta, sedeCita) >= cantidad ? `✅ Stock suficiente (${stockDeSede(llanta, sedeCita)} u.)` : `⚠️ Stock insuficiente (${stockDeSede(llanta, sedeCita)} u. de ${cantidad} requeridas)`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                  <div style={S.group}><label style={S.label}>Fecha</label><input style={S.input} type="date" value={fechaCita} onChange={e => setFechaCita(e.target.value)} /></div>
                  <div style={S.group}><label style={S.label}>Hora</label><input style={S.input} type="time" value={horaCita} onChange={e => setHoraCita(e.target.value)} /></div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Panel resumen */}
        <div style={isMobile ? {} : { position: 'sticky', top: 80 }}>
          <div style={S.card}>
            <div style={S.cardTitle}>Resumen</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>{cliente.nombre || <span style={{ color: 'var(--color-text-muted)' }}>Sin cliente</span>}</div>
            {medida && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Medida: {medida}</div>}
            {llanta && <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>{cantidad}× {llanta.marca} {llanta.medida}</span><span>{fmt(precioUnit * cantidad)}</span></div>}
            {parseFloat(descuento || 0) > 0 && <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Descuento</span><span>- {fmt(descuento)}</span></div>}
            {generarCita && fechaCita && <div style={{ fontSize: 12, color: '#b45309', fontWeight: 600, marginTop: 6 }}>🗓️ Cita: {fechaCita}{horaCita ? ` ${horaCita}` : ''}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--color-border)', fontWeight: 800, fontSize: 16 }}>
              <span>TOTAL</span><span style={{ color: 'var(--color-primary)' }}>{fmt(totalCalc)}</span>
            </div>
            <button onClick={() => crearMut.mutate()} disabled={!puedeGuardar || crearMut.isPending}
              style={{ width: '100%', marginTop: 16, padding: 12, background: puedeGuardar ? '#16a34a' : 'var(--color-surface2)', color: puedeGuardar ? '#fff' : 'var(--color-text-muted)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: puedeGuardar ? 'pointer' : 'default' }}>
              {crearMut.isPending ? 'Guardando...' : generarCita ? '✓ Crear cotización + cita' : '✓ Crear cotización'}
            </button>
            {!puedeGuardar && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>Falta: {!cliente.nombre ? 'cliente, ' : ''}{!llanta ? 'llanta, ' : ''}{generarCita && !fechaCita ? 'fecha, ' : ''}{generarCita && !sedeCita ? 'tienda' : ''}</div>}
          </div>
        </div>
      </div>

      {modalProdId && (
        <ProductoModal prodId={modalProdId} onClose={() => setModalProdId(null)} comparar={comparar}
          setComparar={(fn) => { const next = typeof fn === 'function' ? fn(comparar) : fn; setComparar(next); if (next.length === 2) setModalProdId(null); }} />
      )}
      {comparar.length === 2 && !modalProdId && <ComparadorModal ids={comparar} onClose={() => setComparar([])} />}
    </div>
  );
}
