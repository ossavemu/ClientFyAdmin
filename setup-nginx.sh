#!/bin/bash

# Instalar Nginx
sudo apt update
sudo apt install -y nginx

# Crear configuración para el proxy reverso
sudo cat > /etc/nginx/sites-available/clientfy << 'EOF'
server {
    listen 80;
    server_name _;

    location /bot1/ {
        proxy_pass http://localhost:3008/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /bot2/ {
        proxy_pass http://localhost:3009/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /bot3/ {
        proxy_pass http://localhost:3010/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /bot4/ {
        proxy_pass http://localhost:3011/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /tunnels {
        proxy_pass http://localhost:3008/tunnels;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Activar el sitio
sudo ln -s /etc/nginx/sites-available/clientfy /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx

# Abrir puerto 80 en el firewall
sudo ufw allow 80/tcp 