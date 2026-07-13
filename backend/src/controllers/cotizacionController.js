const { paginar, localValido } = require('../utils/helpers');
const pdfService = require('../services/pdfService');
const prisma = require('../lib/prisma');

const listar = async (req, res, next) => {
  try {
    const { estado, leadId, tipoNegocio, page, limit } = req.query;
    const { skip, take } = paginar(page, limit);
    const isAdmin = req.usuario?.rol === 'ADMIN';
    const where = {};
    if (estado) where.estado = estado;
    if (leadId) where.leadId = leadId;
    if (tipoNegocio) where.tipoNegocio = tipoNegocio;
    // Vendedor solo ve sus propias cotizaciones
    if (!isAdmin) where.usuarioId = req.usuario.id;

    const [total, cotizaciones] = await Promise.all([
      prisma.cotizacion.count({ where }),
      prisma.cotizacion.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          usuario: { select: { nombre: true } },
          lead:    { select: { telefono: true } },
          venta:   { select: { id: true, numero: true } },
        },
      }),
    ]);
    res.json({ total, page: parseInt(page) || 1, limit: take, data: cotizaciones });
  } catch (err) { next(err); }
};

const obtener = async (req, res, next) => {
  try {
    const cot = await prisma.cotizacion.findUnique({
      where: { id: req.params.id },
      include: {
        usuario: { select: { nombre: true, email: true } },
        lead:    true,
        venta:   { select: { id: true, numero: true, estado: true } },
      },
    });
    if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(cot);
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    const {
      leadId, medidaLlanta, marcaLlanta, modeloLlanta,
      cantidad, precioUnit, descuento, cargoAdicional, notas, tipoNegocio,
      nombreCliente, dniCe, telefonoCliente, marcaAuto, modeloAuto, anioAuto,
      // Datos de cita ingresados en el CRM
      generarCita, fechaInstalacion, horaInstalacion, localInstalacion: localInstalacionBody,
      provinciaDestino: provinciaDestinoBody,
      // Múltiples llantas (opcional): [{ sku, medida, marca, modelo, cantidad, precioUnit }]
      items: itemsBody,
    } = req.body;

    // Normalizar ítems: si vienen varios, usarlos; si no, construir uno desde los campos sueltos
    let items = Array.isArray(itemsBody) && itemsBody.length > 0
      ? itemsBody.map(it => ({
          sku: it.sku || null,
          medida: it.medida || null,
          marca: it.marca || null,
          modelo: it.modelo || null,
          cantidad: parseInt(it.cantidad || 1) || 1,
          precioUnit: parseFloat(it.precioUnit || 0) || 0,
        }))
      : null;

    const primero = items ? items[0] : null;
    const qty   = primero ? primero.cantidad : parseInt(cantidad || 1);
    const pUnit = primero ? primero.precioUnit : parseFloat(precioUnit || 0);
    const desc  = descuento ? parseFloat(descuento) : 0;
    // Recargo asumido por el cliente (pago con tarjeta 4% y/o traslado entre
    // tiendas S/30) — el detalle de cuál se aplicó va en notas.
    const cargo = cargoAdicional ? parseFloat(cargoAdicional) : 0;
    const quiereCita = generarCita === true || generarCita === 'true';

    // Validaciones de integridad
    if (qty <= 0)   return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    if (pUnit < 0)  return res.status(400).json({ error: 'Precio no puede ser negativo' });
    if (pUnit === 0 && req.body.estado !== 'BORRADOR') {
      return res.status(400).json({ error: 'Precio requerido para cotización confirmada' });
    }
    if (desc < 0)   return res.status(400).json({ error: 'Descuento no puede ser negativo' });
    if (cargo < 0)  return res.status(400).json({ error: 'El cargo adicional no puede ser negativo' });

    // Subtotal: suma de todos los ítems si hay varios, o el único ítem
    const subtotal = items
      ? items.reduce((a, it) => a + it.precioUnit * it.cantidad, 0)
      : pUnit * qty;
    if (desc > subtotal) return res.status(400).json({ error: 'Descuento no puede superar el total' });

    const total = Math.max(0, subtotal - desc + cargo);

    const count  = await prisma.cotizacion.count();
    const numero = `COT-${String(count + 1).padStart(5, '0')}`;

    // Snapshot del lead si existe
    let leadData = {};
    if (leadId) {
      const lead = await prisma.leadCRM.findUnique({ where: { id: leadId } });
      if (lead) leadData = {
        telefonoCliente: lead.telefono,
        nombreCliente:   lead.nombreCliente,
        dniCe:           lead.dniCe,
        marcaAuto:       lead.marcaAuto,
        modeloAuto:      lead.modeloAuto,
        anioAuto:        lead.anioAuto,
        medidaLlanta:    medidaLlanta || lead.medidaDetectada,
        marcaLlanta:     marcaLlanta  || lead.marcaLlanta,
        modeloLlanta:    modeloLlanta || lead.modeloLlanta,
        // Datos de cita
        fechaCita:        lead.fechaCita        || null,
        localInstalacion: localValido(lead.localInstalacion || lead.localAsignado, lead.provinciaDestino),
        provinciaDestino: lead.provinciaDestino || null,
        esTraslado:       !!(lead.localOrigenTraslado),
      };
    }

    const finalNombre    = nombreCliente   || leadData.nombreCliente   || null;
    const finalDni       = dniCe           || leadData.dniCe           || null;
    const finalTelefono  = telefonoCliente || leadData.telefonoCliente || null;
    const finalMarcaAuto = marcaAuto       || leadData.marcaAuto       || null;
    const finalModeloAuto= modeloAuto      || leadData.modeloAuto      || null;
    const finalAnioAuto  = anioAuto ? parseInt(anioAuto) : (leadData.anioAuto || null);
    const finalMedida    = (primero && primero.medida) || medidaLlanta || leadData.medidaLlanta || null;
    const finalMarca     = (primero && primero.marca)  || marcaLlanta  || leadData.marcaLlanta  || null;
    const finalModelo    = (primero && primero.modelo) || modeloLlanta || leadData.modeloLlanta || null;
    const finalFechaCita        = leadData.fechaCita        || null;
    // provinciaDestino manda: si el vendedor elige provincia en el CRM (o el
    // lead ya venía de provincia), nunca se guarda un local de Lima junto con
    // ella — mismo criterio de exclusión mutua que localValido().
    const finalProvinciaDestino = provinciaDestinoBody || leadData.provinciaDestino || null;
    const finalLocalInstalacion = finalProvinciaDestino ? null : (localInstalacionBody || leadData.localInstalacion || null);
    const finalEsTraslado       = finalProvinciaDestino ? false : (leadData.esTraslado || false);
    const finalFechaInst        = quiereCita && fechaInstalacion ? new Date(fechaInstalacion) : null;
    const finalHoraInst         = quiereCita ? (horaInstalacion || null) : null;
    // Si se genera cita y se confirma destino (local en Lima, o provincia) + fecha, nace ACEPTADA
    const estadoInicial         = (quiereCita && finalFechaInst && (finalLocalInstalacion || finalProvinciaDestino)) ? 'ACEPTADA' : 'BORRADOR';
    const negocioFinal          = tipoNegocio || 'LLANTAS';

    const cot = await prisma.$transaction(async (tx) => {
      const c = await tx.cotizacion.create({
        data: {
          numero,
          tipoNegocio:     negocioFinal,
          leadId:          leadId || null,
          usuarioId:       req.usuario.id,
          nombreCliente:   finalNombre,
          dniCe:           finalDni,
          telefonoCliente: finalTelefono,
          marcaAuto:       finalMarcaAuto,
          modeloAuto:      finalModeloAuto,
          anioAuto:        finalAnioAuto,
          medidaLlanta:    finalMedida,
          marcaLlanta:     finalMarca,
          modeloLlanta:    finalModelo,
          cantidad: qty, precioUnit: pUnit,
          items:            items || undefined,
          descuento: desc > 0 ? desc : null,
          cargoAdicional: cargo > 0 ? cargo : null,
          precioTotal: total,
          fechaCita:        finalFechaCita,
          fechaInstalacion: finalFechaInst,
          horaInstalacion:  finalHoraInst,
          localInstalacion: finalLocalInstalacion,
          provinciaDestino: finalProvinciaDestino,
          esTraslado:       finalEsTraslado,
          generarCita:      quiereCita,
          notas: notas || null,
          estado: estadoInicial,
        },
        include: { usuario: { select: { nombre: true } } },
      });

      // Cuando se genera cita: asegurar un lead (WhatsApp o walk-in CRM) y marcarlo ATENDIDO
      let citaLeadId = leadId || null;
      if (quiereCita) {
        if (!citaLeadId) {
          // Walk-in: crear un lead para que la cita aparezca en el área de Citas
          const telCita = finalTelefono || `crm-${numero}`;
          const nuevoLead = await tx.leadCRM.create({
            data: {
              telefono: telCita,
              tipoNegocio: negocioFinal,
              nombreCliente: finalNombre,
              dniCe: finalDni,
              marcaAuto: finalMarcaAuto, modeloAuto: finalModeloAuto, anioAuto: finalAnioAuto,
              medidaDetectada: finalMedida, marcaLlanta: finalMarca, modeloLlanta: finalModelo,
              precioLlanta: pUnit > 0 ? pUnit : null, cantidadLlantas: qty,
              pasoActual: 'completado', origenCita: 'crm',
              provinciaDestino: finalProvinciaDestino || null,
            },
          });
          citaLeadId = nuevoLead.id;
          await tx.cotizacion.update({ where: { id: c.id }, data: { leadId: citaLeadId } });
        }
        await tx.leadCRM.update({
          where: { id: citaLeadId },
          data: {
            estadoCita: 'ATENDIDO',
            fechaInstalacion: finalFechaInst,
            horaInstalacion:  finalHoraInst,
            localInstalacion: finalLocalInstalacion || undefined,
            provinciaDestino: finalProvinciaDestino || undefined,
          },
        });
      }

      // Sincronizar datos al lead cuando la cotización viene de un lead de WhatsApp
      if (leadId) {
        const updateData = {};
        if (finalNombre)     updateData.nombreCliente   = finalNombre;
        if (finalDni)        updateData.dniCe           = finalDni;
        if (finalMarcaAuto)  updateData.marcaAuto       = finalMarcaAuto;
        if (finalModeloAuto) updateData.modeloAuto      = finalModeloAuto;
        if (finalAnioAuto)   updateData.anioAuto        = finalAnioAuto;
        if (finalMedida)     updateData.medidaDetectada = finalMedida;
        if (finalMarca)      updateData.marcaLlanta     = finalMarca;
        if (finalModelo)     updateData.modeloLlanta    = finalModelo;
        if (pUnit > 0)       updateData.precioLlanta    = pUnit;
        if (qty > 0)         updateData.cantidadLlantas = qty;
        if (Object.keys(updateData).length > 0) {
          await tx.leadCRM.update({ where: { id: leadId }, data: updateData });
        }
      }

      return c;
    });

    res.status(201).json(cot);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const { cantidad, precioUnit, descuento, items: itemsBody, ...rest } = req.body;
    const data = { ...rest };
    if (cantidad   !== undefined) data.cantidad   = parseInt(cantidad);
    if (precioUnit !== undefined) data.precioUnit = parseFloat(precioUnit);
    if (descuento  !== undefined) data.descuento  = parseFloat(descuento) || null;

    // Ítems múltiples editados: normalizar y derivar campos principales
    let items = null;
    if (Array.isArray(itemsBody)) {
      items = itemsBody
        .filter(it => it && (it.medida || it.marca))
        .map(it => ({
          sku: it.sku || null, medida: it.medida || null, marca: it.marca || null,
          modelo: it.modelo || null, cantidad: parseInt(it.cantidad || 1) || 1,
          precioUnit: parseFloat(it.precioUnit || 0) || 0,
        }));
      data.items = items;
      if (items.length > 0) {
        const p = items[0];
        data.medidaLlanta = p.medida; data.marcaLlanta = p.marca; data.modeloLlanta = p.modelo;
        data.cantidad = p.cantidad; data.precioUnit = p.precioUnit;
      }
    }

    const cot = await prisma.cotizacion.findUnique({
      where: { id: req.params.id },
      select: { cantidad: true, precioUnit: true, descuento: true, leadId: true, items: true,
                medidaLlanta: true, marcaLlanta: true, modeloLlanta: true,
                nombreCliente: true, dniCe: true, marcaAuto: true, modeloAuto: true, anioAuto: true },
    });
    if (cot) {
      const disc = data.descuento ?? (cot.descuento ? parseFloat(cot.descuento) : 0);
      // Total: suma de ítems (nuevos o existentes) o el producto único
      const itemsParaTotal = items || (Array.isArray(cot.items) ? cot.items : null);
      if (itemsParaTotal && itemsParaTotal.length > 0) {
        const sub = itemsParaTotal.reduce((a, it) => a + (parseFloat(it.precioUnit) || 0) * (parseInt(it.cantidad) || 1), 0);
        data.precioTotal = Math.max(0, sub - disc);
      } else {
        const qty   = data.cantidad   ?? cot.cantidad;
        const pUnit = data.precioUnit ?? parseFloat(cot.precioUnit);
        data.precioTotal = Math.max(0, pUnit * qty - disc);
      }
    }

    const updated = await prisma.cotizacion.update({ where: { id: req.params.id }, data });

    // Cuando se confirma/acepta una cotización vinculada a un lead: sincronizar datos
    if (cot?.leadId && (data.estado === 'ACEPTADA' || data.estado === 'ENVIADA')) {
      const syncData = {};
      const medida = data.medidaLlanta || cot.medidaLlanta;
      const marca  = data.marcaLlanta  || cot.marcaLlanta;
      const modelo = data.modeloLlanta || cot.modeloLlanta;
      const nombre = data.nombreCliente|| cot.nombreCliente;
      const dni    = data.dniCe        || cot.dniCe;
      const pUnit  = parseFloat(data.precioUnit ?? cot.precioUnit ?? 0);
      const qty    = parseInt(data.cantidad ?? cot.cantidad ?? 1);
      if (medida) syncData.medidaDetectada = medida;
      if (marca)  syncData.marcaLlanta     = marca;
      if (modelo) syncData.modeloLlanta    = modelo;
      if (nombre) syncData.nombreCliente   = nombre;
      if (dni)    syncData.dniCe           = dni;
      if (pUnit > 0) syncData.precioLlanta    = pUnit;
      if (qty > 0)   syncData.cantidadLlantas = qty;
      if (data.estado === 'ACEPTADA') syncData.ranking = 'caliente';
      if (Object.keys(syncData).length > 0) {
        await prisma.leadCRM.update({ where: { id: cot.leadId }, data: syncData });
      }
    }

    res.json(updated);
  } catch (err) { next(err); }
};

