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

def check_bot_pairing(instance_id: int) -> bool:
    """Verifica si un bot está emparejado revisando su archivo de sesión"""
    session_path = f"../sessions/bot{instance_id}"
    
    # Verifica si existe el directorio de sesión y tiene archivos
    if os.path.exists(session_path):
        files = os.listdir(session_path)
        # Si hay archivos de sesión, consideramos que está emparejado
        return len(files) > 0
    return False

def get_bot_last_activity(instance_id: int) -> str:
    """Obtiene la última actividad del bot desde los logs"""
    log_file = f"../logs/bot_{instance_id}.log"
    try:
        if os.path.exists(log_file):
            return datetime.fromtimestamp(os.path.getmtime(log_file)).isoformat()
    except:
        pass
    return "Unknown"

def get_process_info(port: int) -> Dict:
    """Obtiene información del proceso del bot por su puerto"""
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

async def get_bot_status(port: int) -> Dict:
    """Obtiene el estado real del bot consultando su API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"http://localhost:{port}/status", timeout=2) as response:
                if response.status == 200:
                    return await response.json()
    except:
        pass
    return {
        "paired": False,
        "lastActivity": None,
        "status": "offline"
    }

def read_bot_states() -> Dict:
    """Lee los estados de los bots desde el archivo JSON"""
    try:
        state_file = Path("../data/bot_states.json")
        if state_file.exists():
            return json.loads(state_file.read_text())
    except Exception as e:
        print(f"Error leyendo estados: {e}")
    return {}

@app.get("/state", response_model=ServerState)
async def get_server_state():
    # Información del sistema
    system = SystemState(
        cpu_percent=psutil.cpu_percent(),
        memory_percent=psutil.virtual_memory().percent,
        disk_usage=psutil.disk_usage('/').percent,
        uptime=str(datetime.now() - datetime.fromtimestamp(psutil.boot_time()))
    )
    
    # Estado de cada bot
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