FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
# media/ se hornea en la imagen (a diferencia de uploads/, que es un volumen
# nombrado): un volumen ya existente conserva su contenido y no se repuebla
# desde la imagen, así que los audios deben vivir fuera de ese volumen.
COPY media ./media/

RUN mkdir -p uploads

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
