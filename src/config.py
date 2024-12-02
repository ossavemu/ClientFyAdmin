import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
LOGS_DIR = BASE_DIR / "logs"
SESSIONS_DIR = BASE_DIR / "sessions"
DATA_DIR = BASE_DIR / "data"

# Crear directorios necesarios
for directory in [LOGS_DIR, SESSIONS_DIR, DATA_DIR]:
    directory.mkdir(exist_ok=True)

# Configuración del servidor
API_HOST = "0.0.0.0"
API_PORT = 3000
BOT_BASE_PORT = 3007
MAX_BOTS = 4 