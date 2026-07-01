const { PrismaClient } = require('@prisma/client');

// Singleton compartido — evita que cada controller/servicio abra su propio
// pool de conexiones a Postgres (antes había ~19 instancias de PrismaClient
// independientes, lo que agotaba el límite de conexiones bajo tráfico
// concurrente: importaciones de catálogo + CRM web + bot de WhatsApp a la vez).
const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
