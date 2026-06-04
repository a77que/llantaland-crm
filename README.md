# Llantaland CRM

Sistema CRM completo para Llantaland — gestión de clientes, inventario de llantas, cotizaciones, ventas, integración con n8n/WhatsApp y facturación SUNAT.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Zustand + React Query |
| Backend | Node.js 20 + Express + Prisma ORM |
| Base de datos | PostgreSQL 16 |
| Auth | JWT (8h) |
| PDF | PDFKit |
| Excel/CSV | SheetJS (xlsx) |
| Contenedores | Docker + docker-compose |

---

## Instalación local (desarrollo)

### Prerrequisitos
- Node.js 20+
- PostgreSQL 16 (local o Docker)
- npm

### 1. Clonar y configurar variables de entorno

```bash
cd llantaland-crm/backend
cp .env.example .env
# Edita .env con tus credenciales
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 3. Ejecutar migraciones de base de datos

```bash
# Asegúrate que PostgreSQL esté corriendo y DATABASE_URL en .env es correcto
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Cargar datos iniciales (seed)

```bash
npm run seed
```

Esto crea:
- Admin: `admin@llantaland.pe` / `Llantaland2024!`
- Vendedor: `vendedor@llantaland.pe` / `Vendedor2024!`
- 2 sedes y 4 productos de ejemplo

### 5. Iniciar el backend

```bash
npm run dev
# API disponible en http://localhost:3001
```

### 6. Instalar dependencias del frontend

```bash
cd ../frontend
npm install
```

### 7. Iniciar el frontend

```bash
npm run dev
# App disponible en http://localhost:5173
```

---

## Con Docker (recomendado para producción)

### Desarrollo con docker-compose

```bash
# En la raíz del proyecto
docker-compose up -d

# Ver logs
docker-compose logs -f backend

# Ejecutar seed
docker-compose exec backend node src/scripts/seed.js
```

### Build para producción

```bash
docker-compose build
docker-compose up -d
```

---

## Variables de entorno (.env)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://user:pass@localhost:5432/llantaland_crm` |
| `JWT_SECRET` | Secreto para firmar tokens JWT | Mínimo 32 caracteres aleatorios |
| `JWT_EXPIRES_IN` | Expiración del token | `8h` |
| `PORT` | Puerto del backend | `3001` |
| `FRONTEND_URL` | URL del frontend (CORS) | `https://crm.llantaland.pe` |
| `N8N_API_KEY` | API Key para los webhooks de n8n | Cualquier string seguro |
| `N8N_WEBHOOK_URL` | URL base del servidor n8n | |
| `API_DNI_URL` | URL de la API de consulta DNI | `https://api.ejemplo.com/dni/{numero}` |
| `API_DNI_KEY` | API Key de la API DNI | |
| `API_RUC_URL` | URL de la API de consulta RUC | |
| `API_RUC_KEY` | API Key de la API RUC | |
| `API_CE_URL` | URL de la API de Carnet Extranjería | |
| `API_CE_KEY` | API Key | |
| `GOOGLE_SHEETS_ID` | ID del Google Sheet para migración | |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON de la cuenta de servicio Google | |

---

## Migración desde Google Sheets

Si actualmente usas Google Sheets para stock/clientes:

1. Crea una cuenta de servicio en Google Cloud Console
2. Comparte tu Google Sheet con el email de la cuenta de servicio
3. Descarga el JSON de credenciales y ponlo en `GOOGLE_SERVICE_ACCOUNT_KEY` (como string JSON en una línea)
4. Configura `GOOGLE_SHEETS_ID` con el ID de tu hoja

```bash
node src/scripts/migrarSheets.js
```

El script espera estas hojas:
- **Stock**: columnas `sku`, `medida`, `marca`, `modelo`, `precio`, `stock`
- **Clientes**: columnas `nombre`, `celular`, `dni`

El script **no elimina datos en Sheets**, solo los copia al CRM.

---

