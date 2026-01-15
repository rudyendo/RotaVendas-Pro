
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

/**
 * Inicializa a IA usando a variável de ambiente API_KEY.
 * No Vercel, configure esta variável em Settings > Environment Variables.
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY não configurada no ambiente.");
  }
  return new GoogleGenAI({ apiKey });
};

export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            text: "Extraia todos os clientes deste documento PDF. Retorne um array JSON contendo: name, address, neighborhood, city, state, whatsapp. Se o WhatsApp não tiver DDD, use 84 (Natal). Retorne apenas o JSON puro.",
          },
        ],
      }],
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
              whatsapp: { type: Type.STRING },
            },
            required: ["name", "address", "city", "whatsapp"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("A IA não retornou dados.");
    
    const rawData = JSON.parse(text);
    return rawData.map((item: any, index: number) => ({
      ...item,
      id: `client-${Date.now()}-${index}`,
      neighborhood: item.neighborhood || "Centro",
      city: item.city || "Natal",
      state: item.state || "RN",
      country: "Brasil",
      lat: -5.79448 + (Math.random() - 0.5) * 0.04,
      lng: -35.211 + (Math.random() - 0.5) * 0.04,
    }));
  } catch (error: any) {
    console.error("Erro na extração:", error);
    throw new Error("Erro ao processar PDF: " + (error.message || "Verifique sua chave de API."));
  }
};

export const optimizeRoute = async (
  startAddress: string,
  endAddress: string,
  clients: Client[]
): Promise<string[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Ordene os IDs de clientes para a rota mais eficiente.
    Partida: ${startAddress || 'Ponto Inicial'}
    Clientes:
    ${clients.map((c) => `- ID: ${c.id} | Local: ${c.address}, ${c.neighborhood}`).join('\n')}
    Retorne um array JSON de strings contendo apenas os IDs na ordem sugerida.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro na otimização:", error);
    return clients.map(c => c.id);
  }
};
