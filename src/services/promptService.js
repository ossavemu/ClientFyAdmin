import { config } from '../config/index.js';

export const getPrompt = async (botNumber) => {
  try {
    console.log('🔍 Iniciando fetch de prompt...');
    console.log('📞 Número original:', botNumber);

    // Validar el formato del número
    if (!botNumber) {
      throw new Error('El número del bot es undefined');
    }

    // Determinar el país basado en el prefijo
    let country;
    let cleanNumber;

    if (botNumber.startsWith('57')) {
      country = 'CO';
      cleanNumber = botNumber.replace(/^57/, '');
    } else if (botNumber.startsWith('52')) {
      country = 'MX';
      cleanNumber = botNumber.replace(/^52/, '');
    } else {
      // Si no tiene prefijo, asumimos que es Colombia
      country = 'CO';
      cleanNumber = botNumber;
    }

    console.log('🌍 País detectado:', country);
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
