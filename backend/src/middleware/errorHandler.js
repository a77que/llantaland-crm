const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Solo loguear stack en desarrollo
  if (!isProd) {
    console.error(err.stack || err.message);
  } else {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${err.code || err.status || 500} — ${err.message}`);
    if (req.path.includes('/importar')) console.error(err.stack);
  }

  // Herramientas admin de importación: exponer el detalle real para diagnóstico
  if (req.path.includes('/importar') && !err.status && !err.statusCode) {
    return res.status(500).json({ error: `Importador: ${err.message}` + (err.code ? ` [${err.code}]` : '') });
  }

  // Errores Prisma conocidos
  if (err.code === 'P2002') {
    const campo = err.meta?.target?.[0] || 'campo';
    return res.status(409).json({ error: `Ya existe un registro con ese ${campo === 'codigoLocal' ? 'código de local' : campo}` });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Referencia inválida' });
  }
  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({ error: 'Datos inválidos enviados al servidor' });
  }

  const status = err.status || err.statusCode || 500;

  // En producción no exponer mensajes internos
  const message = isProd && status === 500
    ? 'Error interno del servidor'
    : err.message || 'Error interno del servidor';

  res.status(status).json({ error: message });
};

module.exports = { errorHandler };
