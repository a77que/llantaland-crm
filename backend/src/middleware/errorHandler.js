const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err.message);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Registro duplicado', field: err.meta?.target });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';
  res.status(status).json({ error: message });
};

module.exports = { errorHandler };
