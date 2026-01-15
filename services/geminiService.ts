
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

/**
 * Extrai clientes de um PDF usando IA.
 */
export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY não configurada. Adicione a variável de ambiente no seu provedor de hospedagem.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            text: "Extraia todos os clientes deste PDF. Retorne um array JSON com: name, address, neighborhood, city, state, whatsapp. Se não houver coordenadas, ignore lat/lng. Foque na precisão do endereço e nome.",
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
    if (!text) throw new Error("A IA retornou uma resposta vazia.");
    
    const rawData = JSON.parse(text);
    return rawData.map((item: any, index: number) => ({
      ...item,
      id: `client-${Date.now()}-${index}`,
      neighborhood: item.neighborhood || "Centro",
      city: item.city || "Natal",
      state: item.state || "RN",
      country: "Brasil",
      lat: -5.79448 + (Math.random() - 0.5) * 0.05, // Coordenadas simuladas próximas a Natal se não houver GPS real
      lng: -35.211 + (Math.random() - 0.5) * 0.05,
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
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  
  const prompt = `
    Ordene os IDs de clientes para a rota mais eficiente saindo de ${startAddress || 'Ponto A'} e terminando em ${endAddress || 'Ponto B'}.
    Clientes:
    ${clients.map((c) => `- ID: ${c.id} | Local: ${c.address}, ${c.neighborhood}`).join('\n')}
    Retorne apenas o array JSON de IDs.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
    return clients.map(c => c.id);
  }
};