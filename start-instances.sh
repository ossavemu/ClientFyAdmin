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

# Verificar que los puertos estén libres
for port in {3008..3011}; do
    if check_port $port; then
        echo "ERROR: El puerto $port está en uso. Intentando liberar..."
        sudo fuser -k $port/tcp
        sleep 1
    fi
done

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
    sleep 5
    
    echo "Iniciando Bot 2..." | tee -a logs/bot2.log
    sudo -E INSTANCE_ID=2 pnpm start >> logs/bot2.log 2>&1 &
    sleep 5
    
    echo "Iniciando Bot 3..." | tee -a logs/bot3.log
    sudo -E INSTANCE_ID=3 pnpm start >> logs/bot3.log 2>&1 &
    sleep 5
    
    echo "Iniciando Bot 4..." | tee -a logs/bot4.log
    sudo -E INSTANCE_ID=4 pnpm start >> logs/bot4.log 2>&1 &

    # Esperar un momento para que los servicios inicien
    sleep 10

    # Mostrar logs en tiempo real
    tail -f logs/bot*.log
'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"
echo ""
echo "Los QR codes estarán disponibles en:"
echo "http://20.64.148.7:3008/bot1"
echo "http://20.64.148.7:3009/bot2"
echo "http://20.64.148.7:3010/bot3"
echo "http://20.64.148.7:3011/bot4"

# Verificar que los servicios están respondiendo
echo "Verificando servicios..."
sleep 15

# Verificar cada bot
for i in {1..4}; do
    port=$((3007 + i))
    if ! curl -s "http://localhost:$port/health" >/dev/null; then
        echo "ADVERTENCIA: Bot $i no responde en puerto $port"
    else
        echo "✅ Bot $i está respondiendo en puerto $port"
    fi
done

# Mostrar logs si hay errores
if ! ps aux | grep -q "[n]ode src/app.js"; then
    echo "ADVERTENCIA: No se encontraron procesos de Node.js"
    echo "Últimas líneas de los logs:"
    for i in {1..4}; do
        echo "=== Bot $i Logs ==="
        tail -n 20 "logs/bot$i.log" 2>/dev/null || echo "No hay logs para Bot $i"
    done
    echo "Verificando puertos:"
    for port in {3008..3011}; do
        echo "Puerto $port:"
        sudo netstat -tulpn | grep ":$port" || echo "Puerto $port no está en uso"
    done
fi 