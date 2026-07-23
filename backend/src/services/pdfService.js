const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const LOGO_OSO    = path.join(__dirname, '..', 'assets', 'logo-oso.png');

const EMPRESA = {
  nombre: 'LLANTALAND S.A.C.',
  ruc: process.env.SUNAT_RUC || '20xxxxxxxxx',
  web: 'www.llantaland.com',
  telefono: '+51 972 124 470',
};

const C = {
  amarillo: '#f5c400',
  negro:    '#080808',
  texto:    '#1e293b',
  gris:     '#64748b',
  grisClaro:'#f8fafc',
  rojo:     '#e3000f',
};

const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;
const fmtFecha = (d) => new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
// Día de la semana + fecha larga, ej: "Lunes 16/06/2026"
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function fmtDiaFecha(d) {
  if (!d) return null;
  const f = new Date(d);
  if (isNaN(f)) return null;
  const dia = DIAS[f.getDay()];
  return `${dia} ${f.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}
// Bloque de instalación reutilizable (cotización y venta)
function bloqueInstalacion(doc, obj, y, C) {
  const local = obj.localInstalacion;
  const diaFecha = fmtDiaFecha(obj.fechaInstalacion);
  const tieneAlgo = local || diaFecha || obj.fechaCita || obj.provinciaDestino;
  if (!tieneAlgo) return y;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(C.amarillo).text('CITA DE INSTALACIÓN:', 50, y);
  y += 14;
  if (local?.Nombre || local?.nombre) {
    // Sin dirección impresa (puede quedar desactualizada) — se coordina la
    // ubicación exacta por WhatsApp, con el mismo número que usa el bot.
    doc.fontSize(9).font('Helvetica').fillColor(C.texto)
      .text(`Local: ${local.Nombre || local.nombre}  —  Coordina por WhatsApp: ${EMPRESA.telefono}`, 50, y);
    y += 14;
  }
  if (diaFecha) {
    const horaTxt = obj.horaInstalacion ? `  a las ${obj.horaInstalacion}` : '';
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.texto).text(`Día y hora: ${diaFecha}${horaTxt}`, 50, y);
    y += 14;
  } else if (obj.fechaCita) {
    doc.fontSize(9).font('Helvetica').fillColor(C.texto).text(`Fecha de cita: ${obj.fechaCita}`, 50, y);
    y += 14;
  }
  if (obj.provinciaDestino) {
    doc.fontSize(9).font('Helvetica').fillColor(C.texto).text(`Provincia destino: ${obj.provinciaDestino}`, 50, y);
    y += 14;
  }
  return y + 4;
}

async function generarVenta(venta) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

      const filename = `venta-${venta.numero}-${uuidv4().slice(0, 8)}.pdf`;
      const filepath = path.join(UPLOADS_DIR, filename);
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // ── Header negro con acento amarillo ──
      doc.rect(0, 0, doc.page.width, 96).fill(C.negro);
      doc.rect(0, 94, doc.page.width, 3).fill(C.amarillo);

      // Logo oso
      if (fs.existsSync(LOGO_OSO)) {
        doc.image(LOGO_OSO, 14, 12, { width: 72, height: 72 });
      }

      // Texto logo "LLANTALAND"
      doc.fontSize(22).font('Helvetica-Bold').fillColor(C.amarillo)
        .text('LLANTALAND', 94, 18);
      doc.fontSize(8).font('Helvetica').fillColor('#999')
        .text(`RUC ${EMPRESA.ruc}  •  ${EMPRESA.web}  •  ${EMPRESA.telefono}`, 94, 46);

      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.amarillo)
        .text('COMPROBANTE DE VENTA', 340, 18, { align: 'right', width: 210 });
      doc.fontSize(14).font('Helvetica-Bold').fillColor('white')
        .text(`N° ${venta.numero}`, 340, 36, { align: 'right', width: 210 });
      doc.fontSize(8).font('Helvetica').fillColor('#999')
        .text(`Fecha: ${fmtFecha(venta.createdAt)}`, 340, 56, { align: 'right', width: 210 });
      if (venta.estado) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor(venta.estado === 'COMPLETADA' ? '#22c55e' : '#f59e0b')
          .text(venta.estado, 340, 70, { align: 'right', width: 210 });
      }

      let y = 116;

      // ── Sección cliente ──
      doc.rect(50, y, doc.page.width - 100, 70).fill(C.grisClaro).stroke(C.grisClaro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(C.amarillo)
        .text('DATOS DEL CLIENTE', 62, y + 8);

      const nombre = venta.nombreCliente || 'Sin nombre';
      const docCliente = venta.dniCe ? `DNI/CE: ${venta.dniCe}` : '';
      const tel = venta.telefonoCliente ? `Tel: ${venta.telefonoCliente}` : '';
      const auto = [venta.marcaAuto, venta.modeloAuto, venta.anioAuto].filter(Boolean).join(' ');

      doc.fontSize(12).font('Helvetica-Bold').fillColor(C.texto).text(nombre, 62, y + 22);
      doc.fontSize(9).font('Helvetica').fillColor(C.gris)
        .text([docCliente, tel].filter(Boolean).join('   '), 62, y + 38);
      if (auto) doc.fontSize(9).fillColor(C.gris).text(`Vehículo: ${auto}`, 62, y + 52);

      y += 82;

      // ── Producto ──
      doc.rect(50, y, doc.page.width - 100, 18).fill(C.negro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
        .text('PRODUCTO', 62, y + 5)
        .text('MEDIDA', 240, y + 5, { width: 80 })
        .text('CANT.', 320, y + 5, { width: 50, align: 'right' })
        .text('P. UNIT.', 370, y + 5, { width: 65, align: 'right' })
        .text('TOTAL', 435, y + 5, { width: 65, align: 'right' });
      y += 20;

      // Una o varias llantas (itemsLlanta de la cotización) o la llanta única
      const lineasV = Array.isArray(venta.itemsLlanta) && venta.itemsLlanta.length > 0
        ? venta.itemsLlanta
        : [{ marca: venta.marcaLlanta, modelo: venta.modeloLlanta, medida: venta.medidaLlanta, cantidad: venta.cantidad || 1, precioUnit: parseFloat(venta.precioUnit) }];
      lineasV.forEach((it, idx) => {
        const bg = idx % 2 === 0 ? 'white' : C.grisClaro;
        doc.rect(50, y, doc.page.width - 100, 24).fill(bg);
        const nombreProd = [it.marca, it.modelo].filter(Boolean).join(' ') || 'Llanta';
        const cant = parseInt(it.cantidad || 1) || 1;
        const pu = parseFloat(it.precioUnit || 0) || 0;
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.texto)
          .text(nombreProd, 62, y + 7, { width: 175 }).text(it.medida || '—', 240, y + 7, { width: 80 });
        doc.font('Helvetica')
          .text(String(cant), 320, y + 7, { width: 50, align: 'right' })
          .text(fmt(pu), 370, y + 7, { width: 65, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(C.texto).text(fmt(pu * cant), 435, y + 7, { width: 65, align: 'right' });
        y += 26;
      });
      y += 4;

      // Líneas de ítems de inventario si existen
      if (venta.items && venta.items.length > 0) {
        venta.items.forEach((item, idx) => {
          const bg = idx % 2 === 0 ? C.grisClaro : 'white';
          doc.rect(50, y, doc.page.width - 100, 22).fill(bg);
          const pn = item.producto ? `${item.producto.marca} ${item.producto.nombreComercial || ''} ${item.producto.medida || ''}`.trim() : '—';
          doc.fontSize(8).font('Helvetica').fillColor(C.texto)
            .text(pn, 62, y + 7, { width: 180 })
            .text(item.producto?.medida || '—', 240, y + 7, { width: 80 })
            .text(String(item.cantidad), 320, y + 7, { width: 50, align: 'right' })
            .text(fmt(item.precioUnit), 370, y + 7, { width: 65, align: 'right' })
            .text(fmt(item.subtotal), 435, y + 7, { width: 65, align: 'right' });
          y += 22;
        });
      }

      y += 10;

      // ── Total ──
      doc.rect(370, y, 175, 30).fill(C.negro);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.amarillo)
        .text('TOTAL:', 375, y + 9, { width: 80 });
      doc.fontSize(14).font('Helvetica-Bold').fillColor(C.amarillo)
        .text(fmt(venta.precioTotal), 375, y + 7, { width: 165, align: 'right' });
      y += 44;

      // ── Instalación (vehículo + cita) ──
      if (auto) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.amarillo).text('VEHÍCULO:', 50, y);
        doc.fontSize(9).font('Helvetica').fillColor(C.texto).text(auto, 130, y);
        y += 16;
      }
      y = bloqueInstalacion(doc, venta, y, C);

      // ── Pie ──
      const pieY = doc.page.height - 50;
      doc.rect(0, pieY - 5, doc.page.width, 2).fill(C.amarillo);
      doc.fontSize(8).font('Helvetica').fillColor(C.gris)
        .text('Gracias por su preferencia  •  Llantaland — Tu llanta, nuestra pasión  •  www.llantaland.com', 50, pieY + 4, {
          align: 'center', width: doc.page.width - 100,
        });

      doc.end();
      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (err) { reject(err); }
  });
}

async function generarCotizacion(cot) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

      const filename = `cotizacion-${cot.numero}-${uuidv4().slice(0, 8)}.pdf`;
      const filepath = path.join(UPLOADS_DIR, filename);
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.rect(0, 0, doc.page.width, 96).fill(C.negro);
      doc.rect(0, 94, doc.page.width, 3).fill(C.amarillo);

      // Logo oso
      if (fs.existsSync(LOGO_OSO)) {
        doc.image(LOGO_OSO, 14, 12, { width: 72, height: 72 });
      }

      // Texto logo "LLANTALAND"
      doc.fontSize(22).font('Helvetica-Bold').fillColor(C.amarillo).text('LLANTALAND', 94, 18);
      doc.fontSize(8).font('Helvetica').fillColor('#999')
        .text(`RUC ${EMPRESA.ruc}  •  ${EMPRESA.web}  •  ${EMPRESA.telefono}`, 94, 46);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.amarillo)
        .text('COTIZACIÓN', 340, 18, { align: 'right', width: 210 });
      doc.fontSize(14).font('Helvetica-Bold').fillColor('white')
        .text(`N° ${cot.numero}`, 340, 36, { align: 'right', width: 210 });
      doc.fontSize(8).font('Helvetica').fillColor('#999')
        .text(`Fecha: ${fmtFecha(cot.createdAt)}   •   Vendedor: ${cot.usuario?.nombre || '—'}`, 340, 56, { align: 'right', width: 210 });
      const estadoColor = { BORRADOR: '#f59e0b', ENVIADA: '#3b82f6', ACEPTADA: '#22c55e', RECHAZADA: '#ef4444', CONVERTIDA: '#8b5cf6' };
      doc.fontSize(8).font('Helvetica-Bold').fillColor(estadoColor[cot.estado] || '#888')
        .text(cot.estado, 340, 70, { align: 'right', width: 210 });

      let y = 116;

      // Cliente
      doc.rect(50, y, doc.page.width - 100, 70).fill(C.grisClaro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(C.amarillo).text('DATOS DEL CLIENTE', 62, y + 8);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(C.texto).text(cot.nombreCliente || 'Sin nombre', 62, y + 22);
      doc.fontSize(9).font('Helvetica').fillColor(C.gris)
        .text([cot.dniCe ? `DNI/CE: ${cot.dniCe}` : '', cot.telefonoCliente ? `Tel: ${cot.telefonoCliente}` : ''].filter(Boolean).join('   '), 62, y + 38);
      const auto = [cot.marcaAuto, cot.modeloAuto, cot.anioAuto].filter(Boolean).join(' ');
      if (auto) doc.fontSize(9).fillColor(C.gris).text(`Vehículo: ${auto}`, 62, y + 52);
      y += 82;

      // Tabla producto
      doc.rect(50, y, doc.page.width - 100, 18).fill(C.negro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
        .text('PRODUCTO', 62, y + 5).text('MEDIDA', 240, y + 5, { width: 80 })
        .text('CANT.', 320, y + 5, { width: 50, align: 'right' })
        .text('P. UNIT.', 370, y + 5, { width: 65, align: 'right' })
        .text('SUBTOTAL', 435, y + 5, { width: 65, align: 'right' });
      y += 20;

      // Una o varias llantas: usar cot.items si existe, si no el campo único
      const lineas = Array.isArray(cot.items) && cot.items.length > 0
        ? cot.items
        : [{ marca: cot.marcaLlanta, modelo: cot.modeloLlanta, medida: cot.medidaLlanta, cantidad: cot.cantidad || 1, precioUnit: parseFloat(cot.precioUnit) }];

      // ── Cotización de OPCIONES consultadas ──────────────────────────────
      // No se suman entre sí: el cliente elige una. Por cada llanta se muestra
      // el precio por llevar 1 y el total por llevar 4 (con descuento aplicado).
      if (cot.esConsulta) {
        // Reescribir la cabecera con las columnas de esta modalidad
        doc.rect(50, y - 20, doc.page.width - 100, 20).fill(C.negro);
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.amarillo)
          .text('LLANTA', 62, y - 15, { width: 150 })
          .text('MEDIDA', 212, y - 15, { width: 70 })
          .text('POR 1', 282, y - 15, { width: 68, align: 'right' })
          .text('POR 4', 350, y - 15, { width: 78, align: 'right' })
          .text('POR 4 c/TRANSF.', 428, y - 15, { width: 82, align: 'right' });

        lineas.forEach((it, idx) => {
          const bg = idx % 2 === 0 ? 'white' : C.grisClaro;
          doc.rect(50, y, doc.page.width - 100, 24).fill(bg);
          const nombreProd = [it.marca, it.modelo].filter(Boolean).join(' ') || 'Llanta';
          const pu = parseFloat(it.precioUnit || 0) || 0;
          const t4 = parseFloat(it.totalCuatro || pu * 4) || 0;
          const t4t = parseFloat(it.totalCuatroTransferencia || t4 * 0.95) || 0;
          doc.fontSize(9).font('Helvetica-Bold').fillColor(C.texto)
            .text(nombreProd, 62, y + 7, { width: 150 });
          doc.font('Helvetica')
            .text(it.medida || '—', 212, y + 7, { width: 70 })
            .text(fmt(pu), 282, y + 7, { width: 68, align: 'right' })
            .font('Helvetica-Bold').text(fmt(t4), 350, y + 7, { width: 78, align: 'right' })
            .fillColor(C.verde || '#16a34a').text(fmt(t4t), 428, y + 7, { width: 82, align: 'right' })
            .fillColor(C.texto);
          y += 26;
        });
        y += 10;

        doc.fontSize(8.5).font('Helvetica').fillColor(C.gris).text(
          'Elige la llanta que prefieras: los precios NO se suman entre sí.\n' +
          'El precio "POR 4" ya incluye el descuento por llevar el juego completo.\n' +
          'Pagando por transferencia bancaria se descuenta 5% adicional (última columna).\n' +
          'El local de instalación se coordina al momento de la compra. Precios sujetos a stock.',
          50, y, { width: doc.page.width - 100 });
        y += 52;

        y = bloqueInstalacion(doc, cot, y, C);
        if (cot.notas) {
          doc.fontSize(9).font('Helvetica-Bold').fillColor(C.amarillo).text('NOTAS:', 50, y);
          y += 14;
          doc.fontSize(9).font('Helvetica').fillColor(C.texto).text(cot.notas, 50, y, { width: doc.page.width - 100 });
        }
        const pieY0 = doc.page.height - 50;
        doc.rect(0, pieY0 - 5, doc.page.width, 2).fill(C.amarillo);
        doc.fontSize(8).font('Helvetica').fillColor(C.gris)
          .text('Cotización válida por 7 días  •  Llantaland — Tu llanta, nuestra pasión  •  www.llantaland.com', 50, pieY0 + 4, {
            align: 'center', width: doc.page.width - 100,
          });
        doc.end();
        stream.on('finish', () => resolve(filename));
        stream.on('error', reject);
        return;
      }

      lineas.forEach((it, idx) => {
        const bg = idx % 2 === 0 ? 'white' : C.grisClaro;
        doc.rect(50, y, doc.page.width - 100, 24).fill(bg);
        const nombreProd = [it.marca, it.modelo].filter(Boolean).join(' ') || 'Llanta';
        const cant = parseInt(it.cantidad || 1) || 1;
        const pu = parseFloat(it.precioUnit || 0) || 0;
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.texto)
          .text(nombreProd, 62, y + 7, { width: 175 }).text(it.medida || '—', 240, y + 7, { width: 80 });
        doc.font('Helvetica')
          .text(String(cant), 320, y + 7, { width: 50, align: 'right' })
          .text(fmt(pu), 370, y + 7, { width: 65, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(C.texto).text(fmt(pu * cant), 435, y + 7, { width: 65, align: 'right' });
        y += 26;
      });
      y += 6;

      // Descuento + Total
      if (cot.descuento && parseFloat(cot.descuento) > 0) {
        doc.fontSize(9).font('Helvetica').fillColor(C.gris)
          .text('Descuento:', 370, y, { width: 65, align: 'right' });
        doc.fillColor(C.rojo).text(`- ${fmt(cot.descuento)}`, 435, y, { width: 65, align: 'right' });
        y += 18;
      }
      doc.rect(370, y, 175, 30).fill(C.negro);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.amarillo)
        .text('TOTAL:', 375, y + 9, { width: 80 });
      doc.fontSize(14).font('Helvetica-Bold').fillColor(C.amarillo)
        .text(fmt(cot.precioTotal), 375, y + 7, { width: 165, align: 'right' });
      y += 44;

      // ── Instalación (si hay datos de cita) ──
      y = bloqueInstalacion(doc, cot, y, C);

      if (cot.notas) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.amarillo).text('NOTAS:', 50, y);
        y += 14;
        doc.fontSize(9).font('Helvetica').fillColor(C.texto).text(cot.notas, 50, y, { width: doc.page.width - 100 });
      }

      // Pie
      const pieY = doc.page.height - 50;
      doc.rect(0, pieY - 5, doc.page.width, 2).fill(C.amarillo);
      doc.fontSize(8).font('Helvetica').fillColor(C.gris)
        .text('Cotización válida por 7 días  •  Llantaland — Tu llanta, nuestra pasión  •  www.llantaland.com', 50, pieY + 4, {
          align: 'center', width: doc.page.width - 100,
        });

      doc.end();
      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (err) { reject(err); }
  });
}

module.exports = { generarVenta, generarCotizacion };
