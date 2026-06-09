FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
COPY media ./media/
# Copia los audios también dentro de src/assets/ — esa ruta NUNCA es un
# volumen Docker/EasyPanel, así que los archivos siempre están disponibles.
RUN mkdir -p /app/src/assets/audios && cp -r /app/media/audios/. /app/src/assets/audios/

RUN mkdir -p uploads

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && mkdir -p /app/uploads/audios && cp -rn /app/media/audios/. /app/uploads/audios/ && node src/index.js"]
