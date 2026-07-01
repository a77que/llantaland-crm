const prisma = require('../lib/prisma');

async function verificarStockCritico(productoId, sedeId) {
  const stock = await prisma.stock.findUnique({
    where: { productoId_sedeId: { productoId, sedeId } },
  });
  if (!stock) return;

  if (stock.cantidad <= stock.stockMinimo) {
    // Evitar duplicar alertas activas
    const existente = await prisma.alertaStock.findFirst({
      where: { productoId, sedeId, resuelta: false },
    });
    if (!existente) {
      await prisma.alertaStock.create({
        data: {
          productoId,
          sedeId,
          cantidadActual: stock.cantidad,
          stockMinimo: stock.stockMinimo,
        },
      });
    }
  } else {
    // Resolver alertas previas si el stock se recuperó
    await prisma.alertaStock.updateMany({
      where: { productoId, sedeId, resuelta: false },
      data: { resuelta: true },
    });
  }
}

async function contarAlertasActivas() {
  return prisma.alertaStock.count({ where: { resuelta: false } });
}

async function contarDescuentosPendientes() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  return prisma.alertaDescuento.count({
    where: { leida: false, createdAt: { gte: hoy, lt: manana } },
  });
}

module.exports = { verificarStockCritico, contarAlertasActivas, contarDescuentosPendientes };
