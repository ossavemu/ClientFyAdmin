#!/bin/bash

# Nombre de la sesión de screen
SESSION_NAME="clientfy-bots"

# Verificar si la sesión ya existe
screen -ls | grep $SESSION_NAME > /dev/null
if [ $? -eq 0 ]; then
    echo "La sesión ya está corriendo. Deteniéndola..."
    screen -S $SESSION_NAME -X quit
fi

# Crear nueva sesión de screen
screen -dmS $SESSION_NAME bash -c '
    # Iniciar las instancias del bot
    export INSTANCE_ID=1 && pnpm start &
    export INSTANCE_ID=2 && pnpm start &
    export INSTANCE_ID=3 && pnpm start &
    export INSTANCE_ID=4 && pnpm start &

    # Esperar un momento para que las instancias inicien
    sleep 10

    # Iniciar los túneles
    ./create-tunnels.sh &

    # Mantener el script ejecutándose
    wait
'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME" 