const convertirAVenta = async (req, res, next) => {
  try {
    const cot = await prisma.cotizacion.findUnique({ where: { id: req.params.id }, include: { lead: true } });
    if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (cot.venta) return res.status(400).json({ error: 'Esta cotización ya tiene una venta asociada' });

    const count  = await prisma.venta.count();
    const numero = `VTA-${String(count + 1).padStart(5, '0')}`;

    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.create({
        data: {
          numero,
          cotizacionId:    cot.id,
          leadId:          cot.leadId,
          usuarioId:       req.usuario.id,
          telefonoCliente: cot.telefonoCliente,
          nombreCliente:   cot.nombreCliente,
          dniCe:           cot.dniCe,
          marcaAuto:       cot.marcaAuto,
          modeloAuto:      cot.modeloAuto,
          anioAuto:        cot.anioAuto,
          medidaLlanta:    cot.medidaLlanta,
          marcaLlanta:     cot.marcaLlanta,
          modeloLlanta:    cot.modeloLlanta,
          cantidad:        cot.cantidad,
          precioUnit:      cot.precioUnit,
          precioTotal:     cot.precioTotal,
          itemsLlanta:     cot.items || undefined,
          // Datos de la cita (propagados desde la cotización)
          fechaCita:        cot.fechaCita        || null,
          fechaInstalacion: cot.fechaInstalacion || null,
          horaInstalacion:  cot.horaInstalacion  || null,
          localInstalacion: localValido(cot.localInstalacion, cot.provinciaDestino),
          provinciaDestino: cot.provinciaDestino || null,
          esTraslado:       cot.esTraslado       || false,
          tipoVenta:        cot.leadId ? 'whatsapp' : 'tienda',
          estado:           'PENDIENTE',
        },
      });
      await tx.cotizacion.update({ where: { id: cot.id }, data: { estado: 'CONVERTIDA' } });
      if (cot.leadId) {
        await tx.leadCRM.update({ where: { id: cot.leadId }, data: { pasoActual: 'completado' } });
      }
      return v;
    });

    res.json({ ventaId: venta.id, numero: venta.numero });
  } catch (err) { next(err); }
};

const generarPdf = async (req, res, next) => {
  try {
    const cot = await prisma.cotizacion.findUnique({
      where: { id: req.params.id },
      include: { usuario: { select: { nombre: true } } },
    });
    if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });
    const filename = await pdfService.generarCotizacion(cot);
    res.json({ pdfUrl: `/uploads/${filename}` });
  } catch (err) { next(err); }
};

module.exports = { listar, obtener, crear, actualizar, convertirAVenta, generarPdf };
