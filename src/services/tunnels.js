import fs from 'fs/promises';
import path from 'path';

export class TunnelService {
  static async getTunnels() {
    try {
      // Directorio de logs relativo a la raíz del proyecto
      const logsDir = path.join(process.cwd(), 'logs');

      // Leer todos los archivos de túnel
      const files = await fs.readdir(logsDir);
      const tunnelFiles = files.filter((file) => file.startsWith('tunnel_'));

      const tunnels = [];

      // Procesar cada archivo de túnel
      for (const file of tunnelFiles) {
        const content = await fs.readFile(path.join(logsDir, file), 'utf8');
        const matches = content.match(
          /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/
        );
        if (matches) {
          const port = file.match(/tunnel_(\d+)\.log/)[1];
          tunnels.push({
            port: parseInt(port),
            url: matches[0],
            instance: parseInt(port) - 3007, // Calculamos el número de instancia
          });
        }
      }

      // Ordenar por número de instancia
      return tunnels.sort((a, b) => a.instance - b.instance);
    } catch (error) {
      console.error('Error al leer los túneles:', error);
      return [];
    }
  }
}
