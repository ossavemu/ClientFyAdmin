#!/bin/bash

# Detener instancias previas
pkill -f "node src/app.js"
screen -wipe >/dev/null 2>&1
screen -ls | grep -q "clientfy-bots" && screen -S clientfy-bots -X quit

# Crear nueva sesión de screen
screen -dmS clientfy-bots bash -c "
    cd \"$PWD\"
    
    # Iniciar los 4 bots
    for i in {1..4}; do
        export INSTANCE_ID=\$i
        echo \"Iniciando Bot \$i...\"
        pnpm start &
        sleep 2
    done
    
    # Mantener la sesión viva
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