const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { paginar } = require('../utils/helpers');

const prisma = new PrismaClient();

const listar = async (req, res, next) => {
  try {
    const { medida, marca, tipo, sedeId, q, page, limit } = req.query;
    const { skip, take } = paginar(page, limit);
    const where = { activo: true };

    if (medida) where.medida = { contains: medida, mode: 'insensitive' };
    if (marca) where.marca = { contains: marca, mode: 'insensitive' };
    if (tipo) where.tipo = tipo;
    if (q) {
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { medida: { contains: q, mode: 'insensitive' } },
        { marca: { contains: q, mode: 'insensitive' } },
        { nombreComercial: { contains: q, mode: 'insensitive' } },
        { grupo: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, productos] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          stocks: sedeId
            ? { where: { sedeId }, include: { sede: true } }
            : { include: { sede: { orderBy: { codigoLocal: 'asc' } } } },
        },
      }),
    ]);

    res.json({ total, page: parseInt(page) || 1, limit: take, data: productos });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: req.params.id },
      include: {
        stocks: { include: { sede: { orderBy: { codigoLocal: 'asc' } } } },
      },
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const producto = await prisma.producto.create({ data: req.body });
    res.status(201).json(producto);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const producto = await prisma.producto.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(producto);
  } catch (err) {
    next(err);
  }
};

const compatibles = async (req, res, next) => {
  try {
    const { medida } = req.query;
    if (!medida) return res.status(400).json({ error: 'medida requerida' });
    const productos = await prisma.producto.findMany({
      where: { activo: true, medida: { contains: medida, mode: 'insensitive' } },
      include: { stocks: { include: { sede: true } } },
    });
    res.json(productos);
  } catch (err) {
    next(err);
  }
};

const subirImagen = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
    const url = `/uploads/${req.file.filename}`;
    const producto = await prisma.producto.update({
      where: { id: req.params.id },
      data: { imagenUrl: url },
    });
    res.status(201).json({ url, producto });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, actualizar, compatibles, subirImagen };
