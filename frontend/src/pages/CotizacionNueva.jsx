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

const PCT_TRANSFERENCIA = 0.05;

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
  const [pagoTransferencia, setPagoTransferencia] = useState(false);
  const [trasladoAsumeTienda, setTrasladoAsumeTienda] = useState(false);
  // Cargos extra al cliente: se pueden agregar varios, cada uno con su propio
  // motivo, para que quede claro por qué se cobró cada uno.
  const [cargosExtra, setCargosExtra] = useState([]); // [{ id, monto, descripcion }]
  const agregarCargoExtra = () => setCargosExtra(prev => [...prev, { id: crypto.randomUUID(), monto: '', descripcion: '' }]);
  const actualizarCargoExtra = (id, campo, valor) => setCargosExtra(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  const eliminarCargoExtra = (id) => setCargosExtra(prev => prev.filter(c => c.id !== id));

  // ── Seguimiento interno del traslado (no se le muestra al cliente) ──
  // Por cada llanta (productoId) se puede repartir el traslado entre varias
  // tiendas/almacenes de origen: { [productoId]: { [sedeId]: cantidad } }
  const [origenesPorItem, setOrigenesPorItem] = useState({});
  const setCantidadOrigen = (productoId, sedeId, cantidad) => {
    setOrigenesPorItem(prev => ({
      ...prev,
      [productoId]: { ...prev[productoId], [sedeId]: cantidad },
    }));
  };

  // ── Tienda de instalación (se elige temprano: define prioridad del catálogo
  // y el descuento por traslado; la cita reutiliza esta misma tienda) ──
  const [sedeCita, setSedeCita] = useState('');

  // ── Cita ──
  const [generarCita, setGenerarCita] = useState(!!pre.sede);
  const [fechaCita, setFechaCita] = useState('');
  const [horaCita, setHoraCita] = useState('');

  const { data: sedes = [] } = useQuery({ queryKey: ['sedes'], queryFn: sedesApi.listar, staleTime: Infinity });
  // El cliente solo puede instalar en una tienda, nunca en un almacén.
  const tiendas = useMemo(() => sedes.filter(s => s.tipo === 'TIENDA'), [sedes]);

  // Precargar la tienda que el cliente eligió por WhatsApp (llega por código de
  // local; las sedes cargan async, así que se hace una vez que ya están).
  useEffect(() => {
    if (!pre.sede?.codigoLocal || sedeCita || tiendas.length === 0) return;
    const match = tiendas.find(s => s.codigoLocal === pre.sede.codigoLocal);
    if (match) setSedeCita(match.id);
  }, [tiendas]); // eslint-disable-line

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

  const stockDeSede = (prod, sedeId) => prod?.stocks?.find(s => s.sedeId === sedeId || s.sede?.id === sedeId)?.cantidad ?? 0;

  // Catálogo ordenado: primero lo que hay en la tienda elegida (para instalar
  // ahí mismo sin traslado), luego el resto con stock en cualquier tienda,
  // luego sin stock (mayor stock primero como desempate).
  const productosCatalogo = useMemo(() => {
    const list = productos?.data || [];
    return [...list].sort((a, b) => {
      if (sedeCita) {
        const la = stockDeSede(a, sedeCita) > 0 ? 1 : 0;
        const lb = stockDeSede(b, sedeCita) > 0 ? 1 : 0;
        if (la !== lb) return lb - la;
      }
      const sa = a.stocks?.reduce((s, x) => s + x.cantidad, 0) ?? 0;
      const sb = b.stocks?.reduce((s, x) => s + x.cantidad, 0) ?? 0;
      if (sa > 0 && sb === 0) return -1;
      if (sa === 0 && sb > 0) return 1;
      return sb - sa;
    });
  }, [productos, sedeCita]);

  // Sugerencias ajax de medida mientras se tipea
  const { data: medidaSugeridas = [] } = useQuery({
    queryKey: ['medidas-sug', medida],
    queryFn: () => productosApi.medidas(medida),
    enabled: modoMedida === 'directa' && medida.length >= 2,
    staleTime: 60_000,
  });

  const addLlanta = (prod, cantidadInicial = 4) => {
    setItems(prev => {
      const i = prev.findIndex(it => it.producto.id === prod.id);
      if (i >= 0) return prev.map((it, idx) => idx === i ? { ...it, cantidad: it.cantidad + 1 } : it);
      return [...prev, { producto: prod, cantidad: cantidadInicial }];
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

  // Precargar la llanta exacta que el cliente eligió por WhatsApp (medida +
  // marca + modelo) directo en "3. Llantas en la cotización", sin que el
  // vendedor tenga que buscarla de nuevo.
  useEffect(() => {
    if (!pre.medida || !pre.llanta?.marca) return;
    productosApi.listar({ medida: pre.medida, q: pre.llanta.marca, limit: 20 }).then(r => {
      const lista = r?.data || [];
      const match = pre.llanta.modelo
        ? lista.find(p => (p.nombreComercial || '').trim().toLowerCase() === pre.llanta.modelo.trim().toLowerCase()) || lista[0]
        : lista[0];
      if (match) addLlanta(match, pre.llanta.cantidad || 4);
    }).catch(() => {});
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

  const subtotal = items.reduce((a, i) => a + parseFloat(i.producto.precioOferta) * i.cantidad, 0);
  const gananciaBase = items.reduce((a, it) => a + gananciaDeItem(it), 0);

  const sedeSel = sedes.find(s => s.id === sedeCita);

  // Descuento por traslado: la misma regla que usa el bot de WhatsApp — el
  // costo de traslado ya está incluido en el precio de cada llanta, así que
  // nunca se cobra de más, solo se descuenta. Si la tienda elegida SÍ tiene
  // stock de esa llanta (no hace falta traer nada), se descuenta el traslado
  // completo de todas las unidades. Si NO tiene stock (hay que traerla), solo
  // se descuenta a partir de la 2da unidad porque el mismo viaje trae varias.
  const montoTraslado = calcCostoTraslado(costosVenta);
  const descuentoTraslado = sedeCita ? items.reduce((sum, it) => {
    const hayStock = stockDeSede(it.producto, sedeCita) > 0;
    const desc = hayStock ? montoTraslado * it.cantidad : montoTraslado * Math.max(0, it.cantidad - 1);
    return sum + desc;
  }, 0) : 0;

  // Traslado restante: el descuento automático de arriba deja SIEMPRE un
  // viaje sin descontar por cada modelo que de verdad hay que traer (por
  // eso es "cantidad - 1" y no "cantidad"). Ese último viaje lo sigue
  // pagando el cliente dentro del precio, salvo que el vendedor active
  // "Traslado lo paga la tienda" — ahí sí sale del bolsillo de la tienda,
  // así que se descuenta también del precio final y de la ganancia.
  const trasladoRestanteBase = sedeCita ? items.reduce((sum, it) => {
    if (it.cantidad <= 0) return sum;
    const hayStock = stockDeSede(it.producto, sedeCita) > 0;
    return hayStock ? sum : sum + montoTraslado;
  }, 0) : 0;
  const costoTrasladoRestante = trasladoAsumeTienda ? trasladoRestanteBase : 0;

  const subtotalConTraslado = Math.max(0, subtotal - descuentoTraslado - costoTrasladoRestante);
  const descuentoTransferencia = pagoTransferencia ? subtotalConTraslado * PCT_TRANSFERENCIA : 0;

  const descuentoManual = parseFloat(descuento || 0);
  const descuentoTotal = descuentoManual + descuentoTraslado + costoTrasladoRestante + descuentoTransferencia;

  // La ganancia (utilidad real de la tienda) solo se ve afectada por lo que
  // realmente sale del bolsillo de la tienda:
  // - Descuento por traslado (automático): nunca resta ganancia, es un
  //   ajuste de precio (el viaje que no se hizo no le cuesta nada a la tienda).
  // - Traslado restante (si la tienda lo asume): sí resta ganancia, porque
  //   ahora la tienda paga de su bolsillo el viaje que faltaba.
  // - Descuento por transferencia: nunca resta ganancia, es un beneficio al
  //   precio del cliente por elegir ese medio de pago.
  // - Descuento manual (S/): siempre resta ganancia, es dinero que el
  //   vendedor decide regalar directamente.
  const gananciaFinal = gananciaBase - descuentoManual - costoTrasladoRestante;

  // Cargos extra: costos puntuales que se le cobran al cliente (ej. válvulas
  // nuevas, servicio a domicilio). Se pueden agregar varios, cada uno con su
  // propio motivo. Suman al precio total; no son ganancia de la venta de
  // llantas, así que no se cuentan en gananciaFinal.
  const cargoManual = cargosExtra.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
  const totalCalc = Math.max(0, subtotal - descuentoTotal + cargoManual);

  // Semáforo de ganancia: roja (sin ganancia), amarilla (hay descuentos que sí
  // afectan la ganancia real, pero sigue siendo positiva), verde (ganancia intacta)
  const estadoGanancia = gananciaFinal <= 0 ? 'roja' : gananciaFinal < gananciaBase ? 'amarilla' : 'verde';
  const gananciaColor = { roja: '#dc2626', amarilla: '#d97706', verde: '#16a34a' }[estadoGanancia];
  const gananciaTexto = { roja: '🔴 Sin ganancia — no procede la venta así', amarilla: '🟡 Ganancia mínima', verde: '🟢 Ganancia saludable' }[estadoGanancia];

  const cargosExtraIncompletos = cargosExtra.some(c => (parseFloat(c.monto) || 0) > 0 && !c.descripcion.trim());
  const puedeGuardar = cliente.nombre && items.length > 0 && (!generarCita || (fechaCita && sedeCita)) && !cargosExtraIncompletos;

  const crearMut = useMutation({
    mutationFn: () => {
      const sede = sedes.find(s => s.id === sedeCita);
      const local = sede ? { ID: sede.codigoLocal, Nombre: sede.nombre, Direccion: sede.direccion || '', Distrito: sede.distrito || '' } : undefined;
      const notasOrigenes = items.map(it => {
        const asignaciones = origenesPorItem[it.producto.id] || {};
        const partes = Object.entries(asignaciones)
          .filter(([, cant]) => (parseInt(cant) || 0) > 0)
          .map(([sedeId, cant]) => {
            const s = sedes.find(x => x.id === sedeId);
            return s ? `${cant} desde ${s.nombre}${s.tipo === 'ALMACEN' ? ' (almacén)' : ''}` : null;
          }).filter(Boolean);
        if (partes.length === 0) return null;
        return `[INTERNO] ${it.producto.marca} ${it.producto.medida}: traer ${partes.join(', ')} hacia ${sede?.nombre || 'la tienda elegida'}.`;
      }).filter(Boolean);
      const notasExtra = [
        descuentoTraslado > 0 ? `Descuento por traslado (según stock en ${sede?.nombre || 'tienda elegida'}): ${fmt(descuentoTraslado)} — ajuste de precio, no afecta ganancia.` : null,
        costoTrasladoRestante > 0 ? `Traslado restante asumido por la tienda: ${fmt(costoTrasladoRestante)} — resta ganancia.` : null,
        pagoTransferencia ? `Pago por transferencia bancaria: descuento 5% (${fmt(descuentoTransferencia)}), no afecta ganancia.` : null,
        ...cargosExtra.filter(c => (parseFloat(c.monto) || 0) > 0).map(c => `Cargo adicional al cliente: ${fmt(c.monto)} — ${c.descripcion || 'sin motivo especificado'}.`),
        ...notasOrigenes,
      ].filter(Boolean);
      const notasFinal = [notas, ...notasExtra].filter(Boolean).join('\n');
      return cotizacionesApi.crear({
        leadId: leadId || undefined,
        nombreCliente: cliente.nombre, telefonoCliente: cliente.telefono, dniCe: cliente.dniCe,
        marcaAuto: veh.marca, modeloAuto: veh.modelo, anioAuto: veh.anio,
        items: items.map(i => ({
          sku: i.producto.sku, medida: i.producto.medida, marca: i.producto.marca,
          modelo: i.producto.nombreComercial, cantidad: i.cantidad, precioUnit: parseFloat(i.producto.precioOferta),
        })),
        descuento: descuentoTotal > 0 ? descuentoTotal : undefined,
        cargoAdicional: cargoManual > 0 ? cargoManual : undefined,
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

          {/* 2. Tienda de instalación */}
          <div style={S.card}>
            <div style={S.cardTitle}>2. Tienda de instalación</div>
            <div style={S.group}>
              <label style={S.label}>¿En qué tienda va a instalar el cliente?</label>
              {pre.sede?.nombre && (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 6 }}>
                  🏪 Ya elegida por WhatsApp
                </div>
              )}
              <select style={S.input} value={sedeCita} onChange={e => setSedeCita(e.target.value)}>
                <option value="">— Elegir tienda —</option>
                {tiendas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            {sedeSel && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12.5 }}>
                📍 {sedeSel.direccion || 'Sin dirección registrada'}{sedeSel.distrito ? ` · ${sedeSel.distrito}` : ''}
                {sedeSel.telefono && <div style={{ marginTop: 2 }}>📞 {sedeSel.telefono}</div>}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Al elegir la tienda, el catálogo de abajo mostrará primero las llantas que ya hay en stock ahí.
            </div>
          </div>

          {/* 3. Medida */}
          <div style={S.card}>
            <div style={S.cardTitle}>3. Medida de la llanta</div>
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

          {/* 4. Catálogo */}
          {buscarActivo && (
            <div style={S.card}>
              <div style={S.cardTitle}>4. Agregar llantas del catálogo</div>
              {sedeSel && (
                <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600, marginBottom: 8 }}>
                  🏪 Primero se muestran las llantas con stock en {sedeSel.nombre}
                </div>
              )}
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
                    {['Medida', 'Marca', 'Modelo', 'Precio', 'Stock', ...(sedeCita ? [`Stock en ${sedeSel?.nombre || 'tienda elegida'}`] : []), '', ''].map((h, i) => <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {productosCatalogo.map(p => {
                      const yaEsta = items.some(it => it.producto.id === p.id);
                      const stockTotal = p.stocks?.reduce((a, s) => a + s.cantidad, 0) ?? 0;
                      const stockEnTienda = sedeCita ? stockDeSede(p, sedeCita) : null;
                      const parcial = stockEnTienda > 0 && stockEnTienda < 4;
                      const colorTienda = !stockEnTienda ? '#dc2626' : parcial ? '#d97706' : '#16a34a';
                      const iconoTienda = !stockEnTienda ? '❌' : parcial ? '🟡' : '✅';
                      const textoTienda = !stockEnTienda ? 'Sin stock' : parcial ? `Parcial: ${stockEnTienda} uds` : `Completo: ${stockEnTienda} uds`;
                      return (
                        <tr key={p.id} style={{ background: yaEsta ? '#f0fdf4' : stockTotal === 0 ? '#fafafa' : undefined, borderBottom: '1px solid var(--color-border)', opacity: stockTotal === 0 ? 0.6 : 1 }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }} onClick={() => setModalProdId(p.id)}>{p.medida}</td>
                          <td style={{ padding: '6px 10px' }}>{p.marca}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)' }}>{p.nombreComercial || '—'}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700 }}>{fmt(p.precioOferta)}</td>
                          <td style={{ padding: '6px 10px' }}><StockCell value={stockTotal} /></td>
                          {sedeCita && (
                            <td style={{ padding: '6px 10px', fontWeight: 700, color: colorTienda, whiteSpace: 'nowrap' }}>{iconoTienda} {textoTienda}</td>
                          )}
                          <td style={{ padding: '6px 10px' }}><button onClick={() => setModalProdId(p.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer' }}>Ver</button></td>
                          <td style={{ padding: '6px 10px' }}><button onClick={() => addLlanta(p)} style={{ fontSize: 11, padding: '3px 10px', background: yaEsta ? 'var(--color-bg)' : '#16a34a', color: yaEsta ? 'var(--color-text)' : '#fff', border: yaEsta ? '1px solid var(--color-border)' : 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>{yaEsta ? '+1' : '+ Agregar'}</button></td>
                        </tr>
                      );
                    })}
                    {productosCatalogo.length === 0 && <tr><td colSpan={sedeCita ? 8 : 7} style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin resultados</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Llantas elegidas */}
          {items.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>5. Llantas en la cotización ({items.length})</div>
              {items.map((it, idx) => {
                const g = gananciaDeItem(it);
                const gLineaTotal = parseFloat(it.producto.precioOferta) * it.cantidad;
                const gCol = g <= 0 ? '#dc2626' : '#16a34a';
                const stockDestino = sedeCita ? stockDeSede(it.producto, sedeCita) : 0;
                const faltante = sedeCita ? Math.max(0, it.cantidad - stockDestino) : 0;
                const origenesDisponibles = sedeCita ? sedes
                  .filter(s => s.id !== sedeCita)
                  .map(s => ({ sede: s, stock: stockDeSede(it.producto, s.id) }))
                  .filter(o => o.stock > 0)
                  .sort((a, b) => b.stock - a.stock) : [];
                const asignaciones = origenesPorItem[it.producto.id] || {};
                const asignado = Object.values(asignaciones).reduce((a, b) => a + (parseInt(b) || 0), 0);
                return (
                <div key={it.producto.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{it.producto.marca} {it.producto.medida}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{it.producto.nombreComercial || ''} · {fmt(it.producto.precioOferta)} c/u</div>
                    </div>
                    <input type="number" min={1} value={it.cantidad} onChange={e => { const c = parseInt(e.target.value) || 1; setItems(prev => prev.map((x, i) => i === idx ? { ...x, cantidad: c } : x)); }}
                      style={{ width: 56, padding: '5px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, fontSize: 13, textAlign: 'center' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>{fmt(gLineaTotal)}</span>
                    <span title="Ganancia estimada de esta llanta — no editable" style={{ fontSize: 11.5, fontWeight: 800, minWidth: 84, textAlign: 'right', color: gCol }}>🔒 {fmt(g)}</span>
                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 16, cursor: 'pointer' }}>✕</button>
                  </div>

                  {faltante > 0 && (
                    <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 8, background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                        🔒 Uso interno — de dónde traer las {faltante} que faltan
                      </div>
                      {origenesDisponibles.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No hay stock de esta llanta en otras tiendas/almacenes.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {origenesDisponibles.map(({ sede: s, stock }) => {
                            const val = parseInt(asignaciones[s.id]) || 0;
                            return (
                              <div key={s.id}
                                onClick={() => setCantidadOrigen(it.producto.id, s.id, String(Math.min(stock, val + 1)))}
                                style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                                  border: `1.5px solid ${val > 0 ? '#16a34a' : 'var(--color-border)'}`,
                                  background: val > 0 ? '#f0fdf4' : 'var(--color-bg)',
                                }}>
                                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                                  {s.nombre}{s.tipo === 'ALMACEN' ? ' (Almacén)' : ''} — {stock} en stock
                                </span>
                                <input
                                  type="number" min={0} max={stock} value={val}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => setCantidadOrigen(it.producto.id, s.id, String(Math.max(0, Math.min(stock, parseInt(e.target.value) || 0))))}
                                  style={{ width: 50, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 12, textAlign: 'center' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, color: asignado >= faltante ? '#16a34a' : '#d97706' }}>
                        {asignado} de {faltante} unidades asignadas{asignado >= faltante ? ' ✓' : ' — falta asignar'}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
              <div style={S.group}><label style={S.label}>Notas</label><textarea style={{ ...S.input, height: 50, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Incluye instalación, garantía..." /></div>
            </div>
          )}

          {items.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>6. Costos adicionales de la venta</div>

              {!sedeCita && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  Elige la tienda de instalación arriba (paso 2) para calcular el descuento por traslado.
                </div>
              )}
              {sedeCita && descuentoTraslado > 0 && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: '#16a34a' }}>🚚 Descuento por traslado: {fmt(descuentoTraslado)}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {items.map(it => {
                      const hayStock = stockDeSede(it.producto, sedeCita) > 0;
                      const desc = hayStock ? montoTraslado * it.cantidad : montoTraslado * Math.max(0, it.cantidad - 1);
                      if (desc <= 0) return null;
                      const nombre = `${it.producto.marca} ${it.producto.medida}`;
                      return (
                        <div key={it.producto.id}>
                          {hayStock
                            ? `✅ ${nombre}: ya hay stock en ${sedeSel?.nombre}, sin traslado — descuento ${fmt(desc)}`
                            : `🚚 Por llevar ${it.cantidad} ${nombre}, descuento por traslado: ${fmt(desc)}`}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Es un ajuste de precio, no afecta la ganancia.
                  </div>
                  {trasladoRestanteBase > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={trasladoAsumeTienda} onChange={e => setTrasladoAsumeTienda(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#16a34a' }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>🏪 Traslado lo paga la tienda — descuenta {fmt(trasladoRestanteBase)} más (el viaje que aún falta), del precio y de la ganancia</span>
                    </label>
                  )}
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
                <input type="checkbox" checked={pagoTransferencia} onChange={e => setPagoTransferencia(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#16a34a' }} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>🏦 Cliente paga por transferencia bancaria — descuento 5%</span>
              </label>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', paddingLeft: 28, marginTop: -4, marginBottom: 8 }}>
                Reduce el precio del cliente, no afecta la ganancia de la tienda.
              </div>

              <div style={S.group}>
                <label style={S.label}>💰 Descuento manual S/ (resta del precio y de la ganancia)</label>
                <input style={S.input} type="number" min={0} value={descuento} onChange={e => setDescuento(e.target.value)} placeholder="0" />
              </div>

              <div style={S.group}>
                <label style={S.label}>➕ Cargos extra al cliente</label>
                {cargosExtra.map(c => {
                  const montoInvalido = (parseFloat(c.monto) || 0) > 0 && !c.descripcion.trim();
                  return (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '90px 1fr auto' : '120px 1fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                      <input style={S.input} type="number" min={0} value={c.monto} onChange={e => actualizarCargoExtra(c.id, 'monto', e.target.value)} placeholder="S/ 0" />
                      <input style={{ ...S.input, borderColor: montoInvalido ? '#dc2626' : undefined }} value={c.descripcion} onChange={e => actualizarCargoExtra(c.id, 'descripcion', e.target.value)} placeholder="Motivo: válvulas nuevas, servicio a domicilio..." />
                      <button onClick={() => eliminarCargoExtra(c.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 18, cursor: 'pointer', padding: '6px 4px' }}>✕</button>
                    </div>
                  );
                })}
                <button onClick={agregarCargoExtra} style={{ padding: '6px 12px', borderRadius: 7, border: '1.5px dashed var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Agregar cargo extra</button>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Cada uno suma al precio total del cliente, con su motivo para que quede registrado por qué se cobró.
                </div>
              </div>

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

          {/* 7. Generar cita */}
          <div style={S.card}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: generarCita ? 16 : 0 }}>
              <input type="checkbox" checked={generarCita} onChange={e => setGenerarCita(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#16a34a' }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>🗓️ Generar cita de instalación ahora</span>
            </label>
            {generarCita && (
              <>
                <div style={S.group}>
                  <label style={S.label}>Tienda de instalación</label>
                  {sedeSel ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>🏪 {sedeSel.nombre}</div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>⚠️ Elige la tienda en el paso 2 antes de continuar</div>
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
                <span>{fmt(parseFloat(it.producto.precioOferta) * it.cantidad)}</span>
              </div>
            ))}
            {descuentoTraslado > 0 && <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}><span>Descuento traslado</span><span>- {fmt(descuentoTraslado)}</span></div>}
            {costoTrasladoRestante > 0 && <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}><span>Traslado asumido por la tienda</span><span>- {fmt(costoTrasladoRestante)}</span></div>}
            {descuentoTransferencia > 0 && <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}><span>Descuento transferencia (5%)</span><span>- {fmt(descuentoTransferencia)}</span></div>}
            {descuentoManual > 0 && <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Descuento</span><span>- {fmt(descuentoManual)}</span></div>}
            {cargosExtra.filter(c => (parseFloat(c.monto) || 0) > 0).map(c => (
              <div key={c.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#b45309' }}><span>{c.descripcion || 'Cargo adicional'}</span><span>+ {fmt(c.monto)}</span></div>
            ))}
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
            {!puedeGuardar && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>Falta: {!cliente.nombre ? 'cliente, ' : ''}{!items.length ? 'llantas, ' : ''}{generarCita && !fechaCita ? 'fecha, ' : ''}{generarCita && !sedeCita ? 'tienda, ' : ''}{cargosExtraIncompletos ? 'motivo de algún cargo extra' : ''}</div>}
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
