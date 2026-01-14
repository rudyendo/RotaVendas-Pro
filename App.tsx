
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  Users, 
  Navigation, 
  FileUp, 
  CheckCircle2, 
  MapPin, 
  Trash2, 
  Package, 
  ArrowRight, 
  Settings, 
  LocateFixed, 
  AlertCircle, 
  X, 
  Loader2, 
  Check, 
  ExternalLink, 
  ShieldAlert,
  Key,
  MessageCircle
} from 'lucide-react';
import { Client, AppStep, RouteStop } from './types';
import { extractClientsFromPDF, optimizeRoute } from './services/geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Made aistudio optional to match potential ambient declarations and avoid modifier mismatch errors
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.DATABASE);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [startAddress, setStartAddress] = useState<string>('');
  const [endAddress, setEndAddress] = useState<string>('');
  const [optimizedRoute, setOptimizedRoute] = useState<RouteStop[]>([]);
  const [currentTip, setCurrentTip] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [hasApiKey, setHasApiKey] = useState<boolean>(!!process.env.API_KEY);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        if (selected) setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      setErrorMessage(null);
    } else {
      setErrorMessage("Interface de seleção de chave não encontrada. Certifique-se de que a variável API_KEY está configurada no seu ambiente de deploy.");
    }
  };

  const loadingMessages = [
    "Lendo o conteúdo do seu PDF...",
    "Identificando nomes e endereços...",
    "Validando localizações...",
    "Calculando coordenadas geográficas...",
    "Organizando sua base de clientes...",
    "Quase pronto, finalizando a extração..."
  ];

  const tips = [
    "Dica: Tente agrupar clientes por bairro para economizar combustível.",
    "Dica: Otimize sua rota para evitar horários de pico.",
    "Dica: Verifique se o PDF está legível para uma extração mais rápida.",
    "Dica: Você pode editar o endereço de partida a qualquer momento."
  ];

  useEffect(() => {
    let interval: number;
    let tipInterval: number;
    if (loading) {
      let i = 0;
      setStatusMessage(loadingMessages[0]);
      interval = window.setInterval(() => {
        i = (i + 1) % loadingMessages.length;
        setStatusMessage(loadingMessages[i]);
      }, 3500);

      tipInterval = window.setInterval(() => {
        setCurrentTip(prev => (prev + 1) % tips.length);
      }, 6000);
    }
    return () => {
      clearInterval(interval);
      clearInterval(tipInterval);
    };
  }, [loading]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          const extracted = await extractClientsFromPDF(base64);
          
          if (extracted.length === 0) {
            setErrorMessage("Não encontramos clientes válidos. Verifique o documento.");
          } else {
            setClients(prev => [...prev, ...extracted]);
            setStep(AppStep.DATABASE);
          }
        } catch (err: any) {
          // Erro amigável para falta de chave
          if (err.message.includes("API_KEY")) {
            setErrorMessage("Erro de Configuração: A chave de API não foi detectada. Verifique se as variáveis de ambiente foram configuradas corretamente e se o deploy foi atualizado.");
          } else {
            setErrorMessage(err.message || "Falha ao processar dados.");
          }
        } finally {
          setLoading(false);
          if (event.target) event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMessage("Erro inesperado ao carregar arquivo.");
      setLoading(false);
    }
  };

  const neighborhoods = useMemo(() => {
    const set = new Set(clients.map(c => c.neighborhood).filter(Boolean));
    return Array.from(set).sort();
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!selectedNeighborhood) return [];
    return clients.filter(c => c.neighborhood === selectedNeighborhood);
  }, [clients, selectedNeighborhood]);

  const toggleClientSelection = useCallback((id: string) => {
    setSelectedClientIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const selectAllInNeighborhood = () => {
    const ids = filteredClients.map(c => c.id);
    setSelectedClientIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const calculateRoute = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const clientsToVisit = clients.filter(c => selectedClientIds.includes(c.id));
      const orderedIds = await optimizeRoute(startAddress, endAddress, clientsToVisit);
      const orderedList: RouteStop[] = orderedIds.map((id, index) => {
        const client = clients.find(c => c.id === id)!;
        return { ...client, stopOrder: index + 1 };
      });
      setOptimizedRoute(orderedList);
      setStep(AppStep.ROUTE);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao calcular rota.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <Navigation className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
            RotaVendas Pro
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200">
          {[
            { step: AppStep.DATABASE, label: 'Clientes' },
            { step: AppStep.PLANNER, label: 'Planejador' },
            { step: AppStep.ROUTE, label: 'Rota', hidden: optimizedRoute.length === 0 }
          ].map((item) => !item.hidden && (
            <button 
              key={item.step}
              onClick={() => setStep(item.step)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${step === item.step ? 'bg-white shadow-sm text-blue-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!hasApiKey && !process.env.API_KEY && (
             <button 
              onClick={handleOpenKeySelector}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 hover:bg-amber-100 transition-colors"
             >
               <Key className="w-3.5 h-3.5" /> Vincular Chave IA
             </button>
          )}
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {errorMessage && (
          <div className="max-w-4xl mx-auto mb-8 p-6 bg-red-50 rounded-3xl border border-red-200 text-red-900 shadow-xl flex items-start gap-4 animate-in slide-in-from-top duration-300">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold">Houve um problema</h3>
              <p className="text-sm opacity-90">{errorMessage}</p>
              {errorMessage.includes("API_KEY") && (
                <div className="mt-4 flex gap-3">
                  <button onClick={handleOpenKeySelector} className="text-xs font-black bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all">Tentar Vincular Manualmente</button>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs font-bold text-red-600 hover:underline">Ver Billing</a>
                </div>
              )}
            </div>
            <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-black/5 rounded-full"><X className="w-5 h-5" /></button>
          </div>
        )}

        {step === AppStep.DATABASE && (
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Base de Clientes</h2>
                <p className="text-slate-500 font-medium">Você possui <span className="text-blue-600 font-bold">{clients.length}</span> clientes cadastrados.</p>
              </div>
              <div className="flex gap-3">
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  disabled={loading}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                  disabled={loading}
                >
                  <FileUp className="w-5 h-5" /> Importar PDF
                </button>
                <button 
                  onClick={() => setStep(AppStep.PLANNER)} 
                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Navigation className="w-5 h-5" /> Planejar Visitas
                </button>
              </div>
            </div>

            {clients.length === 0 && !loading ? (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-20 text-center shadow-xl">
                 <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users className="w-10 h-10 text-blue-400" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-800 mb-2">Sua lista está vazia</h3>
                 <p className="text-slate-500 max-w-sm mx-auto mb-8">Importe um arquivo PDF contendo os dados dos seus clientes para começar a otimizar suas rotas.</p>
                 <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                 >
                    <PlusCircle className="w-5 h-5" /> Começar Importação
                 </button>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-5">Cliente</th>
                        <th className="px-6 py-5">Endereço</th>
                        <th className="px-6 py-5">Bairro</th>
                        <th className="px-6 py-5">Localidade</th>
                        <th className="px-6 py-5">WhatsApp</th>
                        <th className="px-6 py-5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clients.map((client) => (
                        <tr key={client.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-6 font-bold text-slate-800">{client.name}</td>
                          <td className="px-6 py-6 text-sm text-slate-600">{client.address}</td>
                          <td className="px-6 py-6"><span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg uppercase">{client.neighborhood}</span></td>
                          <td className="px-6 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-800">{client.city}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{client.state}, {client.country}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <a 
                              href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all font-bold text-xs"
                            >
                              <MessageCircle className="w-4 h-4" /> {client.whatsapp}
                            </a>
                          </td>
                          <td className="px-6 py-6 text-right">
                            <button onClick={() => setClients(clients.filter(c => c.id !== client.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === AppStep.PLANNER && (
          <div className="h-full flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
            <div className="w-full md:w-96 flex flex-col gap-6 shrink-0">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl space-y-6">
                <h3 className="font-black text-slate-900 text-xl flex items-center gap-2">Região</h3>
                <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={selectedNeighborhood} onChange={(e) => setSelectedNeighborhood(e.target.value)}>
                  <option value="">Selecione o Bairro...</option>
                  {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {selectedNeighborhood && (
                  <button onClick={selectAllInNeighborhood} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Selecionar Todo o Bairro</button>
                )}
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl space-y-4">
                <input type="text" placeholder="Endereço de Partida" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} />
                <input type="text" placeholder="Endereço de Chegada" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} />
                <button disabled={selectedClientIds.length === 0 || loading} onClick={calculateRoute} className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-blue-700 disabled:opacity-30 shadow-xl shadow-blue-200 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Otimizar Rota"}
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-black text-slate-900 text-xl">Visitas</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                {selectedNeighborhood ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredClients.map((client) => {
                      const isSelected = selectedClientIds.includes(client.id);
                      return (
                        <div 
                          key={client.id}
                          onClick={() => toggleClientSelection(client.id)}
                          className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex gap-4 ${isSelected ? 'border-blue-600 bg-white shadow-xl' : 'border-white bg-white hover:border-slate-200'}`}
                        >
                          <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800">{client.name}</h4>
                            <p className="text-xs text-slate-500">{client.address}, {client.city}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 font-bold">Selecione um bairro lateral.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === AppStep.ROUTE && (
          <div className="max-w-4xl mx-auto pb-20">
            <h2 className="text-4xl font-black text-slate-900 mb-10 tracking-tight">Rota Otimizada</h2>
            <div className="space-y-6">
              {optimizedRoute.map((stop, idx) => (
                <div key={stop.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl flex items-start gap-6 relative group transition-all hover:translate-x-1">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black">{idx + 1}</div>
                  <div className="flex-1">
                    <h4 className="font-black text-xl text-slate-800">{stop.name}</h4>
                    <p className="text-sm text-slate-500 mb-6">{stop.address}, {stop.neighborhood}, {stop.city}</p>
                    <div className="flex gap-3">
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address}, ${stop.neighborhood}, ${stop.city}, ${stop.state}, ${stop.country}`)}`} target="_blank" rel="noreferrer" className="bg-slate-900 text-white text-[10px] font-black px-6 py-3 rounded-xl uppercase tracking-widest inline-flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Google Maps
                      </a>
                      <a href={`https://wa.me/${stop.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="bg-green-600 text-white text-[10px] font-black px-6 py-3 rounded-xl uppercase tracking-widest inline-flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 border-8 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-8"></div>
          <h3 className="text-2xl font-black mb-2">IA Processando...</h3>
          <p className="text-blue-600 font-bold">{statusMessage}</p>
          <p className="mt-10 text-slate-400 italic text-sm">"{tips[currentTip]}"</p>
        </div>
      )}
    </div>
  );
};

export default App;
