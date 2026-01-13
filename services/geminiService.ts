
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

// Função para obter a chave de forma segura no ambiente do navegador/Vercel
const getApiKey = () => {
  try {
    // O Vercel injeta variáveis de ambiente em process.env durante o build/runtime
    const key = process.env.API_KEY;
    return key || '';
  } catch (e) {
    return '';
  }
};

export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("A chave de API (API_KEY) não foi configurada nas variáveis de ambiente do Vercel. Por favor, adicione-a nas configurações do projeto.");
  }

  // Inicializa o cliente dentro da função para garantir que usa a chave mais atual
  const ai = new GoogleGenAI({ apiKey });
  
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
            text: "Extraia a lista completa de clientes deste documento PDF. Todos os endereços são do estado do Rio Grande do Norte (RN). É fundamental identificar a cidade e o bairro de cada cliente. Além disso, forneça as coordenadas geográficas aproximadas (latitude e longitude) para cada endereço. Retorne um array JSON de objetos contendo: name, address, neighborhood, city, phone, info, lat (number) e lng (number).",
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
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("A chave de API (API_KEY) não foi configurada.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
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
