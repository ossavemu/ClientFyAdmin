#!/bin/bash

# Nombre de la sesión de screen
SESSION_NAME="clientfy-bots"

# Verificar si la sesión ya existe y terminarla
screen -ls | grep $SESSION_NAME > /dev/null
if [ $? -eq 0 ]; then
    echo "La sesión ya está corriendo. Deteniéndola..."
    screen -S $SESSION_NAME -X quit
    sleep 2
fi

# Crear nueva sesión de screen
screen -dmS $SESSION_NAME bash -c '
    cd "$(dirname "$0")"
    
    # Iniciar las instancias del bot
    export INSTANCE_ID=1 && pnpm start &
    export INSTANCE_ID=2 && pnpm start &
    export INSTANCE_ID=3 && pnpm start &
    export INSTANCE_ID=4 && pnpm start &

    # Mantener el script ejecutándose
    wait
'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"
echo ""
echo "Los QR codes estarán disponibles en:"
echo "http://localhost/bot1"
echo "http://localhost/bot2"
echo "http://localhost/bot3"
echo "http://localhost/bot4" 