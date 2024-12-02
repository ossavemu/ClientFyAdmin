#!/bin/bash

SESSION_NAME="clientfy-bots"

# Crear directorio para logs si no existe
mkdir -p logs

# Limpiar logs antiguos
rm -f logs/tunnel_*.log

# Actualizar api_server.py con el nuevo código
cat > src/api_server.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import re
from typing import List
from pydantic import BaseModel

app = FastAPI()

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Tunnel(BaseModel):
    tunnel_url: str
    local_url: str
    instance: int
    port: int

@app.get("/tunnels", response_model=List[Tunnel])
async def get_tunnels():
    tunnels = []
    logs_dir = os.path.join(os.getcwd(), "..", "logs")
    
    try:
        for file in os.listdir(logs_dir):
            if file.startswith("tunnel_") and file.endswith(".log"):
                port = int(re.search(r"tunnel_(\d+)\.log", file).group(1))
                instance = port - 3007  # Calculamos la instancia basada en el puerto
                
                with open(os.path.join(logs_dir, file), "r") as f:
                    content = f.read()
                    # Buscar URL de cloudflare
                    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
                    if match:
                        tunnel = Tunnel(
                            tunnel_url=match.group(0),
                            local_url=f"http://localhost:{port}",
                            instance=instance,
                            port=port
                        )
                        tunnels.append(tunnel)
        
        # Ordenar por número de instancia
        return sorted(tunnels, key=lambda x: x.instance)
    except Exception as e:
        print(f"Error reading tunnels: {str(e)}")
        return []

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=80)
EOF

# Verificar si la sesión ya existe y terminarla
screen -ls | grep $SESSION_NAME > /dev/null
if [ $? -eq 0 ]; then
    echo "La sesión ya está corriendo. Deteniéndola..."
    screen -S $SESSION_NAME -X quit
    sleep 2
fi

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
sleep 180
echo "URLs de los túneles:"
curl -s http://localhost/tunnels | python3 -m json.tool

# Mostrar logs en tiempo real
echo "Mostrando logs en tiempo real (Ctrl+C para salir):"
tail -f logs/tunnel_*.log | grep -E "https://.*?trycloudflare.com"