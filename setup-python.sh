#!/bin/bash

# Actualizar el sistema
sudo apt update

# Instalar Python y pip si no están instalados
sudo apt install -y python3 python3-pip python3-venv

# Crear un entorno virtual
sudo python3 -m venv /opt/venv

# Activar el entorno virtual e instalar dependencias
sudo /opt/venv/bin/pip install fastapi uvicorn psutil aiohttp

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
Environment="PATH=/opt/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/opt/venv/bin/python -m uvicorn api_server:app --host 0.0.0.0 --port 80
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

echo "Para probar manualmente:"
echo "sudo /opt/venv/bin/python -m uvicorn api_server:app --host 0.0.0.0 --port 80"