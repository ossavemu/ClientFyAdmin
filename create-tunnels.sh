#!/bin/bash

# Función para extraer la URL del túnel
extract_tunnel_url() {
    local port=$1
    local log_file="logs/tunnel_${port}.log"
    
    # Iniciar el túnel y redirigir la salida al log
    cloudflared tunnel --url "http://localhost:${port}" > "$log_file" 2>&1 &
    
    # Esperar hasta que la URL aparezca en el log (máximo 30 segundos)
    local counter=0
    while [ $counter -lt 30 ]; do
        if grep -q "https://.*trycloudflare.com" "$log_file" 2>/dev/null; then
            local url=$(grep -o "https://.*trycloudflare.com" "$log_file" | head -n 1)
            echo "Puerto ${port} -> ${url}"
            return
        fi
        sleep 1
        counter=$((counter + 1))
    done
    
    echo "Tiempo de espera agotado para el puerto ${port}"
}

# Crear directorio para logs si no existe
mkdir -p logs

echo "Iniciando túneles..."
echo "===================="

# Crear túneles para cada puerto
for port in 3008 3009 3010 3011; do
    extract_tunnel_url $port &
done

# Esperar a que todos los túneles estén listos
wait

echo "===================="
echo "Todos los túneles están activos"
echo "Para ver los logs nuevamente ejecuta: grep -h 'https://' logs/tunnel_*.log" 