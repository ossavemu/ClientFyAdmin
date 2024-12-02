#!/bin/bash

# Nombre de la sesión de screen
SESSION_NAME="clientfy-bots"

# Obtener el directorio actual del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Asegurar que el usuario actual sea el propietario de los directorios
if [ ! -d logs ]; then
    mkdir -p logs
fi

if [ ! -d data ]; then
    mkdir -p data
fi

if [ ! -d sessions ]; then
    mkdir -p sessions
fi

# Detener servicios previos
echo "Deteniendo servicios previos..."
bash "$SCRIPT_DIR/stop-services.sh"

# Limpiar logs antiguos
rm -f logs/bot*.log

# Crear nueva sesión de screen
screen -dmS $SESSION_NAME bash -c "
    cd \"$SCRIPT_DIR\"
    
    # Función para iniciar un bot
    start_bot() {
        local instance=\$1
        echo \"Iniciando Bot \$instance...\" | tee -a logs/bot\$instance.log
        export INSTANCE_ID=\$instance
        pnpm start >> logs/bot\$instance.log 2>&1 &
        sleep 5
        
        # Verificar si el bot inició correctamente
        local port=\$((3008 + (instance - 1)))
        if curl -s \"http://localhost:\$port/health\" >/dev/null; then
            echo \"✅ Bot \$instance iniciado correctamente en puerto \$port\" | tee -a logs/bot\$instance.log
        else
            echo \"❌ Error iniciando Bot \$instance en puerto \$port\" | tee -a logs/bot\$instance.log
            echo \"Mostrando últimas líneas del log:\" | tee -a logs/bot\$instance.log
            tail -n 10 logs/bot\$instance.log | tee -a logs/bot\$instance.log
        fi
    }
    
    # Iniciar bots secuencialmente
    for i in {1..4}; do
        start_bot \$i
        sleep 5
    done
    
    # Mostrar logs en tiempo real
    tail -f logs/bot*.log
"

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"
echo ""
echo "Los QR codes estarán disponibles en:"
echo "http://localhost/bot1"
echo "http://localhost/bot2"
echo "http://localhost/bot3"
echo "http://localhost/bot4"

# Esperar a que los servicios inicien
echo "Esperando que los servicios inicien..."
sleep 20

# Verificar estado de los servicios
echo "Verificando estado de los servicios..."
for i in {1..4}; do
    port=$((3007 + i))
    if curl -s "http://localhost:$port/health" >/dev/null; then
        echo "✅ Bot $i está respondiendo en puerto $port"
    else
        echo "❌ Bot $i no responde en puerto $port"
        echo "Últimas líneas del log:"
        tail -n 10 "logs/bot$i.log"
    fi
done 