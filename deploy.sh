#!/bin/bash
# deploy.sh — actualizar Llantaland CRM en el VPS
# Uso: bash deploy.sh

set -e
APP_DIR="/opt/llantaland-crm"

echo "🚀 Deploy Llantaland CRM — $(date '+%Y-%m-%d %H:%M:%S')"

cd "$APP_DIR"

echo "🔄 Bajando cambios de GitHub..."
git pull origin master

echo "🐳 Rebuildeando contenedores..."
docker-compose up --build -d --remove-orphans

echo "⏳ Esperando que arranquen los servicios..."
sleep 8

echo "📊 Estado de contenedores:"
docker ps --format "  {{.Names}}: {{.Status}}"

# Verificar API
if curl -sf http://localhost:3001/api/health > /dev/null; then
  echo "✅ API OK"
else
  echo "❌ API no responde — revisando logs..."
  docker logs llantaland_api --tail 20
fi

echo ""
echo "✅ CRM disponible en: https://crm.llantaland.com"
echo "   n8n sigue en:      http://161.97.102.3:3000"
