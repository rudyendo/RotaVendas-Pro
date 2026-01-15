
import { GoogleGenAI, Type } from "@google/genai";
import { Client } from "../types";

/**
 * Obtém a chave de API de forma segura para o ambiente do navegador.
 */
const getApiKey = (): string => {
  try {
    // Tenta acessar process.env de forma segura
    const key = (typeof process !== 'undefined' && process.env?.API_KEY) ? process.env.API_KEY : undefined;
    return key || "";
  } catch (e) {
    return "";
  }
};

/**
 * Inicializa o cliente GenAI.
 */
const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY não configurada. Por favor, adicione a variável de ambiente no painel de controle.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Extrai clientes de um PDF usando IA Gemini 3 Pro.
 */
export const extractClientsFromPDF = async (base64Pdf: string): Promise<Client[]> => {
  const ai = getAiClient();
  
  try {
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
            text: "Analise este documento PDF e extraia todos os registros de clientes. Para cada cliente, identifique: nome, endereço completo, bairro, cidade, estado e whatsapp. Retorne APENAS um array JSON puro. Se faltar o DDD no WhatsApp, use 84.",
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
      // Adiciona coordenadas simuladas baseadas em Natal/RN se a IA não fornecer
      lat: -5.79448 + (Math.random() - 0.5) * 0.08,
      lng: -35.211 + (Math.random() - 0.5) * 0.08,
    }));
  } catch (error: any) {
    console.error("Erro detalhado do Gemini:", error);
    throw new Error(error.message || "Falha na comunicação com o servidor de IA.");
  }
};

/**
 * Otimiza a rota usando inteligência geográfica.
 */
export const optimizeRoute = async (clients: Client[]): Promise<string[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Como um especialista em logística, organize estes ${clients.length} clientes na melhor ordem de visitação para economizar tempo e combustível.
    
    Clientes:
    ${clients.map((c) => `- ID: ${c.id} | Local: ${c.address}, ${c.neighborhood}, ${c.city}`).join('\n')}
    
    Retorne um array JSON com os IDs na ordem correta.
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
    return Array.isArray(result) && result.length > 0 ? result : clients.map(c => c.id);
  } catch (error) {
    console.warn("Falha na otimização via IA, usando ordem padrão:", error);
    return clients.map(c => c.id);
  }
};
