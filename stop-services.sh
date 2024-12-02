#!/bin/bash

echo "Deteniendo todos los servicios..."

# Detener screen session
screen -S clientfy-bots -X quit 2>/dev/null

# Detener todos los procesos con sudo
sudo pkill -9 -f "node src/app.js"

# Asegurarnos que el puerto 80 esté libre
sudo fuser -k 80/tcp

# Esperar un momento para asegurarnos que todo se detuvo
sleep 2

# Verificar que el puerto 80 está libre
if curl -s -f http://localhost/bot1 > /dev/null 2>&1; then
    echo "ERROR: El servicio aún está respondiendo"
    echo "Procesos que pueden estar usando el puerto 80:"
    sudo lsof -i :80
    echo "Intentando matar cualquier proceso en el puerto 80..."
    sudo netstat -tulpn | grep :80 | awk '{print $7}' | cut -d'/' -f1 | xargs -r sudo kill -9
else
    echo "✅ Todos los servicios detenidos correctamente"
fi 