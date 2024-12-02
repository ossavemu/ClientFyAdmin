#!/bin/bash

# Instalar Nginx
sudo apt update
sudo apt install -y nginx

# Crear configuración para el proxy reverso
sudo cat > /etc/nginx/sites-available/clientfy << 'EOF'
server {
    listen 80;
    server_name _;

    # Configuración de logs
    access_log /var/log/nginx/clientfy_access.log;
    error_log /var/log/nginx/clientfy_error.log;

    # Aumentar timeouts
    proxy_connect_timeout 60;
    proxy_send_timeout 60;
    proxy_read_timeout 60;
    send_timeout 60;

    location /bot1/ {
        proxy_pass http://127.0.0.1:3008/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /bot2/ {
        proxy_pass http://127.0.0.1:3009/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /bot3/ {
        proxy_pass http://127.0.0.1:3010/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /bot4/ {
        proxy_pass http://127.0.0.1:3011/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /tunnels {
        proxy_pass http://127.0.0.1:3008/tunnels;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Activar el sitio
sudo ln -sf /etc/nginx/sites-available/clientfy /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx

# Abrir puerto 80 en el firewall
sudo ufw allow 80/tcp

# Ver logs en tiempo real
echo "Para ver logs de error en tiempo real:"
echo "sudo tail -f /var/log/nginx/clientfy_error.log"
echo "Para ver logs de acceso en tiempo real:"
echo "sudo tail -f /var/log/nginx/clientfy_access.log"