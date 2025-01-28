#!/bin/bash

# Nombre de la sesión de screen
SESSION_NAME="clientfy-bot"

# Verificar si existe la sesión
if ! screen -list | grep -q "$SESSION_NAME"; then
    echo "No se encontró ninguna sesión de $SESSION_NAME corriendo."
    exit 1
fi

# Detener la sesión
echo "Deteniendo sesión de $SESSION_NAME..."
screen -X -S $SESSION_NAME quit

# Verificar si se detuvo correctamente
if ! screen -list | grep -q "$SESSION_NAME"; then
    echo "Sesión detenida exitosamente."
else
    echo "Error al detener la sesión. Por favor, verifica manualmente con: screen -ls"
fi 