## API para n8n

Los endpoints `/api/n8n/*` usan autenticación por `X-N8N-API-KEY` header.

### Flujo WhatsApp → CRM

```
1. Bot recopila: nombre, celular, medida, marca, modelo, cantidad
2. n8n → POST /api/n8n/cliente  → retorna clienteId
3. n8n → GET  /api/n8n/stock?medida=265/70R17  → stock disponible
4. n8n → POST /api/n8n/cotizacion  → crea cotización BORRADOR
5. Vendedor completa y envía la cotización desde el CRM
```

### Ejemplo: crear/actualizar cliente desde n8n

```json
POST /api/n8n/cliente
Headers: X-N8N-API-KEY: tu_api_key

{
  "telefono": "999888777",
  "nombre": "Juan García",
  "medida": "265/70R17",
  "marca": "Toyota",
  "cantidad": 4
}
```

Respuesta:
```json
{ "clienteId": "cuid...", "esNuevo": true }
```

---

## Deploy en EasyPanel

### Backend (api.llantaland.pe)

1. Crear app en EasyPanel → tipo **Dockerfile**
2. Repositorio git o subir imagen
3. Variables de entorno: copiar de `.env.example` y completar
4. Puerto: `3001`
5. Dominio: `api.llantaland.pe`

### Frontend (crm.llantaland.pe)

1. Crear app en EasyPanel → tipo **Dockerfile**
2. Puerto: `80`
3. Dominio: `crm.llantaland.pe`

### PostgreSQL

1. Crear servicio PostgreSQL en EasyPanel
2. Usar la URL interna en `DATABASE_URL` del backend

---

## Estructura del proyecto

```
llantaland-crm/
├── backend/
│   ├── prisma/schema.prisma     ← Schema completo de BD
│   ├── src/
│   │   ├── config/apiMapping.js ← Mapeo de APIs DNI/RUC/CE
│   │   ├── controllers/         ← Lógica de negocio
│   │   ├── middleware/          ← Auth JWT + n8n API Key
│   │   ├── routes/              ← Definición de endpoints
│   │   ├── services/            ← PDF, lookup, stock alerts
│   │   ├── scripts/
│   │   │   ├── seed.js          ← Datos iniciales
│   │   │   └── migrarSheets.js  ← Migración desde Google Sheets
│   │   └── utils/helpers.js     ← Cálculo totales, paginación
│   └── uploads/                 ← Imágenes de productos
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── DocLookup/       ← Autocompletado DNI/RUC/CE
│       │   ├── FichaLlanta/     ← Ficha técnica de llanta
│       │   ├── ImportadorStock/ ← Importador Excel con mapeador
│       │   └── Layout/          ← Sidebar + Topbar + Layout
│       ├── pages/               ← 17 páginas del CRM
│       ├── services/api.js      ← Cliente HTTP (Axios)
│       └── store/authStore.js   ← Estado de autenticación
└── docker-compose.yml
```

---

## Módulo SUNAT (en construcción)

La estructura está completa (BD, endpoints, UI). Para habilitarlo:

1. Ir a `/facturacion` en el CRM
2. Ingresar RUC y razón social de la empresa
3. Seleccionar PSE: **Nubefact**, **ApiSunat** o **Greenter**
4. Ingresar API Key y URL del PSE
5. Guardar → a partir de ahí `POST /api/sunat/emitir/:ventaId` conectará con el PSE real

---

## Comandos útiles

```bash
# Regenerar cliente Prisma tras cambiar schema
cd backend && npx prisma generate

# Ver BD con Prisma Studio
cd backend && npx prisma studio

# Nueva migración
cd backend && npx prisma migrate dev --name nombre_cambio

# Migrar en producción
cd backend && npx prisma migrate deploy

# Ver logs de contenedor
docker-compose logs -f backend
docker-compose logs -f frontend

# Entrar a la BD
docker-compose exec postgres psql -U llantaland -d llantaland_crm
```
