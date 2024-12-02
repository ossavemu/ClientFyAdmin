#!/bin/bash

# Crear directorio de logs
mkdir -p logs

# Detener instancias previas
pkill -f "node src/app.js"
screen -wipe >/dev/null 2>&1
screen -ls | grep -q "clientfy-bots" && screen -S clientfy-bots -X quit

# Iniciar nueva sesión de screen con logging
screen -L -S clientfy-bots -dm bash -c "
    cd \"$PWD\"
    
    # Iniciar los 4 bots
    for i in {1..4}; do
        export INSTANCE_ID=\$i
        echo \"Iniciando Bot \$i...\"
        pnpm start > logs/bot\$i.log 2>&1 &
        sleep 2
    done
    
    # Mantener la sesión viva
    echo 'Presiona Ctrl+A D para desconectar sin cerrar la sesión'
    tail -f logs/bot*.log
"

echo "Bots iniciados en puertos 3008-3011"
echo "Para ver los logs: screen -r clientfy-bots"
echo ""
echo "QR codes disponibles en:"
echo "Bot 1: http://localhost:3008/qr"
echo "Bot 2: http://localhost:3009/qr"
echo "Bot 3: http://localhost:3010/qr"
echo "Bot 4: http://localhost:3011/qr"

# Verificar que la sesión existe
if ! screen -ls | grep -q "clientfy-bots"; then
    echo "Error: La sesión de screen no se creó correctamente"
    exit 1
fi 