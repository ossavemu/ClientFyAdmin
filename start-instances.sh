#!/bin/bash

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