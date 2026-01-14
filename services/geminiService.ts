
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

/**
 * Extrai clientes de um PDF usando IA.
 */
export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  // Inicializa o SDK. Se o process.env.API_KEY estiver vazio, o erro será tratado no catch do App.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Pdf,
          },
        },
        {
          text: "Extraia a lista completa de clientes deste documento PDF. Identifique o endereço completo, incluindo Bairro, Cidade, Estado e País. Extraia também o número de WhatsApp (no formato internacional: código do país + DDD + número). Tente inferir a Latitude e Longitude aproximada para cada cliente. Retorne um array JSON de objetos contendo: name, address, neighborhood, city, state, country, whatsapp, phone, info, lat (number) e lng (number).",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            address: { type: Type.STRING },
            neighborhood: { type: Type.STRING },
            city: { type: Type.STRING },
            state: { type: Type.STRING },
            country: { type: Type.STRING },
            whatsapp: { type: Type.STRING },
            phone: { type: Type.STRING },
            info: { type: Type.STRING },
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
          },
          required: ["name", "address", "city", "state", "country", "whatsapp", "lat", "lng"],
        },
      },
    },
  });

  const rawData = JSON.parse(response.text || "[]");
  return rawData.map((item: any, index: number) => ({
    ...item,
    id: `client-${Date.now()}-${index}`,
  }));
};

/**
 * Otimização de Rota usando IA Gemini (Inteligência Logística).
 */
export const optimizeRoute = async (
  startAddress: string,
  endAddress: string,
  clients: Client[]
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Você é um especialista em logística. Organize a melhor ordem de visita para os seguintes clientes, 
    minimizando o tempo de deslocamento.
    
    Ponto de Partida: ${startAddress || 'Localização Atual'}
    Ponto de Chegada: ${endAddress || 'Retorno à Base'}
    
    Lista de Clientes a visitar:
    ${clients.map((c, i) => `- ID: ${c.id} | Nome: ${c.name} | Endereço: ${c.address}, ${c.neighborhood}, ${c.city}`).join('\n')}

    Retorne APENAS um array JSON contendo os IDs dos clientes na ordem de visita recomendada. 
    Exemplo: ["id1", "id2", "id3"]
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    const orderedIds = JSON.parse(response.text || "[]");
    return orderedIds;
  } catch (e) {
    console.error("Erro ao processar resposta da IA:", e);
    // Fallback: retorna a ordem original caso a IA falhe no formato
    return clients.map(c => c.id);
  }
};

/**
 * Mantemos o algoritmo matemático como utilitário interno para fallback silencioso.
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
};
