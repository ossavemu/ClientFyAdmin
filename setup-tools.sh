#!/bin/bash

# Instalar herramientas necesarias
sudo apt-get update
sudo apt-get install -y \
    net-tools \
    lsof \
    curl \
    screen

# Dar permisos de ejecución a los scripts
chmod +x start-instances.sh
chmod +x stop-services.sh
chmod +x setup-python.sh

# Crear directorios necesarios
mkdir -p logs
mkdir -p data
mkdir -p sessions

# Asegurar permisos correctos
sudo chown -R $USER:$USER logs
sudo chown -R $USER:$USER data
sudo chown -R $USER:$USER sessions 