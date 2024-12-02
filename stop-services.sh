#!/bin/bash

echo "Deteniendo todos los servicios..."

# Detener screen session si existe
screen -ls | grep -q "clientfy-bots" && screen -S clientfy-bots -X quit

# Detener procesos de Node
sudo pkill -f "node src/app.js" || true

# Detener procesos en los puertos específicos
for port in {3008..3011} 80; do
    sudo fuser -k $port/tcp 2>/dev/null || true
done

# Esperar un momento
sleep 2

# Verificar que los puertos estén libres
echo "Verificando puertos..."
for port in {3008..3011} 80; do
    if sudo lsof -i ":$port" >/dev/null 2>&1; then
        echo "ADVERTENCIA: Puerto $port aún en uso"
    else
        echo "✅ Puerto $port libre"
    fi
done

# Verificar procesos de Node
if pgrep -f "node src/app.js" >/dev/null; then
    echo "ADVERTENCIA: Aún hay procesos Node.js ejecutándose"
    pgrep -af "node src/app.js"
else
    echo "✅ No hay procesos Node.js ejecutándose"
fi 