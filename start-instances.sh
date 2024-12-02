#!/bin/bash

# Nombre de la sesión de screen
SESSION_NAME="clientfy-bots"

# Crear directorios necesarios
mkdir -p logs
mkdir -p data

# Asegurar permisos correctos
sudo chown -R $USER:$USER logs
sudo chown -R $USER:$USER data

# Función para verificar si un puerto está en uso
check_port() {
    sudo lsof -i ":$1" >/dev/null 2>&1
    return $?
}

# Detener servicios previos
echo "Deteniendo servicios previos..."
sudo ./stop-services.sh

# Verificar que el puerto 80 esté libre
if check_port 80; then
    echo "ERROR: El puerto 80 está en uso. Intentando liberar..."
    sudo fuser -k 80/tcp
    sleep 2
fi

# Crear nueva sesión de screen con sudo y logging
screen -dmS $SESSION_NAME bash -c '
    cd "$(dirname "$0")"
    
    # Limpiar cualquier proceso previo
    sudo pkill -9 -f "node src/app.js"
    sleep 2
    
    # Limpiar logs antiguos
    rm -f logs/bot*.log
    
    # Iniciar las instancias del bot con sudo y logging
    echo "Iniciando Bot 1..." | tee -a logs/bot1.log
    sudo -E INSTANCE_ID=1 pnpm start >> logs/bot1.log 2>&1 &
    sleep 2
    
    echo "Iniciando Bot 2..." | tee -a logs/bot2.log
    sudo -E INSTANCE_ID=2 pnpm start >> logs/bot2.log 2>&1 &
    sleep 2
    
    echo "Iniciando Bot 3..." | tee -a logs/bot3.log
    sudo -E INSTANCE_ID=3 pnpm start >> logs/bot3.log 2>&1 &
    sleep 2
    
    echo "Iniciando Bot 4..." | tee -a logs/bot4.log
    sudo -E INSTANCE_ID=4 pnpm start >> logs/bot4.log 2>&1 &

    # Esperar un momento para que los servicios inicien
    sleep 4

    # Mostrar logs en tiempo real
    tail -f logs/bot*.log
'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"
echo ""
echo "Los QR codes estarán disponibles en:"
echo "http://4.239.88.228/bot1"
echo "http://4.239.88.228/bot2"
echo "http://4.239.88.228/bot3"
echo "http://4.239.88.228/bot4"

# Verificar que los servicios están respondiendo
echo "Verificando servicios..."
sleep 10

# Verificar cada bot
for i in {1..4}; do
    port=$((3007 + i))
    if ! curl -s "http://localhost:$port/health" >/dev/null; then
        echo "ADVERTENCIA: Bot $i no responde en puerto $port"
    else
        echo "✅ Bot $i está respondiendo en puerto $port"
    fi
done

# Verificar el proxy
if ! curl -s "http://localhost/bot1/health" >/dev/null; then
    echo "ADVERTENCIA: El proxy no está respondiendo"
    echo "Verificando puerto 80:"
    sudo netstat -tulpn | grep :80 || echo "Puerto 80 no está en uso"
fi 