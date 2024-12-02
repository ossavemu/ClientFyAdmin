#!/bin/bash

# Nombre de la sesión de screen
SESSION_NAME="clientfy-bots"

# Función para verificar si un puerto está en uso
check_port() {
    sudo lsof -i ":$1" >/dev/null 2>&1
    return $?
}

# Función para esperar que un puerto esté disponible
wait_for_port() {
    local port=$1
    local timeout=30
    local count=0
    
    echo "Esperando que el puerto $port esté disponible..."
    while ! curl -s "http://localhost:$port/health" >/dev/null; do
        sleep 1
        count=$((count + 1))
        if [ $count -ge $timeout ]; then
            echo "Tiempo de espera agotado esperando el puerto $port"
            return 1
        fi
    done
    echo "Puerto $port está respondiendo"
    return 0
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
    
    # Crear directorio de logs si no existe
    mkdir -p logs
    
    # Limpiar cualquier proceso previo
    sudo pkill -9 -f "node src/app.js"
    sleep 2
    
    # Iniciar las instancias del bot con sudo y logging
    echo "Iniciando Bot 1..."
    sudo INSTANCE_ID=1 pnpm start > logs/bot1.log 2>&1 &
    sleep 5
    
    echo "Iniciando Bot 2..."
    sudo INSTANCE_ID=2 pnpm start > logs/bot2.log 2>&1 &
    sleep 5
    
    echo "Iniciando Bot 3..."
    sudo INSTANCE_ID=3 pnpm start > logs/bot3.log 2>&1 &
    sleep 5
    
    echo "Iniciando Bot 4..."
    sudo INSTANCE_ID=4 pnpm start > logs/bot4.log 2>&1 &

    # Mantener el script ejecutándose y mostrar logs
    tail -f logs/bot*.log
'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"
echo ""
echo "Los QR codes estarán disponibles en:"
echo "http://20.64.148.7/bot1"
echo "http://20.64.148.7/bot2"
echo "http://20.64.148.7/bot3"
echo "http://20.64.148.7/bot4"

# Verificar que el servicio está respondiendo
echo "Verificando servicios..."
sleep 10

if ! curl -s http://localhost/health >/dev/null; then
    echo "ADVERTENCIA: El servicio no parece estar respondiendo"
    echo "Últimas líneas de los logs:"
    tail -n 20 logs/bot*.log
    echo "Verificando procesos:"
    ps aux | grep "node src/app.js"
    echo "Verificando puerto 80:"
    sudo netstat -tulpn | grep :80
    echo "Estado de los servicios:"
    sudo systemctl status nginx
fi 