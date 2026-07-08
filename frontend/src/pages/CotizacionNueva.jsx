import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  tab: (active) => ({ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, background: active ? 'var(--color-primary)' : 'var(--color-surface)', color: active ? '#000' : 'var(--color-text-muted)' }),
  btn: (c) => ({ padding: '9px 16px', background: c, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }),
};

const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;

const normalizarNombre = (s) => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

// La ganancia real de la tienda es solo el costo "Ganancia" configurado en
// Precios y Margen (hoy 10% del precio proveedor, pero puede cambiar ahí).
// IGV e Instalación son costos fijos que se cobran igual pero no son
// utilidad — se ignoran para este cálculo.
function calcGananciaCosto(precioProveedor, costos) {
  const base = Number(precioProveedor) || 0;
  const c = costos.find(c => normalizarNombre(c.nombre) === 'ganancia');
  if (!c) return 0;
  const val = Number(c.valor) || 0;
  let monto = c.tipo === 'porcentaje' ? base * val / 100 : val;
  // Piso en S/: si el % da menos que el mínimo configurado, se usa el mínimo.
  if (c.montoMinimo !== null && c.montoMinimo !== undefined && c.montoMinimo !== '') {
    const min = Number(c.montoMinimo) || 0;
    if (monto < min) monto = min;
  }
  return monto;
}

// Costo de traslado entre tiendas: se lee del concepto "Traslado" en Precios y
// Margen (tipo Monto S/). Si no está configurado, se usa 30 como valor por
// defecto para no dejar la función sin efecto.
function calcCostoTraslado(costos) {
  const c = costos.find(c => normalizarNombre(c.nombre) === 'traslado');
  if (!c) return 30;
  return Number(c.valor) || 0;
}

const PCT_TARJETA = 0.04;

function StockCell({ value }) {
  const c = value > 10 ? '#16a34a' : value > 3 ? '#ca8a04' : value > 0 ? '#f97316' : '#dc2626';
  return <span style={{ fontWeight: 700, color: c }}>{value}</span>;
}

