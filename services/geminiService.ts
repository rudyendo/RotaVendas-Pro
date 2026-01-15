
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

/**
 * Obtém a instância da IA garantindo que a chave exista.
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
    throw new Error("Chave de API (API_KEY) não detectada ou inválida. Configure-a no ambiente do Vercel.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Extrai clientes de um PDF usando IA Gemini.
 */
export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            text: "Extraia todos os clientes deste documento PDF. Retorne um array JSON com os campos: name, address, neighborhood, city, state, whatsapp. Se o WhatsApp não tiver DDD, assuma 84. Retorne APENAS o JSON, sem markdown ou explicações.",
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
              whatsapp: { type: Type.STRING },
            },
            required: ["name", "address", "city", "whatsapp"],
            propertyOrdering: ["name", "address", "neighborhood", "city", "state", "whatsapp"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("A IA retornou uma resposta vazia.");
    
    const rawData = JSON.parse(text);
    return rawData.map((item: any, index: number) => ({
      ...item,
      id: `client-${Date.now()}-${index}`,
      neighborhood: item.neighborhood || "Centro",
      city: item.city || "Natal",
      state: item.state || "RN",
      country: "Brasil",
      lat: -5.79448 + (Math.random() - 0.5) * 0.05,
      lng: -35.211 + (Math.random() - 0.5) * 0.05,
    }));
  } catch (error: any) {
    console.error("Erro no processamento do Gemini:", error);
    throw new Error(error.message || "Falha ao processar o PDF com a IA.");
  }
};

/**
 * Otimiza a rota baseada nos endereços dos clientes.
 */
export const optimizeRoute = async (
  clients: Client[]
): Promise<string[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Ordene os IDs dos clientes abaixo para criar a rota de entrega mais eficiente geograficamente.
    
    Lista de Clientes:
    ${clients.map((c) => `- ID: ${c.id} | Endereço: ${c.address}, ${c.neighborhood}, ${c.city}`).join('\n')}
    
    Retorne um array JSON contendo APENAS os IDs na ordem sugerida.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return Array.isArray(result) ? result : clients.map(c => c.id);
  } catch (error) {
    console.error("Erro na otimização de rota:", error);
    return clients.map(c => c.id);
  }
};
