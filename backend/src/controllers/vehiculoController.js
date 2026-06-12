const vehiculoService = require('../services/vehiculoService');

// GET /api/vehiculos/placa/:placa → datos del vehículo
const placa = async (req, res, next) => {
  try {
    const r = await vehiculoService.consultarPlaca(req.params.placa);
    res.json(r);
  } catch (err) { next(err); }
};

// POST /api/vehiculos/versiones { marca, modelo, anio } → versiones con medida
const versiones = async (req, res, next) => {
  try {
    const { marca, modelo, anio } = req.body;
    const r = await vehiculoService.buscarVersiones(marca, modelo, anio);
    res.json(r);
  } catch (err) { next(err); }
};

module.exports = { placa, versiones };
