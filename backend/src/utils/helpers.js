const IGV_RATE = 0.18;

function calcularTotales(items, descuentoTipo, descuentoValor) {
  const subtotalBruto = items.reduce((acc, item) => {
    return acc + parseFloat(item.precioUnit) * item.cantidad;
  }, 0);

  let descuento = 0;
  if (descuentoTipo === 'PORCENTAJE' && descuentoValor > 0) {
    descuento = subtotalBruto * (parseFloat(descuentoValor) / 100);
  } else if (descuentoTipo === 'MONTO' && descuentoValor > 0) {
    descuento = parseFloat(descuentoValor);
  }

  const subtotal = subtotalBruto - descuento;
  // Precios ya incluyen IGV — desagregamos
  const base = subtotal / (1 + IGV_RATE);
  const igv = subtotal - base;

  return {
    subtotal: parseFloat(base.toFixed(2)),
    igv: parseFloat(igv.toFixed(2)),
    total: parseFloat(subtotal.toFixed(2)),
    montoAhorrado: parseFloat(descuento.toFixed(2)),
  };
}

function generarNumero(prefix, count) {
  return `${prefix}${String(count + 1).padStart(6, '0')}`;
}

function paginar(page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

// Un lead que eligió "envío a provincia" puede traer un Local_Asignado "{}"
// (objeto vacío) heredado del flujo de n8n, que en JS es verdadero aunque no
// tenga datos reales. localValido() sólo acepta un local con nombre real, y
// nunca lo devuelve si el lead ya tiene provincia de destino — evita que un
// mismo registro muestre local Y provincia a la vez ("se cruzan los datos").
function localValido(local, provinciaDestino) {
  if (provinciaDestino) return null;
  if (!local || typeof local !== 'object') return null;
  return (local.Nombre || local.nombre) ? local : null;
}

module.exports = { calcularTotales, generarNumero, paginar, localValido, IGV_RATE };
