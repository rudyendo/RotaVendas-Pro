
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
            text: "Extraia a lista de clientes deste documento PDF. Retorne um array JSON de objetos contendo: name, address, neighborhood, city, phone e info. Tente identificar o bairro (neighborhood) para cada cliente. Se não encontrar, deixe em branco.",
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
          required: ["name", "address"],
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
    ${clients.map((c, i) => `${i + 1}. ${c.name} - ${c.address}, ${c.neighborhood}`).join('\n')}

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
