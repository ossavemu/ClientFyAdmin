#!/bin/bash

echo "Deteniendo bots..."

# Detener screen y procesos
screen -ls | grep -q "clientfy-bots" && screen -S clientfy-bots -X quit
pkill -f "node src/app.js"

# Verificar puertos
for port in {3008..3011}; do
    fuser -k $port/tcp 2>/dev/null || true
done

echo "Bots detenidos" 