
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

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
            text: "Extraia a lista completa de clientes deste documento PDF. É fundamental identificar a cidade de cada cliente. Retorne um array JSON de objetos contendo: name, address, neighborhood, city, phone e info. Se a cidade não estiver explícita em cada linha, tente deduzi-la pelo cabeçalho ou contexto do documento. Certifique-se de que o campo 'city' não fique vazio.",
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
          },
          required: ["name", "address", "city"],
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
    Como um especialista em logística, organize a melhor rota de visita para estes clientes, visando economia de combustível e menor tempo.
    Ponto de Partida: ${startAddress}
    Ponto de Chegada: ${endAddress}
    Clientes a visitar (Endereços):
    ${clients.map((c, i) => `${i + 1}. ${c.name} - ${c.address}, ${c.neighborhood}, ${c.city}`).join('\n')}

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
