import { config } from '../config/index.js';

export const getPrompt = async (botNumber) => {
  try {
    // Limpiar el número de cualquier prefijo existente
    const cleanNumber = botNumber.replace(/^(52|57)/, '');

    // Determinar el país basado en el prefijo original
    let country = 'CO'; // Por defecto Colombia
    if (botNumber.startsWith('52')) {
      country = 'MX';
    } else if (botNumber.startsWith('57')) {
      country = 'CO';
    }

    console.log('🔍 País detectado:', country);
    console.log('📱 Número limpio:', cleanNumber);

    const url = `${config.prompt_api_url}/${cleanNumber}`;
    console.log('🌐 URL:', url);

    const response = await fetch(url);
    console.log('📥 Status de respuesta:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📄 Datos recibidos:', JSON.stringify(data, null, 2));

    if (!data.prompt) {
      throw new Error('No se encontró el prompt en la respuesta');
    }

    console.log('✨ Prompt obtenido:', data.prompt.substring(0, 50) + '...');
    return data.prompt;
  } catch (error) {
    console.error('Error obteniendo prompt:', error);
    return config.default_prompt;
  }
};
