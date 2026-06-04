const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const EMPRESA = {
  nombre: 'LLANTALAND S.A.C.',
  ruc: process.env.SUNAT_RUC || 'RUC: 20xxxxxxxxx',
  direccion: 'Lima, Perú',
  telefono: '',
  web: 'www.llantaland.pe',
};

const COLORES = {
  primario: '#1a3c5e',
  acento: '#e63946',
  grisClaro: '#f5f5f5',
  grisOscuro: '#555555',
  texto: '#222222',
};

function formatMoney(value) {
  return `S/ ${parseFloat(value || 0).toFixed(2)}`;
}

function formatFecha(date) {
  return new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

async function generarCotizacion(cotizacion) {
  return new Promise((resolve, reject) => {
    try {
      const filename = `cotizacion-${cotizacion.numero}-${uuidv4().slice(0, 8)}.pdf`;
      const filepath = path.join(UPLOADS_DIR, filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      _dibujarHeader(doc, 'COTIZACIÓN', cotizacion.numero, cotizacion.createdAt);

      // Datos cliente
      const cliente = cotizacion.cliente;
      const nombreCliente = cliente.razonSocial || `${cliente.nombre || ''} ${cliente.apellidos || ''}`.trim();
      _dibujarDatosCliente(doc, nombreCliente, cliente);

      // Tabla de items
      _dibujarTabla(doc, cotizacion.items);

      // Totales
      _dibujarTotales(doc, cotizacion);

      // Pie
      _dibujarPie(doc);

      doc.end();
      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generarVenta(venta) {
  return new Promise((resolve, reject) => {
    try {
      const filename = `venta-${venta.numero}-${uuidv4().slice(0, 8)}.pdf`;
      const filepath = path.join(UPLOADS_DIR, filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      _dibujarHeader(doc, 'COMPROBANTE DE VENTA', venta.numero, venta.createdAt);

      const cliente = venta.cliente;
      const nombreCliente = cliente.razonSocial || `${cliente.nombre || ''} ${cliente.apellidos || ''}`.trim();
      _dibujarDatosCliente(doc, nombreCliente, cliente);

      _dibujarTabla(doc, venta.items);
      _dibujarTotales(doc, venta);
      _dibujarPie(doc);

      doc.end();
      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

function _dibujarHeader(doc, tipo, numero, fecha) {
  // Fondo header
  doc.rect(0, 0, doc.page.width, 100).fill(COLORES.primario);

  // Logo placeholder (emoji llanta)
  doc.fontSize(36).fillColor('white').text('🛞', 50, 28, { width: 60 });

  // Nombre empresa
  doc.fontSize(18).font('Helvetica-Bold').fillColor('white')
    .text(EMPRESA.nombre, 110, 28);
  doc.fontSize(9).font('Helvetica').fillColor('#ccddee')
    .text(`${EMPRESA.ruc}  •  ${EMPRESA.web}`, 110, 52);

  // Número y tipo de doc
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORES.acento)
    .text(tipo, 380, 22, { align: 'right', width: 165 });
  doc.fontSize(14).font('Helvetica-Bold').fillColor('white')
    .text(`N° ${numero}`, 380, 38, { align: 'right', width: 165 });
  doc.fontSize(9).font('Helvetica').fillColor('#ccddee')
    .text(`Fecha: ${formatFecha(fecha)}`, 380, 60, { align: 'right', width: 165 });

  doc.moveDown(5);
}

function _dibujarDatosCliente(doc, nombre, cliente) {
  const top = 115;
  doc.rect(50, top, doc.page.width - 100, 60).fill(COLORES.grisClaro);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORES.primario)
    .text('DATOS DEL CLIENTE', 60, top + 8);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.texto)
    .text(nombre || 'Sin nombre', 60, top + 22);
  doc.fontSize(9).font('Helvetica').fillColor(COLORES.grisOscuro)
    .text(`${cliente.tipoDoc || ''}: ${cliente.numDoc || ''}   |   Cel: ${cliente.celular || '-'}   |   ${cliente.email || ''}`, 60, top + 38);
  doc.y = top + 75;
}

function _dibujarTabla(doc, items) {
  const colX = [50, 60, 310, 370, 430, 490];
  const colW = [10, 250, 60, 60, 60, 65];
  const headerY = doc.y;

  // Header tabla
  doc.rect(50, headerY, doc.page.width - 100, 20).fill(COLORES.primario);
  const headers = ['#', 'Producto / Descripción', 'Medida', 'Cant.', 'P. Unit.', 'Subtotal'];
  headers.forEach((h, i) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
      .text(h, colX[i], headerY + 6, { width: colW[i], align: i >= 3 ? 'right' : 'left' });
  });

  let rowY = headerY + 22;
  items.forEach((item, idx) => {
    const bg = idx % 2 === 0 ? 'white' : COLORES.grisClaro;
    doc.rect(50, rowY, doc.page.width - 100, 22).fill(bg);

    const prod = item.producto;
    const nombreProd = prod ? `${prod.marca} ${prod.modelo || ''} ${prod.medida || ''}`.trim() : '—';
    const medida = prod?.medida || item.medidaLlanta || '—';

    doc.fontSize(8).font('Helvetica').fillColor(COLORES.texto)
      .text(String(idx + 1), colX[0], rowY + 7, { width: colW[0] })
      .text(nombreProd, colX[1], rowY + 7, { width: colW[1] })
      .text(medida, colX[2], rowY + 7, { width: colW[2] })
      .text(String(item.cantidad), colX[3], rowY + 7, { width: colW[3], align: 'right' })
      .text(formatMoney(item.precioUnit), colX[4], rowY + 7, { width: colW[4], align: 'right' })
      .text(formatMoney(item.subtotal), colX[5], rowY + 7, { width: colW[5], align: 'right' });

    rowY += 22;
  });

  doc.y = rowY + 10;
}

function _dibujarTotales(doc, doc_data) {
  const xLabel = 390;
  const xValue = 490;
  const wValue = 55;
  let y = doc.y + 5;

  const filas = [
    ['Subtotal (sin IGV):', doc_data.subtotal],
    ['IGV (18%):', doc_data.igv],
  ];

  if (doc_data.descuentoValor && parseFloat(doc_data.descuentoValor) > 0) {
    const desc = doc_data.descuentoTipo === 'PORCENTAJE'
      ? `Descuento (${doc_data.descuentoValor}%):`
      : 'Descuento:';
    const montoDesc = parseFloat(doc_data.total) - (parseFloat(doc_data.subtotal) + parseFloat(doc_data.igv));
    filas.push([desc, montoDesc]);
  }

  filas.forEach(([label, value]) => {
    doc.fontSize(9).font('Helvetica').fillColor(COLORES.grisOscuro)
      .text(label, xLabel, y, { width: 95, align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor(COLORES.texto)
      .text(formatMoney(value), xValue, y, { width: wValue, align: 'right' });
    y += 16;
  });

  // Total
  y += 4;
  doc.rect(380, y, 165, 26).fill(COLORES.primario);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white')
    .text('TOTAL:', xLabel, y + 8, { width: 95, align: 'right' });
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white')
    .text(formatMoney(doc_data.total), xValue, y + 8, { width: wValue, align: 'right' });

  if (doc_data.descuentoMotivo) {
    doc.fontSize(8).font('Helvetica-Oblique').fillColor(COLORES.grisOscuro)
      .text(`* Motivo descuento: ${doc_data.descuentoMotivo}`, 50, y + 38);
  }

  doc.y = y + 50;
}

function _dibujarPie(doc) {
  const y = doc.page.height - 60;
  doc.rect(0, y - 10, doc.page.width, 1).fill(COLORES.grisClaro);
  doc.fontSize(8).font('Helvetica').fillColor(COLORES.grisOscuro)
    .text('Gracias por su preferencia • Llantaland — Tu llanta, nuestra pasión', 50, y, {
      align: 'center', width: doc.page.width - 100,
    });
}

module.exports = { generarCotizacion, generarVenta };
