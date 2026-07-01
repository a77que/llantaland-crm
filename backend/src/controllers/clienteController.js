const { paginar } = require('../utils/helpers');
const lookupService = require('../services/lookupService');

const prisma = require('../lib/prisma');

const listar = async (req, res, next) => {
  try {
    const { q, canal, estado, page, limit } = req.query;
    const { skip, take } = paginar(page, limit);

    const where = {};
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { apellidos: { contains: q, mode: 'insensitive' } },
        { razonSocial: { contains: q, mode: 'insensitive' } },
        { numDoc: { contains: q } },
        { celular: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (canal) where.canalOrigen = canal;
    if (estado) where.crmEstado = estado;

    const [total, clientes] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { cotizaciones: true, ventas: true } } },
      }),
    ]);

    res.json({ total, page: parseInt(page) || 1, limit: take, data: clientes });
  } catch (err) {
    next(err);
  }
};

const buscar = async (req, res, next) => {
  try {
    const { doc } = req.query;
    if (!doc) return res.status(400).json({ error: 'Parámetro doc requerido' });

    const clientes = await prisma.cliente.findMany({
      where: {
        OR: [{ numDoc: doc }, { celular: doc }],
      },
      include: { vehiculos: true },
    });
    res.json(clientes);
  } catch (err) {
    next(err);
  }
};

const lookup = async (req, res, next) => {
  try {
    const { tipoDoc, numDoc } = req.body;
    if (!tipoDoc || !numDoc) {
      return res.status(400).json({ error: 'tipoDoc y numDoc requeridos' });
    }
    const resultado = await lookupService.consultar(tipoDoc, numDoc);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: req.params.id },
      include: {
        vehiculos: true,
        notas: { include: { usuario: { select: { nombre: true } } }, orderBy: { createdAt: 'desc' } },
        cotizaciones: { orderBy: { createdAt: 'desc' }, take: 10 },
        ventas: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const { vehiculos, ...data } = req.body;
    const cliente = await prisma.cliente.create({
      data: {
        ...data,
        vehiculos: vehiculos?.length ? { create: vehiculos } : undefined,
      },
      include: { vehiculos: true },
    });
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { vehiculos, ...data } = req.body;
    const cliente = await prisma.cliente.update({
      where: { id: req.params.id },
      data,
    });
    res.json(cliente);
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, buscar, lookup, obtener, crear, actualizar };
