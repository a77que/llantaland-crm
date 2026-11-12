-- Retirada solicitada de Sorpréndete Perú. Ejecutar solo con respaldo verificado
-- y después de desplegar el cliente Prisma generado con el esquema exclusivo.
-- No ejecutarla desde el arranque normal del backend.
BEGIN;

CREATE TEMP TABLE llantaland_counts_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM leads_crm WHERE "tipoNegocio" = 'LLANTAS') AS leads,
  (SELECT count(*) FROM ventas WHERE "tipoNegocio" = 'LLANTAS') AS ventas,
  (SELECT count(*) FROM cotizaciones WHERE "tipoNegocio" = 'LLANTAS') AS cotizaciones;

-- La auditoría previa no encontró leads, ventas ni cotizaciones del negocio
-- retirado. Si eso cambia, abortar para revisar sus relaciones antes de borrar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM leads_crm WHERE "tipoNegocio"::text <> 'LLANTAS')
     OR EXISTS (SELECT 1 FROM ventas WHERE "tipoNegocio"::text <> 'LLANTAS')
     OR EXISTS (SELECT 1 FROM cotizaciones WHERE "tipoNegocio"::text <> 'LLANTAS') THEN
    RAISE EXCEPTION 'El inventario cambió: revisar las relaciones antes de continuar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM leads_crm WHERE "personajeId" IS NOT NULL
      OR "distritoEvento" IS NOT NULL OR "costoMovilidadAprox" IS NOT NULL
      OR "agregadosSeleccionados" IS NOT NULL OR "esProvincia" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Hay campos históricos de eventos en leads de Llantaland: revisar antes de retirar';
  END IF;
END $$;

SELECT 'personajes' AS catalogo, count(*) AS registros_a_eliminar FROM personajes_show
UNION ALL SELECT 'distritos', count(*) FROM distritos_cobertura
UNION ALL SELECT 'regalos', count(*) FROM agregados_regalo;

ALTER TABLE leads_crm
  DROP COLUMN "personajeId",
  DROP COLUMN "distritoEvento",
  DROP COLUMN "costoMovilidadAprox",
  DROP COLUMN "agregadosSeleccionados",
  DROP COLUMN "esProvincia";

DROP TABLE personajes_show;
DROP TABLE distritos_cobertura;
DROP TABLE agregados_regalo;
DROP TYPE "TipoPersonaje";
DROP TYPE "TipoAgregado";

ALTER TYPE "TipoNegocio" RENAME TO "TipoNegocio_before_llantaland_only";
CREATE TYPE "TipoNegocio" AS ENUM ('LLANTAS');
ALTER TABLE leads_crm ALTER COLUMN "tipoNegocio" DROP DEFAULT;
ALTER TABLE ventas ALTER COLUMN "tipoNegocio" DROP DEFAULT;
ALTER TABLE cotizaciones ALTER COLUMN "tipoNegocio" DROP DEFAULT;
ALTER TABLE leads_crm ALTER COLUMN "tipoNegocio" TYPE "TipoNegocio" USING "tipoNegocio"::text::"TipoNegocio";
ALTER TABLE ventas ALTER COLUMN "tipoNegocio" TYPE "TipoNegocio" USING "tipoNegocio"::text::"TipoNegocio";
ALTER TABLE cotizaciones ALTER COLUMN "tipoNegocio" TYPE "TipoNegocio" USING "tipoNegocio"::text::"TipoNegocio";
ALTER TABLE leads_crm ALTER COLUMN "tipoNegocio" SET DEFAULT 'LLANTAS';
ALTER TABLE ventas ALTER COLUMN "tipoNegocio" SET DEFAULT 'LLANTAS';
ALTER TABLE cotizaciones ALTER COLUMN "tipoNegocio" SET DEFAULT 'LLANTAS';
DROP TYPE "TipoNegocio_before_llantaland_only";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM llantaland_counts_before b
    WHERE b.leads <> (SELECT count(*) FROM leads_crm)
      OR b.ventas <> (SELECT count(*) FROM ventas)
      OR b.cotizaciones <> (SELECT count(*) FROM cotizaciones)
  ) THEN
    RAISE EXCEPTION 'Los conteos de Llantaland cambiaron; se revierte la operación';
  END IF;
END $$;

COMMIT;
