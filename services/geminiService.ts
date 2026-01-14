
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  // Inicialização direta conforme diretrizes
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
          text: "Extraia a lista completa de clientes deste documento PDF. Identifique o endereço completo, incluindo Bairro, Cidade, Estado e País. Extraia também o número de WhatsApp (no formato internacional: código do país + DDD + número). Retorne um array JSON de objetos contendo: name, address, neighborhood, city, state, country, whatsapp, phone, info, lat (number) e lng (number).",
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

export const optimizeRoute = async (
  startAddress: string,
  endAddress: string,
  clients: Client[]
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Como um especialista em logística, organize a melhor rota de visitas:
    Partida: ${startAddress}
    Chegada: ${endAddress}
    Clientes:
    ${clients.map((c, i) => `${i + 1}. ${c.name} - ${c.address}, ${c.neighborhood}, ${c.city}, ${c.state}, ${c.country}`).join('\n')}

    Retorne apenas um array JSON com os IDs na ordem otimizada: ${clients.map(c => c.id).join(', ')}
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

  return JSON.parse(response.text || "[]");
};
