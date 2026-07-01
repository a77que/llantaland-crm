const prisma = require('../lib/prisma');

const getConfig = async (req, res, next) => {
  try {
    const config = await prisma.configSunat.findFirst();
    res.json(config || {});
  } catch (err) {
    next(err);
  }
};

const saveConfig = async (req, res, next) => {
  try {
    const existing = await prisma.configSunat.findFirst();
    const config = existing
      ? await prisma.configSunat.update({ where: { id: existing.id }, data: req.body })
      : await prisma.configSunat.create({ data: req.body });
    res.json(config);
  } catch (err) {
    next(err);
  }
};

const emitir = async (req, res) => {
  // Módulo en construcción — estructura lista para conectar PSE
  res.json({
    status: 'pendiente',
    mensaje: 'Módulo de facturación en configuración. Configure el PSE en /config/apis para habilitar la emisión.',
  });
};

const listarComprobantes = async (req, res, next) => {
  try {
    const { ventaId, tipo, estado, page, limit } = req.query;
    const { paginar } = require('../utils/helpers');
    const { skip, take } = paginar(page, limit);
    const where = {};
    if (ventaId) where.ventaId = ventaId;
    if (tipo) where.tipo = tipo;
    if (estado) where.estado = estado;

    const [total, comprobantes] = await Promise.all([
      prisma.comprobante.count({ where }),
      prisma.comprobante.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { venta: { select: { numero: true, total: true } } },
      }),
    ]);
    res.json({ total, data: comprobantes });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConfig, saveConfig, emitir, listarComprobantes };
