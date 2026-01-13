
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

// Proteção para evitar crash se process.env não estiver definido no ambiente do navegador
const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    console.warn("API_KEY não encontrada em process.env");
    return '';
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            text: "Extraia a lista completa de clientes deste documento PDF. Todos os endereços são do estado do Rio Grande do Norte (RN). É fundamental identificar a cidade e o bairro de cada cliente. Além disso, forneça as coordenadas geográficas aproximadas (latitude e longitude) para cada endereço para que possamos plotar no mapa. Retorne um array JSON de objetos contendo: name, address, neighborhood, city, phone, info, lat (number) e lng (number).",
          },
        ],
      },
    ],
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
            phone: { type: Type.STRING },
            info: { type: Type.STRING },
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
          },
          required: ["name", "address", "city", "lat", "lng"],
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

export const optimizeRoute = async (
  startAddress: string,
  endAddress: string,
  clients: Client[]
): Promise<string[]> => {
  const prompt = `
    Como um especialista em logística, organize a melhor rota de visita para estes clientes no Rio Grande do Norte, visando economia de combustível e menor tempo.
    Ponto de Partida: ${startAddress}
    Ponto de Chegada: ${endAddress}
    Clientes a visitar (Endereços):
    ${clients.map((c, i) => `${i + 1}. ${c.name} - ${c.address}, ${c.neighborhood}, ${c.city} (Coordenadas: ${c.lat}, ${c.lng})`).join('\n')}

    Retorne APENAS um array JSON contendo os IDs dos clientes na ordem de visita sugerida.
    Os IDs fornecidos são: ${clients.map(c => c.id).join(', ')}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};
