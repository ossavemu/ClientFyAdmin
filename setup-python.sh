#!/bin/bash

# Actualizar el sistema
sudo apt update

# Instalar Python y pip si no están instalados
sudo apt install -y python3 python3-pip

# Instalar las dependencias de Python
sudo pip3 install fastapi uvicorn

# Crear un servicio systemd para el servidor FastAPI
sudo cat > /etc/systemd/system/fastapi-server.service << 'EOF'
[Unit]
Description=FastAPI Server
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/home/azureuser/ClientFyAdmin/src
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/usr/local/bin/uvicorn api_server:app --host 0.0.0.0 --port 80
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
EOF

# Recargar systemd
sudo systemctl daemon-reload

# Detener el servicio si está corriendo
sudo systemctl stop fastapi-server

# Habilitar y reiniciar el servicio
sudo systemctl enable fastapi-server
sudo systemctl start fastapi-server

# Mostrar el estado y los logs
sudo systemctl status fastapi-server
sudo journalctl -u fastapi-server -n 50 --no-pager 