#!/bin/bash

# Verificar si se está ejecutando como root
if [ "$EUID" -ne 0 ]; then 
  echo "Por favor, ejecuta el script como root (usando sudo)"
  exit 1
fi

echo "Configurando memoria swap de 2GB..."

# Crear archivo swap
fallocate -l 2G /swapfile

# Establecer permisos correctos
chmod 600 /swapfile

# Formatear como swap
mkswap /swapfile

# Activar swap
swapon /swapfile

# Hacer el swap permanente
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Instalar screen si no está instalado
if ! command -v screen &> /dev/null; then
    echo "Instalando screen..."
    apt-get update
    apt-get install -y screen
fi

echo "¡Configuración completada!"
echo "Memoria swap actual:"
free -h 