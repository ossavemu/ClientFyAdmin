#!/bin/bash

# Instalar Nginx
sudo apt update
sudo apt install -y nginx

# Detener servicios existentes
sudo systemctl stop nginx

# Limpiar configuraciones anteriores
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/clientfy
sudo rm -f /etc/nginx/sites-available/clientfy

# Crear configuración simple para el proxy reverso
sudo cat > /etc/nginx/sites-available/clientfy << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Logs específicos
    access_log /var/log/nginx/clientfy_access.log;
    error_log /var/log/nginx/clientfy_error.log debug;

    # Configuración global de proxy
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Timeouts más largos
    proxy_connect_timeout 120;
    proxy_send_timeout 120;
    proxy_read_timeout 120;
    send_timeout 120;

    # Configuración de buffer
    proxy_buffers 8 32k;
    proxy_buffer_size 64k;

    # Ruta principal para túneles
    location = /tunnels {
        proxy_pass http://127.0.0.1:3008/tunnels;
    }

    # Rutas para cada bot
    location /bot1 {
        proxy_pass http://127.0.0.1:3008;
    }

    location /bot2 {
        proxy_pass http://127.0.0.1:3009;
    }

    location /bot3 {
        proxy_pass http://127.0.0.1:3010;
    }

    location /bot4 {
        proxy_pass http://127.0.0.1:3011;
    }
}
EOF

# Activar el sitio
sudo ln -sf /etc/nginx/sites-available/clientfy /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx limpiamente
sudo systemctl start nginx

# Asegurar que el puerto 80 está abierto
sudo ufw allow 80/tcp

# Mostrar estado
sudo systemctl status nginx

# Mostrar comandos útiles
echo "=== Comandos útiles ==="
echo "Ver logs de error: sudo tail -f /var/log/nginx/clientfy_error.log"
echo "Ver logs de acceso: sudo tail -f /var/log/nginx/clientfy_access.log"
echo "Ver estado de nginx: sudo systemctl status nginx"
echo "Verificar puertos en uso: sudo netstat -tulpn | grep -E ':80|:3008|:3009|:3010|:3011'"