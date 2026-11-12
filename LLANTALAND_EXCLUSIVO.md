# CRM exclusivo de Llantaland

Aplicado el 12 de noviembre de 2026, por solicitud del usuario. Sustituye la separación LLANTAS/PATRON descrita en los documentos históricos.

- Retirados el selector de negocio, la marca de Sorpréndete Perú, su pantalla de personajes y agregados, sus notificaciones, cliente API, rutas, controladores y seed.
- Listados, resumen y accesos directos a leads, citas, cotizaciones y ventas quedan limitados a LLANTAS. Las nuevas ventas y cotizaciones se crean para LLANTAS. La persistencia de autenticación descarta la selección antigua de negocio sin perder la sesión.
- Retirados del esquema Prisma los modelos PersonajeShow, DistritoCobertura y AgregadoRegalo; sus enums; cinco columnas de eventos en LeadCRM y su relación. TipoNegocio solo admite LLANTAS.
- El usuario confirmó expresamente el borrado definitivo de los registros ajenos. La auditoría no encontró leads, ventas ni cotizaciones de PATRON. Se retiraron tres tablas con 16 registros de catálogo: 3 personajes, 10 distritos y 3 regalos. La operación también retiró columnas y tipos exclusivos.
- La limpieza se ejecutó en una transacción mediante `backend/prisma/remove-unrelated-business.sql`, con comprobaciones previas y comparación de conteos antes de confirmar. Este archivo es un registro de la operación; no es idempotente ni se ejecuta al arrancar.

## Resultado comprobado en producción

- Frontend: imagen `llantaland-frontend:only-20261112`, servicio 1/1.
- API: imagen `llantaland-api:only-clean-schema-20261112`, servicio 1/1. Cliente Prisma regenerado antes de retirar la estructura SQL. El despliegue utilizado arranca Node directamente, sin db push ni migraciones automáticas.
- CRM y /api/health: HTTP 200; apertura Socket.IO: 200; antigua ruta /api/patron/personajes: 404.
- Bundle publicado: `/assets/index-Cbn0eLgZ.js`, sin la marca o rutas del negocio retirado.
- Consulta Prisma real posterior a la limpieza: correcta. Se conservaron **45 leads, 40 ventas y 13 cotizaciones** de Llantaland. Las tres tablas retiradas ya no existen.
- Compilación frontend correcta (aviso previo por bundle superior a 500 kB); sintaxis backend correcta; esquema Prisma validado; ocho comprobaciones con dobles de base de datos sobre aislamiento de consultas y vínculos de cotizaciones correctas.

## Respaldo y mantenimiento

Directorio privado del VPS: `/opt/llantaland-releases/only-20261112`. Contiene especificaciones anteriores de servicios, paquetes de despliegue, respaldo de uploads y `before-removal-sorprendete.dump`. Se comprobó que pg_restore puede leer el índice del respaldo; no se realizó una restauración de prueba. No se descargó la base de datos al PC ni se copiaron credenciales al repositorio.

Las imágenes anteriores se conservaron como `llantaland-api:before-only-20261112` y `llantaland-frontend:before-only-20261112`. Tras retirar columnas, una vuelta al backend antiguo requiere restaurar también el esquema compatible; no basta con cambiar la imagen.

El despliegue inicial se realizó por SSH. El usuario solicitó después sincronizar el código con GitHub y desplegarlo desde el repositorio mediante Easypanel. La revisión publicada puede consultarse en la rama master y en los metadatos de despliegue de Easypanel. No se modificaron otros proyectos del PC ni los workflows de n8n.
