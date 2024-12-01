#!/bin/bash

# Función para extraer la URL del túnel
extract_tunnel_url() {
    local port=$1
    local log_file="tunnel_${port}.log"
    
    # Esperar hasta que la URL aparezca en el log
    while ! grep -q "https://.*trycloudflare.com" "$log_file" 2>/dev/null; do
        sleep 1
    done
    
    # Extraer y mostrar la URL
    local url=$(grep -o "https://.*trycloudflare.com" "$log_file" | head -n 1)
    echo "Puerto ${port} -> ${url}"
    
    # Mantener el túnel corriendo pero redirigir la salida al log
    cloudflared tunnel --url "http://localhost:${port}" > "$log_file" 2>&1 &
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
echo "Para ver los logs nuevamente ejecuta: grep -h 'https://' tunnel_*.log" 