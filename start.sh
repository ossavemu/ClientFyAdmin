#!/bin/bash

# Nombre para la sesión de screen
SESSION_NAME="clientfy-bot"

# Verificar si ya existe una sesión con ese nombre
if screen -list | grep -q "$SESSION_NAME"; then
    echo "Ya existe una sesión de $SESSION_NAME corriendo."
    echo "Para ver la sesión actual: screen -r $SESSION_NAME"
    echo "Para terminar la sesión actual: screen -X -S $SESSION_NAME quit"
    exit 1
fi

# Iniciar nueva sesión de screen
echo "Iniciando $SESSION_NAME en screen..."
screen -dmS $SESSION_NAME bash -c 'cd "$(dirname "$0")" && bun run src/app.js; exec bash'

echo "Sesión iniciada correctamente"
echo "Para ver los logs: screen -r $SESSION_NAME"
echo "Para desconectarte de la sesión sin cerrarla: CTRL+A seguido de D" 