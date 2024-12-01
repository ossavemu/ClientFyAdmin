#!/bin/bash

# Crear túneles para cada puerto
create_tunnel() {
    local port=$1
    echo "Creando túnel para puerto ${port}..."
    cloudflared tunnel --url "http://localhost:${port}" &
}

# Crear túneles para cada puerto
create_tunnel 3008
create_tunnel 3009
create_tunnel 3010
create_tunnel 3011

# Mantener el script ejecutándose
wait 