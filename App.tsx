
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  Users, 
  Navigation, 
  FileUp, 
  MapPin, 
  Trash2, 
  Settings, 
  AlertCircle, 
  X, 
  Loader2, 
  Check, 
  MessageCircle,
  Key,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Map as MapIcon
} from 'lucide-react';
import { Client, AppStep, RouteStop } from './types';
import { extractClientsFromPDF, optimizeRoute } from './services/geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
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
  
  // Verifica se temos uma chave (pelo ambiente ou pelo seletor)
  const [isApiKeyReady, setIsApiKeyReady] = useState<boolean>(false);

  // Checagem inicial de chave
  useEffect(() => {
    const checkKey = async () => {
      // Se a chave do Vercel (process.env) estiver presente, libera o app
      if (process.env.API_KEY) {
        setIsApiKeyReady(true);
        return;
      }

      // Se houver o objeto aistudio, checa se já foi selecionada
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) {
          setIsApiKeyReady(true);
        }
      }
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
    try {
      if (window.aistudio) {
        // Abre o diálogo do Google
        await window.aistudio.openSelectKey();
        // Regra de Ouro: Assumir sucesso imediatamente para evitar race conditions
        setIsApiKeyReady(true);
        setErrorMessage(null);
      } else {
        // Caso o objeto não esteja disponível (raro em deploy), tentamos forçar o estado 
        // se soubermos que a chave de ambiente deveria estar lá
        if (process.env.API_KEY) {
          setIsApiKeyReady(true);
        } else {
          setErrorMessage("Interface de conexão não detectada. Verifique se o Google AI Studio está configurado.");
        }
      }
    } catch (err) {
      console.error("Erro ao conectar chave:", err);
      setErrorMessage("Erro ao abrir seletor de chaves.");
    }
  };

  const tips = [
    "A IA Gemini Pro está analisando a melhor logística para suas visitas.",
    "Utilizar a IA permite rotas mais inteligentes que apenas a distância linear.",
    "Você pode importar múltiplos PDFs para acumular clientes na base.",
    "Otimizar rotas economiza até 30% de combustível por dia."
  ];

  useEffect(() => {
    let tipInterval: number;
    if (loading) {
      tipInterval = window.setInterval(() => {
        setCurrentTip(prev => (prev + 1) % tips.length);
      }, 5000);
    }
    return () => clearInterval(tipInterval);
  }, [loading]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("A IA está lendo seu PDF...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          const extracted = await extractClientsFromPDF(base64);
          if (extracted.length === 0) {
            setErrorMessage("Nenhum cliente detectado no PDF.");
          } else {
            setClients(prev => [...prev, ...extracted]);
            setStep(AppStep.DATABASE);
          }
        } catch (err: any) {
          if (err.message.includes("entity was not found") || err.message.includes("404")) {
            setIsApiKeyReady(false);
            setErrorMessage("Sua chave expirou ou não foi encontrada. Conecte novamente.");
          } else {
            setErrorMessage("Erro IA: " + err.message);
          }
        } finally {
          setLoading(false);
          if (event.target) event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      setErrorMessage("Erro ao ler arquivo.");
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

  const calculateRouteWithAI = async () => {
    if (selectedClientIds.length === 0) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("IA Gemini Pro calculando rota logística...");

    try {
      const clientsToVisit = clients.filter(c => selectedClientIds.includes(c.id));
      const orderedIds = await optimizeRoute(startAddress, endAddress, clientsToVisit);
      
      const orderedList: RouteStop[] = orderedIds.map((id, index) => {
        const client = clients.find(c => c.id === id);
        return client ? { ...client, stopOrder: index + 1 } : null;
      }).filter(Boolean) as RouteStop[];

      setOptimizedRoute(orderedList);
      setStep(AppStep.ROUTE);
    } catch (err: any) {
      setErrorMessage("Erro na otimização: " + err.message);
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
        
        {isApiKeyReady && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200">
            <button onClick={() => setStep(AppStep.DATABASE)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${step === AppStep.DATABASE ? 'bg-white shadow-sm text-blue-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>Clientes</button>
            <button onClick={() => setStep(AppStep.PLANNER)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${step === AppStep.PLANNER ? 'bg-white shadow-sm text-blue-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>Planejador</button>
            {optimizedRoute.length > 0 && <button onClick={() => setStep(AppStep.ROUTE)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${step === AppStep.ROUTE ? 'bg-white shadow-sm text-blue-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>Rota IA</button>}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {!isApiKeyReady ? (
            <button onClick={handleConnectKey} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black animate-pulse shadow-lg shadow-amber-200">
              <Key className="w-3.5 h-3.5" /> Vincular IA Google
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase">IA Pronta</span>
            </div>
          )}
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {!isApiKeyReady ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-8 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto"><ShieldAlert className="w-12 h-12 text-blue-500" /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Conecte sua Chave</h2>
              <p className="text-slate-500 leading-relaxed text-sm">A IA Gemini Pro precisa de uma chave (mesmo gratuita) para processar seus arquivos PDF com segurança.</p>
            </div>
            
            <div className="space-y-4">
              <button 
                onClick={handleConnectKey} 
                className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                Vincular Agora <ChevronRight className="w-5 h-5" />
              </button>
              
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noreferrer" 
                className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-blue-500 transition-colors"
              >
                Como obter uma chave gratuita?
              </a>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100">
                {errorMessage}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            {errorMessage && (
              <div className="max-w-4xl mx-auto mb-8 p-6 bg-red-50 rounded-3xl border border-red-200 text-red-900 flex items-start gap-4 shadow-sm">
                <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-sm">Atenção</h3>
                  <p className="text-sm opacity-80">{errorMessage}</p>
                </div>
                <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-black/5 rounded-full"><X className="w-5 h-5" /></button>
              </div>
            )}

            {step === AppStep.DATABASE && (
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Base de Clientes</h2>
                    <p className="text-slate-500 font-medium">Você possui <span className="text-blue-600 font-bold">{clients.length}</span> cadastros.</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <input type="file" className="hidden" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} disabled={loading} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="flex-1 sm:flex-none px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"><FileUp className="w-5 h-5" /> Importar PDF</button>
                    <button onClick={() => setStep(AppStep.PLANNER)} className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"><Navigation className="w-5 h-5" /> Planejar</button>
                  </div>
                </div>

                {clients.length === 0 && !loading ? (
                  <div className="bg-white rounded-[2.5rem] border border-slate-200 p-20 text-center shadow-xl">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6"><Users className="w-10 h-10 text-blue-400" /></div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Sua base está vazia</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">Importe o relatório de clientes em PDF para que a IA possa organizar seus dados.</p>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-8 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700">Começar Agora</button>
                  </div>
                ) : (
                  <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                        <tr><th className="px-6 py-5">Cliente</th><th className="px-6 py-5">Endereço</th><th className="px-6 py-5">Bairro</th><th className="px-6 py-5">WhatsApp</th><th className="px-6 py-5 text-right">Ações</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clients.map(client => (
                          <tr key={client.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-6 font-bold text-slate-800">{client.name}</td>
                            <td className="px-6 py-6 text-sm text-slate-600">{client.address}</td>
                            <td className="px-6 py-6"><span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg uppercase">{client.neighborhood}</span></td>
                            <td className="px-6 py-6 font-medium text-green-600">{client.whatsapp}</td>
                            <td className="px-6 py-6 text-right"><button onClick={() => setClients(clients.filter(c => c.id !== client.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {step === AppStep.PLANNER && (
              <div className="h-full flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
                <div className="w-full md:w-96 flex flex-col gap-6 shrink-0">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl space-y-6">
                    <h3 className="font-black text-slate-900 text-xl flex items-center gap-2"><MapIcon className="w-5 h-5 text-blue-600" /> Filtrar Região</h3>
                    <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={selectedNeighborhood} onChange={(e) => setSelectedNeighborhood(e.target.value)}>
                      <option value="">Todos os Bairros...</option>
                      {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {selectedNeighborhood && <button onClick={selectAllInNeighborhood} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Selecionar Todo Bairro</button>}
                  </div>
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl space-y-4">
                    <div className="space-y-3">
                      <input type="text" placeholder="Partida (opcional)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} />
                      <input type="text" placeholder="Retorno (opcional)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} />
                    </div>
                    <button disabled={selectedClientIds.length === 0 || loading} onClick={calculateRouteWithAI} className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-blue-700 disabled:opacity-30 shadow-xl shadow-blue-200 flex items-center justify-center gap-2 transition-all">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Gerar Rota Inteligente</>}
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[500px]">
                  <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 text-xl">Clientes Selecionados ({selectedClientIds.length})</h3>
                    {selectedClientIds.length > 0 && <button onClick={() => setSelectedClientIds([])} className="text-[10px] font-black text-red-500 uppercase">Limpar</button>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {(selectedNeighborhood ? filteredClients : clients).map((client) => {
                        const isSelected = selectedClientIds.includes(client.id);
                        return (
                          <div key={client.id} onClick={() => toggleClientSelection(client.id)} className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex gap-4 ${isSelected ? 'border-blue-600 bg-white shadow-xl scale-[1.02]' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                            <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>{isSelected && <Check className="w-4 h-4 text-white" />}</div>
                            <div className="overflow-hidden"><h4 className="font-black text-slate-800 truncate">{client.name}</h4><p className="text-xs text-slate-500 truncate">{client.address}</p></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === AppStep.ROUTE && (
              <div className="max-w-4xl mx-auto pb-20">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Melhor Rota</h2>
                  <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2"><Sparkles className="w-4 h-4" /> IA Gemini Pro</span>
                </div>
                <div className="space-y-6">
                  {optimizedRoute.map((stop, idx) => (
                    <div key={stop.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl flex items-start gap-6 transition-all hover:translate-x-1">
                      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xl shrink-0">{idx + 1}</div>
                      <div className="flex-1">
                        <h4 className="font-black text-xl text-slate-800">{stop.name}</h4>
                        <p className="text-sm text-slate-500 mb-6">{stop.address}</p>
                        <div className="flex gap-3">
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address}, ${stop.city}`)}`} target="_blank" rel="noreferrer" className="bg-slate-900 text-white text-[10px] font-black px-6 py-3 rounded-xl uppercase flex items-center gap-2"><MapPin className="w-4 h-4" /> Iniciar GPS</a>
                          <a href={`https://wa.me/${stop.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="bg-green-600 text-white text-[10px] font-black px-6 py-3 rounded-xl uppercase flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep(AppStep.PLANNER)} className="mt-12 w-full py-5 border-2 border-dashed border-slate-300 rounded-3xl text-slate-400 font-black hover:border-blue-400 transition-all">Editar Visitas</button>
              </div>
            )}
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center text-center p-8">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-8 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <h3 className="text-2xl font-black mb-2 tracking-tight">Otimizando sua Rota</h3>
          <p className="text-blue-600 font-bold mb-6">{statusMessage}</p>
        </div>
      )}
    </div>
  );
};

export default App;
