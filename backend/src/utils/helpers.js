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

module.exports = { calcularTotales, generarNumero, paginar, IGV_RATE };
