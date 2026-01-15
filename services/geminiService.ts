
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

/**
 * Extrai clientes de um PDF usando IA.
 */
export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  // Inicializa o SDK usando a variável de ambiente exata API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
            text: "Analise este documento PDF e extraia TODOS os clientes listados. Para cada cliente, identifique: Nome, Endereço completo, Bairro, Cidade, Estado, País e WhatsApp (com código do país e DDD). Se não encontrar coordenadas exatas, estime lat/lng baseadas na cidade/bairro. Retorne um array JSON estrito.",
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
              country: { type: Type.STRING },
              whatsapp: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
            },
            required: ["name", "address", "city", "whatsapp"],
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
      city: item.city || "Não informada",
      state: item.state || "RN",
      country: item.country || "Brasil",
      lat: item.lat || -5.79448 + (Math.random() - 0.5) * 0.01,
      lng: item.lng || -35.211 + (Math.random() - 0.5) * 0.01,
    }));
  } catch (error: any) {
    console.error("Erro no extractClientsFromPDF:", error);
    throw new Error(error.message || "Falha na comunicação com a IA.");
  }
};

/**
 * Otimização de Rota usando IA Gemini.
 */
export const optimizeRoute = async (
  startAddress: string,
  endAddress: string,
  clients: Client[]
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Como especialista em logística, ordene estes clientes para a rota mais eficiente.
    Partida: ${startAddress || 'Início'}
    Destino Final: ${endAddress || 'Retorno'}
    
    Clientes:
    ${clients.map((c) => `- ID: ${c.id} | Nome: ${c.name} | Local: ${c.address}, ${c.neighborhood}`).join('\n')}

    Retorne APENAS um array JSON com os IDs na ordem correta de visita.
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
    console.error("Erro no optimizeRoute:", error);
    return clients.map(c => c.id); // Fallback para ordem original
  }
};
