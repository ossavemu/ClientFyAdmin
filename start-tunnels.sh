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
import psutil
import json
from typing import List, Dict
from pydantic import BaseModel
from datetime import datetime
import aiohttp
import asyncio
from pathlib import Path

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

class BotState(BaseModel):
    instance_id: int
    port: int
    is_running: bool
    is_paired: bool
    uptime: str
    memory_usage: float
    last_activity: str
    status: str

class SystemState(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_usage: float
    uptime: str

class ServerState(BaseModel):
    timestamp: str
    system: SystemState
    bots: List[BotState]

@app.get("/tunnels", response_model=List[Tunnel])
async def get_tunnels():
    tunnels = []
    logs_dir = os.path.join(os.getcwd(), "..", "logs")
    
    try:
        for file in os.listdir(logs_dir):
            if file.startswith("tunnel_") and file.endswith(".log"):
                port = int(re.search(r"tunnel_(\d+)\.log", file).group(1))
                instance = port - 3007
                
                with open(os.path.join(logs_dir, file), "r") as f:
                    content = f.read()
                    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
                    if match:
                        tunnel = Tunnel(
                            tunnel_url=match.group(0),
                            local_url=f"http://localhost:{port}",
                            instance=instance,
                            port=port
                        )
                        tunnels.append(tunnel)
        
        return sorted(tunnels, key=lambda x: x.instance)
    except Exception as e:
        print(f"Error reading tunnels: {str(e)}")
        return []

def get_process_info(port: int) -> Dict:
    for proc in psutil.process_iter(['pid', 'name', 'create_time']):
        try:
            connections = proc.connections()
            if any(conn.laddr.port == port for conn in connections):
                return {
                    "is_running": True,
                    "uptime": str(datetime.now() - datetime.fromtimestamp(proc.create_time())),
                    "memory_usage": proc.memory_percent()
                }
        except:
            continue
    return {
        "is_running": False,
        "uptime": "0",
        "memory_usage": 0.0
    }

def read_bot_states() -> Dict:
    try:
        state_file = Path("../data/bot_states.json")
        if state_file.exists():
            return json.loads(state_file.read_text())
    except Exception as e:
        print(f"Error leyendo estados: {e}")
    return {}

@app.get("/state", response_model=ServerState)
async def get_server_state():
    system = SystemState(
        cpu_percent=psutil.cpu_percent(),
        memory_percent=psutil.virtual_memory().percent,
        disk_usage=psutil.disk_usage('/').percent,
        uptime=str(datetime.now() - datetime.fromtimestamp(psutil.boot_time()))
    )
    
    bots = []
    bot_states = read_bot_states()
    
    for i in range(1, 5):
        port = 3007 + i
        process_info = get_process_info(port)
        bot_state_data = bot_states.get(str(i), {})
        
        bot_state = BotState(
            instance_id=i,
            port=port,
            is_running=process_info["is_running"],
            is_paired=bot_state_data.get("paired", False),
            uptime=process_info["uptime"],
            memory_usage=process_info["memory_usage"],
            last_activity=bot_state_data.get("lastUpdate", "Unknown"),
            status=bot_state_data.get("status", "unknown")
        )
        bots.append(bot_state)

    return ServerState(
        timestamp=datetime.now().isoformat(),
        system=system,
        bots=bots
    )

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