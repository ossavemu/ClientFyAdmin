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
    
    # Esperar hasta 40 segundos por la URL de Cloudflare
    local counter=0
    while [ $counter -lt 40 ]; do
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
    
    echo "Creando túnel para instancia $i (puerto $PORT)"
    TUNNEL_RESULT=$(create_cloudflare_tunnel $PORT)
    
    if [[ $TUNNEL_RESULT == SUCCESS* ]]; then
        URL=$(echo $TUNNEL_RESULT | cut -d':' -f2)
        PID=$(echo $TUNNEL_RESULT | cut -d':' -f3)
        TUNNEL_PIDS+=($PID)
        echo "Puerto $PORT -> $URL (Cloudflare)"
    else
        echo "Error: No se pudo crear túnel para puerto $PORT"
    fi
    
    # Esperar 40 segundos entre cada túnel
    echo "Esperando 40 segundos antes de crear el siguiente túnel..."
    sleep 40
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

# Esperar y mostrar URLs (esperamos más tiempo ya que ahora hay más delays)
sleep 180
echo "URLs de los túneles:"
cat logs/tunnel_*.log | grep -E "https://.*?trycloudflare.com" 2>/dev/null || echo "Esperando URLs..."

# Mostrar logs en tiempo real
echo "Mostrando logs en tiempo real (Ctrl+C para salir):"
tail -f logs/tunnel_*.log | grep -E "https://.*?trycloudflare.com"