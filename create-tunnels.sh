#!/bin/bash

# Función para extraer la URL del túnel de Cloudflare
extract_tunnel_url() {
    local port=$1
    local log_file="logs/tunnel_${port}.log"
    
    # Si es puerto par, usar socat para redirigir
    if [ $((port % 2)) -eq 0 ]; then
        # Redirigir el puerto a otro puerto usando socat
        local redirect_port=$((port + 1000))
        socat TCP-LISTEN:${redirect_port},fork TCP:localhost:${port} &
        echo "Puerto ${port} redirigido a ${redirect_port}"
        return
    fi
    
    # Si es puerto impar, usar cloudflared
    cloudflared tunnel --url "http://localhost:${port}" > "$log_file" 2>&1 &
    
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

# Instalar socat si no está instalado
if ! command -v socat &> /dev/null; then
    echo "Instalando socat..."
    sudo apt-get update && sudo apt-get install -y socat
fi

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
echo "Puertos redirigidos:"
echo "3008 -> 4008"
echo "3010 -> 4010"
echo "Para ver las URLs de Cloudflare ejecuta: grep -h 'https://' logs/tunnel_*.log"
