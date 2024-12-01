#!/bin/bash

SESSION_NAME="clientfy-bots"

# Crear directorio para logs si no existe
mkdir -p logs

# Limpiar logs antiguos
rm -f logs/tunnel_*.log

# Verificar si la sesión ya existe y terminarla
screen -ls | grep $SESSION_NAME > /dev/null
if [ $? -eq 0 ]; then
    echo "La sesión ya está corriendo. Deteniéndola..."
    screen -S $SESSION_NAME -X quit
    sleep 2
fi

# Crear el script temporal que se ejecutará dentro de screen
cat > logs/tunnel_script.sh << 'EOF'
#!/bin/bash

# Función para crear túnel con Cloudflare
create_cloudflare_tunnel() {
    local port=$1
    local log_file="logs/tunnel_${port}.log"
    
    echo "Intentando crear túnel Cloudflare para puerto $port..."
    cloudflared tunnel --url "http://localhost:${port}" > "$log_file" 2>&1 &
    local cloudflared_pid=$!
    
    # Esperar hasta 10 segundos por la URL de Cloudflare
    local counter=0
    while [ $counter -lt 10 ]; do
        if grep -q "https://.*trycloudflare.com" "$log_file" 2>/dev/null; then
            local url=$(grep -o "https://.*trycloudflare.com" "$log_file" | head -n 1)
            echo "SUCCESS:$url:$cloudflared_pid"
            return 0
        fi
        sleep 1
        counter=$((counter + 1))
    done
    
    # Si falló, matar el proceso de cloudflared
    kill $cloudflared_pid 2>/dev/null
    echo "FAIL"
    return 1
}

# Función para crear túnel con Localtunnel
create_localtunnel() {
    local port=$1
    local log_file="logs/tunnel_${port}.log"
    
    echo "Creando túnel Localtunnel para puerto $port..."
    npx localtunnel --port $port > "$log_file" 2>&1 &
    local lt_pid=$!
    
    # Esperar hasta 10 segundos por la URL de Localtunnel
    local counter=0
    while [ $counter -lt 10 ]; do
        if grep -q "https://.*\.loca.lt" "$log_file" 2>/dev/null; then
            local url=$(grep -o "https://.*\.loca.lt" "$log_file" | head -n 1)
            echo "SUCCESS:$url:$lt_pid"
            return 0
        fi
        sleep 1
        counter=$((counter + 1))
    done
    
    # Si falló, matar el proceso de localtunnel
    kill $lt_pid 2>/dev/null
    return 1
}

# Array para guardar los PIDs de los túneles
declare -a TUNNEL_PIDS=()

# Función para limpiar los túneles al salir
cleanup() {
    echo "Limpiando túneles..."
    for pid in "${TUNNEL_PIDS[@]}"; do
        kill $pid 2>/dev/null
    done
    exit 0
}

# Registrar la función de limpieza
trap cleanup EXIT

# Iniciar las instancias del bot
for i in {1..4}; do
    export INSTANCE_ID=$i
    PORT=$((3007 + i))
    echo "Iniciando instancia $i en puerto $PORT"
    node src/app.js &
    sleep 2
    
    # Alternar entre Cloudflare y Localtunnel
    if [ $((i % 2)) -eq 0 ]; then
        echo "Usando Cloudflare para instancia $i"
        TUNNEL_RESULT=$(create_cloudflare_tunnel $PORT)
        
        if [[ $TUNNEL_RESULT == SUCCESS* ]]; then
            URL=$(echo $TUNNEL_RESULT | cut -d':' -f2)
            PID=$(echo $TUNNEL_RESULT | cut -d':' -f3)
            TUNNEL_PIDS+=($PID)
            echo "Puerto $PORT -> $URL (Cloudflare)"
        else
            echo "Error: No se pudo crear túnel Cloudflare para puerto $PORT"
        fi
    else
        echo "Usando Localtunnel para instancia $i"
        TUNNEL_RESULT=$(create_localtunnel $PORT)
        
        if [[ $TUNNEL_RESULT == SUCCESS* ]]; then
            URL=$(echo $TUNNEL_RESULT | cut -d':' -f2)
            PID=$(echo $TUNNEL_RESULT | cut -d':' -f3)
            TUNNEL_PIDS+=($PID)
            echo "Puerto $PORT -> $URL (Localtunnel)"
        else
            echo "Error: No se pudo crear túnel Localtunnel para puerto $PORT"
        fi
    fi
done

# Mantener el script ejecutándose
wait
EOF

# Hacer ejecutable el script temporal
chmod +x logs/tunnel_script.sh

# Crear nueva sesión de screen con el script temporal
screen -dmS $SESSION_NAME bash -c 'cd "$(pwd)" && ./logs/tunnel_script.sh'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"

# Esperar y mostrar URLs
sleep 15
echo "URLs de los túneles:"
cat logs/tunnel_*.log | grep -E "https://.*?(trycloudflare.com|loca.lt)" 2>/dev/null || echo "Esperando URLs..."

# Mostrar logs en tiempo real
echo "Mostrando logs en tiempo real (Ctrl+C para salir):"
tail -f logs/tunnel_*.log | grep -E "https://.*?(trycloudflare.com|loca.lt)"