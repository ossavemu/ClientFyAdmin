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