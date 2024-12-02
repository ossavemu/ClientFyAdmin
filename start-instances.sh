#!/bin/bash

# Nombre de la sesión de screen
SESSION_NAME="clientfy-bots"

# Crear directorios necesarios con sudo
sudo mkdir -p logs
sudo mkdir -p data
sudo mkdir -p sessions

# Asegurar permisos correctos con sudo
sudo chown -R $USER:$USER logs
sudo chown -R $USER:$USER data
sudo chown -R $USER:$USER sessions

# Obtener el directorio actual del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Detener servicios previos
echo "Deteniendo servicios previos..."
sudo "$SCRIPT_DIR/stop-services.sh"

# Crear nueva sesión de screen con sudo
sudo screen -dmS $SESSION_NAME bash -c "
    cd \"$SCRIPT_DIR\"
    
    # Limpiar logs antiguos con sudo
    sudo rm -f logs/bot*.log
    
    # Función para iniciar un bot
    start_bot() {
        local instance=\$1
        echo \"Iniciando Bot \$instance...\" | sudo tee -a logs/bot\$instance.log
        export INSTANCE_ID=\$instance
        sudo -E node src/app.js >> logs/bot\$instance.log 2>&1 &
        sleep 3
        
        # Verificar si el bot inició correctamente
        local port=\$((3007 + instance))
        if sudo curl -s \"http://localhost:\$port/health\" >/dev/null; then
            echo \"✅ Bot \$instance iniciado correctamente en puerto \$port\" | sudo tee -a logs/bot\$instance.log
        else
            echo \"❌ Error iniciando Bot \$instance en puerto \$port\" | sudo tee -a logs/bot\$instance.log
        fi
    }
    
    # Iniciar bots secuencialmente
    for i in {1..4}; do
        start_bot \$i
    done
    
    # Mostrar logs en tiempo real
    sudo tail -f logs/bot*.log
"

echo "Sesión iniciada en background. Para ver los logs:"
echo "sudo screen -r $SESSION_NAME"
echo ""
echo "Los QR codes estarán disponibles en:"
echo "http://4.239.88.228/bot1"
echo "http://4.239.88.228/bot2"
echo "http://4.239.88.228/bot3"
echo "http://4.239.88.228/bot4"

# Esperar a que los servicios inicien
echo "Esperando que los servicios inicien..."
sleep 15

# Verificar estado de los servicios
echo "Verificando estado de los servicios..."
for i in {1..4}; do
    port=$((3007 + i))
    if sudo curl -s "http://localhost:$port/health" >/dev/null; then
        echo "✅ Bot $i está respondiendo en puerto $port"
    else
        echo "❌ Bot $i no responde en puerto $port"
        echo "Últimas líneas del log:"
        sudo tail -n 5 "logs/bot$i.log"
    fi
done 