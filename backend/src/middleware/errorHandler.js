const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Solo loguear stack en desarrollo
  if (!isProd) {
    console.error(err.stack || err.message);
  } else {
    console.error(`[ERROR] ${err.code || err.status || 500} — ${err.message}`);
  }

  // Errores Prisma conocidos
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Registro duplicado', field: err.meta?.target });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Referencia inválida' });
  }

  const status = err.status || err.statusCode || 500;

  // En producción no exponer mensajes internos
  const message = isProd && status === 500
    ? 'Error interno del servidor'
    : err.message || 'Error interno del servidor';

  res.status(status).json({ error: message });
};

module.exports = { errorHandler };
