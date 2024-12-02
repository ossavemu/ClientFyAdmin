#!/bin/bash

SESSION_NAME="clientfy-bots"

# Crear directorio para logs si no existe
mkdir -p logs

# Limpiar logs antiguos
rm -f logs/tunnel_*.log

# Crear el script temporal que se ejecutará dentro de screen
cat > logs/tunnel_script.sh << 'EOF'
#!/bin/bash

# Función para limpiar al salir
cleanup() {
    echo "Limpiando túneles..."
    pkill -f "cloudflared tunnel"
    pkill -f "uvicorn api_server:app"
    exit 0
}

# Registrar la función de limpieza
trap cleanup EXIT

# Iniciar las instancias del bot
for i in {1..4}; do
    export INSTANCE_ID=$i
    PORT=$((3007 + i))
    echo "Iniciando instancia $i en puerto $PORT"
    node src/app.js &
    sleep 2
    
    echo "Creando túnel para instancia $i (puerto $PORT)"
    cloudflared tunnel --url "http://localhost:${PORT}" > "logs/tunnel_${PORT}.log" 2>&1 &
    
    # Esperar 40 segundos entre cada túnel
    echo "Esperando 40 segundos antes de crear el siguiente túnel..."
    sleep 40
done

# Iniciar el servidor FastAPI
echo "Iniciando servidor FastAPI..."
cd src
/opt/venv/bin/python -m uvicorn api_server:app --host 0.0.0.0 --port 80 &

# Mantener el script ejecutándose
wait
EOF

# Hacer ejecutable el script temporal
chmod +x logs/tunnel_script.sh

# Crear nueva sesión de screen con el script temporal
screen -dmS $SESSION_NAME bash -c 'cd "$(pwd)" && ./logs/tunnel_script.sh'

echo "Sesión iniciada en background. Para ver los logs:"
echo "screen -r $SESSION_NAME"

# Esperar y mostrar URLs
echo "Esperando que los servicios estén listos..."
sleep 180

# Verificar si FastAPI está respondiendo
if curl -s -f http://localhost/tunnels > /dev/null 2>&1; then
    echo "URLs de los túneles:"
    curl -s http://localhost/tunnels | python3 -m json.tool
else
    echo "ERROR: El servidor FastAPI no está respondiendo."
    echo "Mostrando URLs desde los logs:"
    grep -h "https://.*trycloudflare\.com" logs/tunnel_*.log
fi

# Mostrar logs en tiempo real
echo "Mostrando logs en tiempo real (Ctrl+C para salir):"
tail -f logs/tunnel_*.log | grep -E "https://.*?trycloudflare.com"