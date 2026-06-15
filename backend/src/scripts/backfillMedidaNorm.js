/**
 * Backfill de medidaNorm (clave canónica de búsqueda) para todos los productos.
 * Idempotente: se puede correr varias veces. Recalcula SIEMPRE desde `medida`.
 *
 * Uso en el contenedor (terminal Easypanel):
 *   cd /app && node src/scripts/backfillMedidaNorm.js
 */
const { PrismaClient } = require('@prisma/client');
const { normalizarMedida } = require('../utils/medida');

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.producto.count();
  console.log(`Productos a procesar: ${total}`);

  const LOTE = 500;
  let procesados = 0, actualizados = 0;

  for (let skip = 0; skip < total; skip += LOTE) {
    const productos = await prisma.producto.findMany({
      skip, take: LOTE,
      select: { id: true, medida: true, medidaNorm: true },
      orderBy: { id: 'asc' },
    });

    await Promise.all(productos.map(async (p) => {
      const norm = normalizarMedida(p.medida);
      procesados++;
      if (norm !== p.medidaNorm) {
        await prisma.producto.update({ where: { id: p.id }, data: { medidaNorm: norm } });
        actualizados++;
      }
    }));

    console.log(`  ${Math.min(skip + LOTE, total)}/${total}…`);
  }

  console.log(`✅ Listo. Procesados: ${procesados} | Actualizados: ${actualizados}`);
}

main()
  .catch((e) => { console.error('Error en backfill:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