export default function CotizacionNueva() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobileOrTablet();

  const pre = location.state || {}; // precarga desde lead/inventario

  // ── Cliente ──
  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [numDoc, setNumDoc] = useState(pre.cliente?.dniCe || '');
  const [cliente, setCliente] = useState({
    nombre: pre.cliente?.nombre || '', telefono: pre.cliente?.telefono || '', dniCe: pre.cliente?.dniCe || '',
  });
  const [leadId] = useState(pre.leadId || null);

  // ── Vehículo / medida ──
  const [modoMedida, setModoMedida] = useState('directa');
  const [placa, setPlaca] = useState('');
  const [veh, setVeh] = useState({ marca: pre.vehiculo?.marca || '', modelo: pre.vehiculo?.modelo || '', anio: pre.vehiculo?.anio || '' });
  const [versiones, setVersiones] = useState([]);
  const [medida, setMedida] = useState(pre.medida || '');

  // ── Catálogo / llantas elegidas (múltiples) ──
  // Si el lead ya eligió marca/modelo por WhatsApp, se precarga la búsqueda
  // y se activa de una vez para que el vendedor la vea sin un clic extra.
  const [buscarQuery, setBuscarQuery] = useState(pre.llanta?.marca || '');
  const [buscarActivo, setBuscarActivo] = useState(!!(pre.medida && pre.llanta?.marca));
  const [items, setItems] = useState([]); // [{ producto, cantidad }]
  const [descuento, setDescuento] = useState('');
  const [notas, setNotas] = useState('');
  const [modalProdId, setModalProdId] = useState(null);
  const [comparar, setComparar] = useState([]);
  const [verComparador, setVerComparador] = useState(false);

  // ── Costos adicionales de la venta (decisión del vendedor antes de confirmar) ──
  const [pagoTarjeta, setPagoTarjeta] = useState(false);
  const [tarjetaAsume, setTarjetaAsume] = useState('cliente'); // 'cliente' | 'tienda'
  const [trasladoTiendas, setTrasladoTiendas] = useState(false);
  const [trasladoAsume, setTrasladoAsume] = useState('cliente');

  // ── Cita ──
  const [generarCita, setGenerarCita] = useState(false);
  const [sedeCita, setSedeCita] = useState('');
  const [fechaCita, setFechaCita] = useState('');
  const [horaCita, setHoraCita] = useState('');

  const { data: sedes = [] } = useQuery({ queryKey: ['sedes'], queryFn: sedesApi.listar, staleTime: Infinity });

  // Precargar la tienda que el cliente eligió por WhatsApp (llega por código de
  // local; las sedes cargan async, así que se hace una vez que ya están).
  useEffect(() => {
    if (!pre.sede?.codigoLocal || sedeCita || sedes.length === 0) return;
    const match = sedes.find(s => s.codigoLocal === pre.sede.codigoLocal);
    if (match) setSedeCita(match.id);
  }, [sedes]); // eslint-disable-line

  // Costos globales (IGV, Instalación, Ganancia, etc.) — lectura, el vendedor no los edita aquí.
  const { data: costosVentaData } = useQuery({ queryKey: ['costos-venta-lectura'], queryFn: productosApi.costosVenta, staleTime: 60_000 });
  const costosVenta = useMemo(() => {
    const raw = costosVentaData?.items?.length ? costosVentaData.items : (costosVentaData?.sugeridos || []);
    return raw.filter(c => c.activo !== false);
  }, [costosVentaData]);

  // Ganancia estimada de una llanta agregada: solo el costo "Ganancia" de
  // Precios y Margen aplicado al precio proveedor, multiplicado por cantidad.
  const gananciaDeItem = (it) => {
    const prov = Number(it.producto.precioProveedor) || 0;
    return calcGananciaCosto(prov, costosVenta) * it.cantidad;
  };

  // Catálogo: por búsqueda libre, o por medida cuando se activa "Buscar en catálogo"
  const { data: productos } = useQuery({
    queryKey: ['cot-catalogo', buscarQuery, medida],
    queryFn: () => productosApi.listar({ q: buscarQuery || undefined, limit: 50, ...(medida && !buscarQuery ? { medida } : {}) }),
    enabled: buscarActivo,
  });

  // Catálogo ordenado: primero productos con stock, luego sin stock (mayor stock primero)
  const productosCatalogo = useMemo(() => {
    const list = productos?.data || [];
    return [...list].sort((a, b) => {
      const sa = a.stocks?.reduce((s, x) => s + x.cantidad, 0) ?? 0;
      const sb = b.stocks?.reduce((s, x) => s + x.cantidad, 0) ?? 0;
      if (sa > 0 && sb === 0) return -1;
      if (sa === 0 && sb > 0) return 1;
      return sb - sa;
    });
  }, [productos]);

  // Sugerencias ajax de medida mientras se tipea
  const { data: medidaSugeridas = [] } = useQuery({
    queryKey: ['medidas-sug', medida],
    queryFn: () => productosApi.medidas(medida),
    enabled: modoMedida === 'directa' && medida.length >= 2,
    staleTime: 60_000,
  });

  const addLlanta = (prod) => {
    setItems(prev => {
      const i = prev.findIndex(it => it.producto.id === prod.id);
      if (i >= 0) return prev.map((it, idx) => idx === i ? { ...it, cantidad: it.cantidad + 1 } : it);
      return [...prev, { producto: prod, cantidad: 4 }];
    });
    toast.success(`${prod.marca} ${prod.medida} agregada`);
  };

  // Precargar llanta si venimos del modal de inventario ("Cotizar esta llanta")
  useEffect(() => {
    const llantaId = location.state?.llantaId;
    if (!llantaId) return;
    productosApi.obtener(llantaId).then(prod => {
      if (prod) { addLlanta(prod); setMedida(prod.medida || ''); setBuscarActivo(true); }
    }).catch(() => {});
    navigate(location.pathname, { replace: true, state: {} }); // limpiar el state
  }, []); // eslint-disable-line

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

  const versionesMut = useMutation({
    mutationFn: (v) => vehiculosApi.versiones(v || veh),
    onSuccess: (r) => {
      if (!r.encontrado || !r.versiones?.length) { toast.error(r.mensaje || 'No se pudo obtener la medida'); setVersiones([]); return; }
      setVersiones(r.versiones);
      // Si no hay versiones específicas, el backend devuelve la medida de fábrica (genérico):
      // seleccionarla directa y avisar "no encontré versiones pero aquí está tu medida".
      if (r.generico || r.versiones.length === 1) {
        setMedida(r.versiones[0].medida);
        toast.success(r.generico
          ? `No encontré versiones, pero la medida de tu vehículo es ${r.versiones[0].medida} 🛞`
          : `Medida: ${r.versiones[0].medida}`);
      } else {
        toast.success(`${r.versiones.length} versiones encontradas`);
      }
    },
    onError: (e) => toast.error(e?.error || 'Error al buscar versiones'),
  });

  const stockDeSede = (prod, sedeId) => prod?.stocks?.find(s => s.sedeId === sedeId || s.sede?.id === sedeId)?.cantidad ?? 0;
  const subtotal = items.reduce((a, i) => a + parseFloat(i.producto.precioRegular) * i.cantidad, 0);
  const gananciaBase = items.reduce((a, it) => a + gananciaDeItem(it), 0);

  const montoTraslado = calcCostoTraslado(costosVenta);
  const montoTarjeta = subtotal * PCT_TARJETA;
  const costoTarjeta = pagoTarjeta ? montoTarjeta : 0;
  const costoTraslado = trasladoTiendas ? montoTraslado : 0;

  // Lo que se le suma al total que paga el cliente (solo la parte que decidió "asume cliente")
  const cargoCliente = (pagoTarjeta && tarjetaAsume === 'cliente' ? costoTarjeta : 0)
                      + (trasladoTiendas && trasladoAsume === 'cliente' ? costoTraslado : 0);
  // Lo que resta de la ganancia (la parte que decidió "asume tienda")
  const cargoTienda = (pagoTarjeta && tarjetaAsume === 'tienda' ? costoTarjeta : 0)
                     + (trasladoTiendas && trasladoAsume === 'tienda' ? costoTraslado : 0);

  const gananciaFinal = gananciaBase - cargoTienda;
  const totalCalc = Math.max(0, subtotal - parseFloat(descuento || 0) + cargoCliente);

  // Semáforo de ganancia: roja (sin ganancia), amarilla (la tienda está
  // absorbiendo parte del recargo y eso reduce la ganancia real, pero sigue
  // siendo positiva), verde (ganancia intacta, sin recargos a cargo de la tienda)
  const estadoGanancia = gananciaFinal <= 0 ? 'roja' : gananciaFinal < gananciaBase ? 'amarilla' : 'verde';
  const gananciaColor = { roja: '#dc2626', amarilla: '#d97706', verde: '#16a34a' }[estadoGanancia];
  const gananciaTexto = { roja: '🔴 Sin ganancia — no procede la venta así', amarilla: '🟡 Ganancia mínima', verde: '🟢 Ganancia saludable' }[estadoGanancia];

  const puedeGuardar = cliente.nombre && items.length > 0 && (!generarCita || (fechaCita && sedeCita));

  const crearMut = useMutation({
    mutationFn: () => {
      const sede = sedes.find(s => s.id === sedeCita);
      const local = sede ? { ID: sede.codigoLocal, Nombre: sede.nombre, Direccion: sede.direccion || '', Distrito: sede.distrito || '' } : undefined;
      const notasExtra = [
        pagoTarjeta ? `Pago con tarjeta: recargo 4% (${fmt(costoTarjeta)}) asumido por ${tarjetaAsume === 'cliente' ? 'el cliente' : 'la tienda'}.` : null,
        trasladoTiendas ? `Traslado entre tiendas: ${fmt(montoTraslado)} asumido por ${trasladoAsume === 'cliente' ? 'el cliente' : 'la tienda'}.` : null,
      ].filter(Boolean);
      const notasFinal = [notas, ...notasExtra].filter(Boolean).join('\n');
      return cotizacionesApi.crear({
        leadId: leadId || undefined,
        nombreCliente: cliente.nombre, telefonoCliente: cliente.telefono, dniCe: cliente.dniCe,
        marcaAuto: veh.marca, modeloAuto: veh.modelo, anioAuto: veh.anio,
        items: items.map(i => ({
          sku: i.producto.sku, medida: i.producto.medida, marca: i.producto.marca,
          modelo: i.producto.nombreComercial, cantidad: i.cantidad, precioUnit: parseFloat(i.producto.precioRegular),
        })),
        descuento: descuento || undefined,
        cargoAdicional: cargoCliente > 0 ? cargoCliente : undefined,
        notas: notasFinal || undefined,
        generarCita,
        ...(generarCita ? { fechaInstalacion: fechaCita || undefined, horaInstalacion: horaCita || undefined, localInstalacion: local } : {}),
      });
    },
    onSuccess: (data) => { toast.success(`Cotización ${data.numero} creada`); navigate(`/cotizaciones/${data.id}`); },
    onError: (e) => toast.error(e?.error || 'Error al crear cotización'),
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Nueva Cotización</h1>
      </div>

      {(pre.llanta?.marca || pre.sede) && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>💬 Elegido por WhatsApp:</span>
          {pre.llanta?.marca && <span style={{ fontSize: 13, color: 'var(--color-text)' }}>🛞 {pre.llanta.marca} {pre.llanta.modelo || ''}</span>}
          {pre.medida && <span style={{ fontSize: 13, color: 'var(--color-text)' }}>📏 {pre.medida}</span>}
          {pre.sede?.nombre && <span style={{ fontSize: 13, color: 'var(--color-text)' }}>🏪 {pre.sede.nombre}</span>}
        </div>
      )}

      <div style={isMobile ? {} : { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
        <div>
          {/* 1. Cliente */}
          <div style={S.card}>
            <div style={S.cardTitle}>1. Cliente</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '170px 1fr auto', gap: 8, marginBottom: 12 }}>
              <select style={S.input} value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                <option value="DNI">DNI (nombres)</option>
                <option value="RUC">RUC (razón social)</option>
                <option value="CE">Carnet Ext.</option>
              </select>
              <input style={S.input} value={numDoc} onChange={e => setNumDoc(tipoDoc === 'CE' ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') : e.target.value.replace(/\D/g, ''))} placeholder="N° documento" onKeyDown={e => { if (e.key === 'Enter' && numDoc) lookupMut.mutate(); }} />
              <button onClick={() => lookupMut.mutate()} disabled={!numDoc || lookupMut.isPending} style={{ ...S.btn('var(--color-primary)'), gridColumn: isMobile ? '1 / -1' : undefined }}>
                <span style={{ color: '#000' }}>{lookupMut.isPending ? '...' : '🔍 Autorrellenar'}</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div style={S.group}><label style={S.label}>Nombre / Razón social</label><input style={S.input} value={cliente.nombre} onChange={e => setCliente(c => ({ ...c, nombre: e.target.value }))} placeholder="Cliente" /></div>
              <div style={S.group}><label style={S.label}>Teléfono</label><input style={S.input} value={cliente.telefono} onChange={e => setCliente(c => ({ ...c, telefono: e.target.value }))} placeholder="51..." /></div>
            </div>
          </div>

          {/* 2. Medida */}
          <div style={S.card}>
            <div style={S.cardTitle}>2. Medida de la llanta</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={S.tab(modoMedida === 'directa')} onClick={() => setModoMedida('directa')}>📏 Medida directa</div>
              <div style={S.tab(modoMedida === 'placa')} onClick={() => setModoMedida('placa')}>🔢 Por placa</div>
              <div style={S.tab(modoMedida === 'vehiculo')} onClick={() => setModoMedida('vehiculo')}>🚗 Marca/Modelo/Año</div>
            </div>

            {modoMedida === 'directa' && (
              <div style={S.group}><label style={S.label}>Medida</label>
                <input style={S.input} list="medidas-dl" value={medida} onChange={e => setMedida(e.target.value)} placeholder="Escribe: 195/65R15..." />
                <datalist id="medidas-dl">{medidaSugeridas.map(m => <option key={m} value={m} />)}</datalist>
              </div>
            )}

            {modoMedida === 'placa' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input style={{ ...S.input, textTransform: 'uppercase' }} value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="ABC123" onKeyDown={e => { if (e.key === 'Enter' && placa) placaMut.mutate(); }} />
                <button onClick={() => placaMut.mutate()} disabled={!placa || placaMut.isPending} style={S.btn('var(--color-primary)')}><span style={{ color: '#000' }}>{placaMut.isPending ? '...' : '🔍 Buscar'}</span></button>
              </div>
            )}

            {modoMedida === 'vehiculo' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 80px' : '1fr 1fr 90px auto', gap: 8, marginBottom: 12 }}>
                <input style={S.input} value={veh.marca} onChange={e => setVeh(v => ({ ...v, marca: e.target.value }))} placeholder="Marca" />
                <input style={S.input} value={veh.modelo} onChange={e => setVeh(v => ({ ...v, modelo: e.target.value }))} placeholder="Modelo" />
                <input style={S.input} value={veh.anio} onChange={e => setVeh(v => ({ ...v, anio: e.target.value }))} placeholder="Año" />
                <button onClick={() => versionesMut.mutate()} disabled={!veh.marca || !veh.modelo || versionesMut.isPending} style={{ ...S.btn('var(--color-primary)'), gridColumn: isMobile ? '1 / -1' : undefined }}><span style={{ color: '#000' }}>{versionesMut.isPending ? '...' : '🔍 Ver versiones'}</span></button>
              </div>
            )}

            {(modoMedida === 'placa' || modoMedida === 'vehiculo') && versiones.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Elige la versión correcta del vehículo:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {versiones.map((v, i) => (
                    <div key={i} onClick={() => setMedida(v.medida)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${medida === v.medida ? 'var(--color-primary)' : 'var(--color-border)'}`, background: medida === v.medida ? '#fffbeb' : 'var(--color-bg)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{v.version}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>{v.medida} {medida === v.medida ? '✓' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {medida && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>Medida: <strong>{medida}</strong></span>
                <button onClick={() => { setBuscarActivo(true); setBuscarQuery(''); }} style={{ ...S.btn('#16a34a'), flex: isMobile ? '1 1 100%' : undefined }}>🔍 Buscar en catálogo</button>
              </div>
            )}
          </div>

          {/* 3. Catálogo */}
          {buscarActivo && (
            <div style={S.card}>
              <div style={S.cardTitle}>3. Agregar llantas del catálogo</div>
              <input style={{ ...S.input, marginBottom: 12 }} value={buscarQuery} onChange={e => setBuscarQuery(e.target.value)} placeholder="Filtrar por medida, marca, SKU..." />
              {comparar.length >= 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>📌 {comparar.length} llanta{comparar.length !== 1 ? 's' : ''} marcada{comparar.length !== 1 ? 's' : ''} para comparar</span>
                  {comparar.length >= 2 && <button onClick={() => { setModalProdId(null); setVerComparador(true); }} style={{ padding: '5px 11px', borderRadius: 7, border: '2px solid #f59e0b', background: '#fffbeb', color: '#92400e', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>⚖️ Comparar ({comparar.length})</button>}
                  <button onClick={() => { setComparar([]); setVerComparador(false); }} style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer' }}>✕ Limpiar</button>
                </div>
              )}
              <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead><tr style={{ background: 'var(--color-bg)' }}>
                    {['Medida', 'Marca', 'Modelo', 'Precio', 'Stock', '', ''].map((h, i) => <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {productosCatalogo.map(p => {
                      const yaEsta = items.some(it => it.producto.id === p.id);
                      const stockTotal = p.stocks?.reduce((a, s) => a + s.cantidad, 0) ?? 0;
                      return (
                        <tr key={p.id} style={{ background: yaEsta ? '#f0fdf4' : stockTotal === 0 ? '#fafafa' : undefined, borderBottom: '1px solid var(--color-border)', opacity: stockTotal === 0 ? 0.6 : 1 }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }} onClick={() => setModalProdId(p.id)}>{p.medida}</td>
                          <td style={{ padding: '6px 10px' }}>{p.marca}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)' }}>{p.nombreComercial || '—'}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700 }}>{fmt(p.precioRegular)}</td>
                          <td style={{ padding: '6px 10px' }}><StockCell value={stockTotal} /></td>
                          <td style={{ padding: '6px 10px' }}><button onClick={() => setModalProdId(p.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer' }}>Ver</button></td>
                          <td style={{ padding: '6px 10px' }}><button onClick={() => addLlanta(p)} style={{ fontSize: 11, padding: '3px 10px', background: yaEsta ? 'var(--color-bg)' : '#16a34a', color: yaEsta ? 'var(--color-text)' : '#fff', border: yaEsta ? '1px solid var(--color-border)' : 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{yaEsta ? '+1' : '+ Agregar'}</button></td>
                        </tr>
                      );
                    })}
                    {productosCatalogo.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin resultados</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Llantas elegidas */}
          {items.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>4. Llantas en la cotización ({items.length})</div>
              {items.map((it, idx) => {
                const g = gananciaDeItem(it);
                const gLineaTotal = parseFloat(it.producto.precioRegular) * it.cantidad;
                const gCol = g <= 0 ? '#dc2626' : '#16a34a';
                return (
                <div key={it.producto.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{it.producto.marca} {it.producto.medida}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{it.producto.nombreComercial || ''} · {fmt(it.producto.precioRegular)} c/u</div>
                  </div>
                  <input type="number" min={1} value={it.cantidad} onChange={e => { const c = parseInt(e.target.value) || 1; setItems(prev => prev.map((x, i) => i === idx ? { ...x, cantidad: c } : x)); }}
                    style={{ width: 56, padding: '5px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, fontSize: 13, textAlign: 'center' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>{fmt(gLineaTotal)}</span>
                  <span title="Ganancia estimada de esta llanta — no editable" style={{ fontSize: 11.5, fontWeight: 800, minWidth: 84, textAlign: 'right', color: gCol }}>🔒 {fmt(g)}</span>
                  <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 16, cursor: 'pointer' }}>✕</button>
                </div>
                );
              })}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div style={S.group}><label style={S.label}>Descuento S/</label><input style={S.input} type="number" min={0} value={descuento} onChange={e => setDescuento(e.target.value)} placeholder="0" /></div>
              </div>
              <div style={S.group}><label style={S.label}>Notas</label><textarea style={{ ...S.input, height: 50, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Incluye instalación, garantía..." /></div>
            </div>
          )}

          {items.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>5. Costos adicionales de la venta</div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
                <input type="checkbox" checked={pagoTarjeta} onChange={e => setPagoTarjeta(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#16a34a' }} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>💳 Cliente paga con tarjeta (crédito/débito) — recargo 4%</span>
              </label>
              {pagoTarjeta && (
                <div style={{ display: 'flex', gap: 16, paddingLeft: 28, marginBottom: 8, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="radio" name="tarjetaAsume" checked={tarjetaAsume === 'cliente'} onChange={() => setTarjetaAsume('cliente')} />
                    Asumido por el cliente (suma al precio total)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="radio" name="tarjetaAsume" checked={tarjetaAsume === 'tienda'} onChange={() => setTarjetaAsume('tienda')} />
                    Asumido por la tienda (no afecta el precio)
                  </label>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
                <input type="checkbox" checked={trasladoTiendas} onChange={e => setTrasladoTiendas(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#16a34a' }} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>🚚 Traslado entre tiendas — S/ {montoTraslado.toFixed(2)}</span>
              </label>
              {trasladoTiendas && (
                <div style={{ display: 'flex', gap: 16, paddingLeft: 28, marginBottom: 8, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="radio" name="trasladoAsume" checked={trasladoAsume === 'cliente'} onChange={() => setTrasladoAsume('cliente')} />
                    Asumido por el cliente (suma al precio total)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="radio" name="trasladoAsume" checked={trasladoAsume === 'tienda'} onChange={() => setTrasladoAsume('tienda')} />
                    Asumido por la tienda (no afecta el precio)
                  </label>
                </div>
              )}

              <div style={{
                marginTop: 12, padding: '12px 14px', borderRadius: 8,
                background: gananciaColor === '#dc2626' ? '#fef2f2' : gananciaColor === '#d97706' ? '#fffbeb' : '#f0fdf4',
                border: `1.5px solid ${gananciaColor}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: gananciaColor }}>{gananciaTexto}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: gananciaColor }}>🔒 {fmt(gananciaFinal)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Ganancia estimada de la venta con los costos adicionales considerados.
                </div>
              </div>
            </div>
          )}

          {/* 6. Generar cita */}
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
                    {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  {sedeCita && items.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {items.map(it => {
                        const stk = stockDeSede(it.producto, sedeCita);
                        const ok = stk >= it.cantidad;
                        return <div key={it.producto.id} style={{ fontWeight: 600, color: ok ? '#16a34a' : '#dc2626' }}>{ok ? '✅' : '⚠️'} {it.producto.marca} {it.producto.medida}: {stk} u. {ok ? '' : `(faltan para ${it.cantidad})`}</div>;
                      })}
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
            <div style={{ fontSize: 13, marginBottom: 6 }}>{cliente.nombre || <span style={{ color: 'var(--color-text-muted)' }}>Sin cliente</span>}</div>
            {items.map(it => (
              <div key={it.producto.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{it.cantidad}× {it.producto.marca} {it.producto.medida}</span>
                <span>{fmt(parseFloat(it.producto.precioRegular) * it.cantidad)}</span>
              </div>
            ))}
            {parseFloat(descuento || 0) > 0 && <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Descuento</span><span>- {fmt(descuento)}</span></div>}
            {cargoCliente > 0 && <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#b45309' }}><span>Recargo (tarjeta/traslado)</span><span>+ {fmt(cargoCliente)}</span></div>}
            {generarCita && fechaCita && <div style={{ fontSize: 12, color: '#b45309', fontWeight: 600, marginTop: 6 }}>🗓️ Cita: {fechaCita}{horaCita ? ` ${horaCita}` : ''}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--color-border)', fontWeight: 800, fontSize: 16 }}>
              <span>TOTAL</span><span style={{ color: 'var(--color-primary)' }}>{fmt(totalCalc)}</span>
            </div>
            {items.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12.5, fontWeight: 700, color: gananciaColor }}>
                <span>{gananciaTexto}</span><span>🔒 {fmt(gananciaFinal)}</span>
              </div>
            )}
            <button onClick={() => crearMut.mutate()} disabled={!puedeGuardar || crearMut.isPending}
              style={{ width: '100%', marginTop: 16, padding: 12, background: puedeGuardar ? '#16a34a' : 'var(--color-surface2)', color: puedeGuardar ? '#fff' : 'var(--color-text-muted)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: puedeGuardar ? 'pointer' : 'default' }}>
              {crearMut.isPending ? 'Guardando...' : generarCita ? '✓ Crear cotización + cita' : '✓ Crear cotización'}
            </button>
            {!puedeGuardar && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>Falta: {!cliente.nombre ? 'cliente, ' : ''}{!items.length ? 'llantas, ' : ''}{generarCita && !fechaCita ? 'fecha, ' : ''}{generarCita && !sedeCita ? 'tienda' : ''}</div>}
          </div>
        </div>
      </div>

      {modalProdId && (
        <ProductoModal prodId={modalProdId} onClose={() => setModalProdId(null)} comparar={comparar}
          ocultarGestion
          onCotizar={(prod) => { addLlanta(prod); setModalProdId(null); }}
          onVerComparacion={() => { setModalProdId(null); setVerComparador(true); }}
          setComparar={(fn) => { const next = typeof fn === 'function' ? fn(comparar) : fn; setComparar(next); }} />
      )}
      {verComparador && comparar.length >= 2 && !modalProdId && (
        <ComparadorModal ids={comparar} onClose={() => { setVerComparador(false); setComparar([]); }} />
      )}
    </div>
  );
}
