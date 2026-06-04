#!/bin/bash
# deploy.sh — script de deploy en el VPS
# Ejecutar: bash deploy.sh

set -e

APP_DIR="/opt/llantaland-crm"
REPO_URL="https://github.com/TU_USUARIO/llantaland-crm.git"  # <-- cambia esto

echo "🚀 Iniciando deploy Llantaland CRM..."
echo "📅 $(date '+%Y-%m-%d %H:%M:%S')"

# Si el directorio no existe, clonar; si existe, hacer pull
if [ ! -d "$APP_DIR" ]; then
  echo "📦 Clonando repositorio..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
else
  echo "🔄 Actualizando código..."
  cd "$APP_DIR"
  git pull origin main
fi

# Verificar que existe el .env
if [ ! -f ".env" ]; then
  echo "⚠️  ATENCIÓN: No existe el archivo .env"
  echo "   Copia el .env.example y configura tus variables:"
  echo "   cp backend/.env.example .env && nano .env"
  exit 1
fi

# Rebuild y restart de contenedores
echo "🐳 Rebuildeando contenedores Docker..."
docker-compose down --remove-orphans
docker-compose up --build -d

# Esperar que el backend esté listo
echo "⏳ Esperando que el backend arranque..."
sleep 10

# Verificar salud
echo "🔍 Verificando estado..."
docker ps --format "  {{.Names}}: {{.Status}}"

# Verificar que la API responda
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
  echo "✅ API respondiendo correctamente"
else
  echo "❌ La API no responde — revisa los logs:"
  echo "   docker logs llantaland_api --tail 30"
fi

echo ""
echo "✅ Deploy completado — CRM disponible en http://$(hostname -I | awk '{print $1}')"
