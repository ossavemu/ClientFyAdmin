#!/bin/bash

# Nombre de la sesión de screen
SESSION_NAME="clientfy-bots"

# Verificar si la sesión ya existe
screen -ls | grep $SESSION_NAME > /dev/null
if [ $? -eq 0 ]; then
    echo "La sesión ya está corriendo. Deteniéndola..."
    screen -S $SESSION_NAME -X quit
fi

# Limpiar logs antiguos
rm -f tunnel_*.log

# Crear nueva sesión de screen
screen -dmS $SESSION_NAME bash -c '
    # Iniciar las instancias del bot
    export INSTANCE_ID=1 && pnpm start &
    export INSTANCE_ID=2 && pnpm start &
    export INSTANCE_ID=3 && pnpm start &
    export INSTANCE_ID=4 && pnpm start &

    # Esperar un momento para que las instancias inicien
    sleep 10

    # Iniciar los túneles y mostrar las URLs
    ./create-tunnels.sh

    # Para ver las URLs en cualquier momento
    echo "Para ver las URLs de los túneles ejecuta:"
    echo "grep -h \"https://\" tunnel_*.log"

    # Mantener el script ejecutándose
    wait
'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"

# Esperar un momento y mostrar las URLs
sleep 15
echo "URLs de los túneles:"
grep -h "https://" tunnel_*.log 2>/dev/null 