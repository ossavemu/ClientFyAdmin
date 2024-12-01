#!/bin/bash

SESSION_NAME="clientfy-bots"

# Función para crear túnel con Cloudflare
create_cloudflare_tunnel() {
    local port=$1
    local log_file="logs/tunnel_${port}.log"
    
    echo "Intentando crear túnel Cloudflare para puerto $port..."
    cloudflared tunnel --url "http://localhost:${port}" > "$log_file" 2>&1 &
    
    # Esperar hasta 10 segundos por la URL de Cloudflare
    local counter=0
    while [ $counter -lt 10 ]; do
        if grep -q "https://.*trycloudflare.com" "$log_file" 2>/dev/null; then
            local url=$(grep -o "https://.*trycloudflare.com" "$log_file" | head -n 1)
            echo "SUCCESS:$url"
            return 0
        fi
        sleep 1
        counter=$((counter + 1))
    done
    
    echo "FAIL"
    return 1
}

# Función para crear túnel con Localtunnel
create_localtunnel() {
    local port=$1
    local log_file="logs/tunnel_${port}.log"
    
    echo "Creando túnel Localtunnel para puerto $port..."
    npx localtunnel --port $port > "$log_file" 2>&1 &
    
    # Esperar hasta 10 segundos por la URL de Localtunnel
    local counter=0
    while [ $counter -lt 10 ]; do
        if grep -q "https://.*\.loca.lt" "$log_file" 2>/dev/null; then
            local url=$(grep -o "https://.*\.loca.lt" "$log_file" | head -n 1)
            echo "$url"
            return 0
        fi
        sleep 1
        counter=$((counter + 1))
    done
    
    return 1
}

# Verificar si la sesión ya existe y terminarla
screen -ls | grep $SESSION_NAME > /dev/null
if [ $? -eq 0 ]; then
    echo "La sesión ya está corriendo. Deteniéndola..."
    screen -S $SESSION_NAME -X quit
    sleep 2
fi

# Crear directorio para logs
mkdir -p logs

# Limpiar logs antiguos
rm -f logs/tunnel_*.log

# Crear nueva sesión de screen
screen -dmS $SESSION_NAME bash -c '
    # Iniciar las instancias del bot
    for i in {1..4}; do
        export INSTANCE_ID=$i
        PORT=$((3007 + i))
        echo "Iniciando instancia $i en puerto $PORT"
        node src/app.js &
        sleep 2
        
        # Intentar primero con Cloudflare
        TUNNEL_RESULT=$(create_cloudflare_tunnel $PORT)
        
        if [[ $TUNNEL_RESULT == FAIL* ]]; then
            echo "Cloudflare falló, intentando con Localtunnel..."
            TUNNEL_URL=$(create_localtunnel $PORT)
            if [ $? -eq 0 ]; then
                echo "Puerto $PORT -> $TUNNEL_URL (Localtunnel)"
            else
                echo "Error: No se pudo crear túnel para puerto $PORT"
            fi
        else
            TUNNEL_URL=${TUNNEL_RESULT#SUCCESS:}
            echo "Puerto $PORT -> $TUNNEL_URL (Cloudflare)"
        fi
    done

    # Mantener el script ejecutándose
    wait
'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"

# Esperar y mostrar URLs
sleep 10
echo "URLs de los túneles:"
cat logs/tunnel_*.log | grep -E "https://.*?(trycloudflare.com|loca.lt)"