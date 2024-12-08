import { config } from '../config/index.js';

export const getPrompt = async (phoneNumber) => {
  try {
    // Determinar qué número usar basado en el provider
    const numberToUse =
      config.provider === 'baileys' ? config.P_NUMBER : phoneNumber;

    console.log('🔍 Iniciando fetch de prompt...');
    console.log('📞 Número original:', phoneNumber);
    console.log('🤖 Provider:', config.provider);
    console.log('📱 Número a usar:', numberToUse);

    // Construir la URL usando el número correcto
    const url = `${config.prompt_api_url}/${numberToUse}`;
    console.log('🌐 URL:', url);

    const response = await fetch(url);
    console.log('📥 Status de respuesta:', response.status);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log('📄 Datos recibidos:', JSON.stringify(data, null, 2));

    // Asumiendo que la API devuelve el prompt en data.prompt
    const prompt = data.prompt || '';
    console.log('✨ Prompt obtenido:', prompt.substring(0, 100) + '...');

    return prompt;
  } catch (error) {
    console.error('❌ Error al obtener el prompt:', error);
    console.error('Stack:', error.stack);
    // Devolver un prompt por defecto en caso de error
    return config.defaultPrompt || '';
  }
};
