# Build stage
FROM node:21-alpine3.18 as builder

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Copiar archivos de dependencias
COPY package*.json pnpm-lock.yaml ./

# Instalar dependencias y ffmpeg
RUN apk add --no-cache --virtual .gyp \
    python3 \
    make \
    g++ \
    ffmpeg \
    && apk add --no-cache git \
    && pnpm install \
    && apk del .gyp

# Copiar código fuente y archivos de configuración
COPY . .

# Production stage
FROM node:21-alpine3.18 as production

WORKDIR /app

# Instalar pnpm y ffmpeg en la imagen de producción
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    apk add --no-cache ffmpeg
ENV PNPM_HOME=/usr/local/bin

# Copiar archivos necesarios del builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/clientfycalendar.json ./
COPY --from=builder /app/calendar-prompt.txt ./
COPY --from=builder /app/prompt.txt ./
COPY --from=builder /app/.env ./

# Configurar variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Crear usuario no root y configurar permisos
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 nodejs && \
    mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app

USER nodejs

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["pnpm", "start"]