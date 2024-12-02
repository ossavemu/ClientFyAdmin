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

# Crear nueva sesión de screen con sudo
screen -dmS $SESSION_NAME bash -c '
    cd "$(dirname "$0")"
    
    # Iniciar las instancias del bot con sudo
    sudo INSTANCE_ID=1 pnpm start &
    sudo INSTANCE_ID=2 pnpm start &
    sudo INSTANCE_ID=3 pnpm start &
    sudo INSTANCE_ID=4 pnpm start &

    # Mantener el script ejecutándose
    wait
'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"
echo ""
echo "Los QR codes estarán disponibles en:"
echo "http://20.64.148.7/bot1"
echo "http://20.64.148.7/bot2"
echo "http://20.64.148.7/bot3"
echo "http://20.64.148.7/bot4" 