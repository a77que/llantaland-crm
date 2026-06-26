-- Migración segura: tipo enum TipoProducto → TEXT, preservando valores.
-- Idempotente: solo actúa si la columna sigue siendo enum. Se ejecuta antes de prisma db push
-- (db push solo no puede castear enum→text y descartaría los datos con --accept-data-loss).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos' AND column_name = 'tipo' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE "productos" ALTER COLUMN "tipo" DROP DEFAULT;
    ALTER TABLE "productos" ALTER COLUMN "tipo" TYPE TEXT USING "tipo"::text;
    ALTER TABLE "productos" ALTER COLUMN "tipo" SET DEFAULT 'AUTO';
    DROP TYPE IF EXISTS "TipoProducto";
  END IF;
END $$;

-- Consolidación: la columna "tipo" se elimina y su información pasa a "tipoVehiculo".
-- Se copia ANTES de que prisma db push elimine la columna "tipo" (idempotente).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "tipoVehiculo" TEXT;
    UPDATE "productos"
       SET "tipoVehiculo" = "tipo"
     WHERE ("tipoVehiculo" IS NULL OR "tipoVehiculo" = '')
       AND "tipo" IS NOT NULL AND "tipo" <> '';
  END IF;
END $$;
