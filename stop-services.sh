#!/bin/bash

echo "Deteniendo todos los servicios..."

# Detener screen session
screen -S clientfy-bots -X quit 2>/dev/null

# Detener todos los procesos con kill -9
sudo pkill -9 -f "node src/app.js"
sudo pkill -9 -f "cloudflared tunnel"
sudo pkill -9 -f "uvicorn api_server:app"

# Asegurarnos que el puerto 80 esté libre
sudo fuser -k 80/tcp

# Limpiar los logs
rm -f logs/tunnel_*.log

# Esperar un momento para asegurarnos que todo se detuvo
sleep 2

# Verificar que el puerto 80 está libre
if curl -s -f http://localhost/tunnels > /dev/null 2>&1; then
    echo "ERROR: El servicio FastAPI aún está respondiendo"
    echo "Procesos que pueden estar usando el puerto 80:"
    sudo lsof -i :80
    echo "Intentando matar cualquier proceso en el puerto 80..."
    sudo netstat -tulpn | grep :80 | awk '{print $7}' | cut -d'/' -f1 | xargs -r sudo kill -9
else
    echo "✅ Todos los servicios detenidos correctamente"
fi 