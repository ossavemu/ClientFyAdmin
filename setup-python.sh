#!/bin/bash

# Actualizar el sistema
sudo apt update

# Instalar Python y pip si no están instalados
sudo apt install -y python3 python3-pip

# Instalar las dependencias de Python
pip3 install fastapi uvicorn

# Dar permisos para usar el puerto 80
sudo setcap CAP_NET_BIND_SERVICE=+eip /usr/bin/python3.10

# Crear un servicio systemd para el servidor FastAPI
sudo cat > /etc/systemd/system/fastapi-server.service << 'EOF'
[Unit]
Description=FastAPI Server
After=network.target

[Service]
User=azureuser
WorkingDirectory=/home/azureuser/ClientFyAdmin/src
ExecStart=/usr/local/bin/uvicorn api_server:app --host 0.0.0.0 --port 80
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Recargar systemd y habilitar el servicio
sudo systemctl daemon-reload
sudo systemctl enable fastapi-server
sudo systemctl start fastapi-server

# Mostrar el estado del servicio
sudo systemctl status fastapi-server

echo "=== Comandos útiles ==="
echo "Ver logs del servidor: sudo journalctl -u fastapi-server -f"
echo "Reiniciar servidor: sudo systemctl restart fastapi-server"
echo "Ver estado: sudo systemctl status fastapi-server" 