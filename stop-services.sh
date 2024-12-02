#!/bin/bash

echo "Deteniendo todos los servicios..."

# Detener screen session
screen -S clientfy-bots -X quit 2>/dev/null

# Detener todos los procesos con sudo
sudo pkill -9 -f "node src/app.js"

# Asegurarnos que los puertos estén libres
for port in {3008..3011}; do
    sudo fuser -k $port/tcp 2>/dev/null
done

# Esperar un momento para asegurarnos que todo se detuvo
sleep 2

# Verificar que los puertos estén libres
for port in {3008..3011}; do
    if sudo lsof -i ":$port" >/dev/null 2>&1; then
        echo "ERROR: El puerto $port aún está en uso"
        echo "Procesos usando el puerto $port:"
        sudo lsof -i ":$port"
    fi
done

# Verificar que no hay procesos de node
if ps aux | grep -q "[n]ode src/app.js"; then
    echo "ERROR: Aún hay procesos de Node.js ejecutándose"
    ps aux | grep "[n]ode src/app.js"
else
    echo "✅ Todos los servicios detenidos correctamente"
fi 