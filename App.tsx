
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  Navigation, 
  FileUp, 
  MapPin, 
  Trash2, 
  Edit2,
  Save,
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
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const envKey = process.env.API_KEY;
  const hasValidEnvKey = envKey && envKey !== "undefined" && envKey !== "" && envKey.length > 10;
  const [isApiKeyReady, setIsApiKeyReady] = useState<boolean>(!!hasValidEnvKey);

  useEffect(() => {
    const checkKey = async () => {
      if (hasValidEnvKey) {
        setIsApiKeyReady(true);
        return;
      }
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) setIsApiKeyReady(true);
        } catch (e) {}
      }
    };
    checkKey();
    const interval = setInterval(checkKey, 3000);
    return () => clearInterval(interval);
  }, [hasValidEnvKey]);

  const handleConnectKey = async () => {
    setErrorMessage(null);
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setIsApiKeyReady(true);
      } else if (hasValidEnvKey) {
        setIsApiKeyReady(true);
      } else {
        setErrorMessage("Chave não encontrada. No Vercel, adicione a variável de ambiente API_KEY.");
      }
    } catch (err) {
      setErrorMessage("Erro ao conectar.");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("A IA Pro está processando seu PDF...");
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          const extracted = await extractClientsFromPDF(base64);
          setClients(prev => [...prev, ...extracted]);
        } catch (err: any) {
          setErrorMessage(err.message);
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

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setClients(prev => prev.map(c => c.id === editingClient.id ? editingClient : c));
    setEditingClient(null);
  };

  const handleDeleteClient = (id: string) => {
    if (confirm("Excluir cliente?")) {
      setClients(prev => prev.filter(c => c.id !== id));
      setSelectedClientIds(prev => prev.filter(i => i !== id));
    }
  };

  const calculateRouteWithAI = async () => {
    if (selectedClientIds.length === 0) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Otimizando com Gemini 3 Pro...");
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
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const neighborhoods = useMemo(() => Array.from(new Set(clients.map(c => c.neighborhood))).sort(), [clients]);
  const filteredClients = useMemo(() => selectedNeighborhood ? clients.filter(c => c.neighborhood === selectedNeighborhood) : clients, [clients, selectedNeighborhood]);

  const tips = [
    "A IA Pro analisa endereços melhor que o motor Flash.",
    "Certifique-se de definir a variável API_KEY nas configurações do Vercel.",
    "O mapa requer conexão com a internet para carregar os blocos.",
    "Rotas inteligentes podem poupar horas de trabalho por dia."
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => setCurrentTip(prev => (prev + 1) % tips.length), 4000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Navigation className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black">RotaVendas Pro</h1>
        </div>
        {isApiKeyReady && (
          <nav className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setStep(AppStep.DATABASE)} className={`px-4 py-2 rounded-xl text-xs font-bold ${step === AppStep.DATABASE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Clientes</button>
            <button onClick={() => setStep(AppStep.PLANNER)} className={`px-4 py-2 rounded-xl text-xs font-bold ${step === AppStep.PLANNER ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Planejador</button>
            {optimizedRoute.length > 0 && <button onClick={() => setStep(AppStep.ROUTE)} className={`px-4 py-2 rounded-xl text-xs font-bold ${step === AppStep.ROUTE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Rota</button>}
          </nav>
        )}
        <div className="flex items-center gap-3">
          {!isApiKeyReady ? (
            <button onClick={handleConnectKey} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black animate-pulse">
              <Key className="w-3.5 h-3.5 inline mr-2" /> Conectar IA
            </button>
          ) : (
            <div className="px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase">IA Online</div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {!isApiKeyReady ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-8 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100">
            <ShieldAlert className="w-12 h-12 text-blue-500 mx-auto" />
            <div className="space-y-3">
              <h2 className="text-2xl font-black">Chave de API Ausente</h2>
              <p className="text-slate-500 text-sm">
                A variável de ambiente <strong>API_KEY</strong> não foi encontrada. No Vercel, adicione-a em Settings > Environment Variables.
              </p>
            </div>
            <button onClick={handleConnectKey} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3">
              Configurar Agora <ChevronRight className="w-5 h-5" />
            </button>
            {errorMessage && <p className="text-xs text-red-500 font-bold">{errorMessage}</p>}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl flex items-center justify-between border border-red-100">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-bold">{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage(null)}><X className="w-5 h-5" /></button>
              </div>
            )}

            {step === AppStep.DATABASE && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black">Carteira de Clientes</h2>
                  <div className="flex gap-3">
                    <input type="file" className="hidden" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold flex items-center gap-2"><FileUp className="w-5 h-5" /> Subir PDF</button>
                    <button onClick={() => setStep(AppStep.PLANNER)} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg"><Navigation className="w-5 h-5 inline mr-2" /> Planejar</button>
                  </div>
                </div>

                {clients.length === 0 ? (
                  <div className="bg-white rounded-[2.5rem] p-20 text-center border border-slate-200">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum cliente cadastrado. Use o botão acima para importar um PDF.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                        <tr>
                          <th className="px-6 py-4">Nome</th>
                          <th className="px-6 py-4">Endereço</th>
                          <th className="px-6 py-4">WhatsApp</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clients.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4 font-bold text-slate-800">{c.name}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {c.address} <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded ml-2 uppercase">{c.neighborhood}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-green-600 font-bold">{c.whatsapp}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingClient(c)} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteClient(c.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {step === AppStep.PLANNER && (
              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-80 shrink-0 space-y-6">
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-black text-lg">Filtrar Região</h3>
                    <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={selectedNeighborhood} onChange={e => setSelectedNeighborhood(e.target.value)}>
                      <option value="">Todos os Bairros</option>
                      {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button onClick={calculateRouteWithAI} disabled={selectedClientIds.length === 0 || loading} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 disabled:opacity-30">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Gerar Rota Inteligente"}
                  </button>
                </div>
                <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
                  <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black">Clientes Selecionados ({selectedClientIds.length})</h3>
                  </div>
                  <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto">
                    {filteredClients.map(c => (
                      <div key={c.id} onClick={() => setSelectedClientIds(prev => prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id])} className={`p-4 rounded-2xl border-2 cursor-pointer flex gap-3 transition-all ${selectedClientIds.includes(c.id) ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div className={`w-5 h-5 rounded-full border-2 mt-1 flex items-center justify-center ${selectedClientIds.includes(c.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>{selectedClientIds.includes(c.id) && <Check className="w-3 h-3 text-white" />}</div>
                        <div className="overflow-hidden"><h4 className="font-bold truncate">{c.name}</h4><p className="text-[10px] text-slate-500 truncate">{c.address}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === AppStep.ROUTE && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black">Roteiro do Dia</h2>
                  <button onClick={() => setStep(AppStep.PLANNER)} className="text-blue-600 font-bold text-sm">Editar Visitas</button>
                </div>
                {optimizedRoute.map((stop, idx) => (
                  <div key={stop.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shrink-0">{idx + 1}</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{stop.name}</h4>
                      <p className="text-sm text-slate-500">{stop.address}, {stop.neighborhood}</p>
                      <div className="flex gap-3 mt-4">
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`} target="_blank" className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase">GPS</a>
                        <a href={`https://wa.me/${stop.whatsapp.replace(/\D/g, '')}`} target="_blank" className="px-4 py-2 bg-green-600 text-white text-[10px] font-black rounded-xl uppercase">WhatsApp</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b flex justify-between items-center">
              <h3 className="text-xl font-black">Editar Cliente</h3>
              <button onClick={() => setEditingClient(null)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-8 space-y-4">
              <input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} placeholder="Nome" />
              <input className="w-full p-4 bg-slate-50 border rounded-2xl" value={editingClient.address} onChange={e => setEditingClient({...editingClient, address: e.target.value})} placeholder="Endereço" />
              <div className="grid grid-cols-2 gap-4">
                <input className="w-full p-4 bg-slate-50 border rounded-2xl" value={editingClient.neighborhood} onChange={e => setEditingClient({...editingClient, neighborhood: e.target.value})} placeholder="Bairro" />
                <input className="w-full p-4 bg-slate-50 border rounded-2xl" value={editingClient.whatsapp} onChange={e => setEditingClient({...editingClient, whatsapp: e.target.value})} placeholder="WhatsApp" />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl">Salvar</button>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[1000] flex flex-col items-center justify-center text-center p-8">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <h3 className="text-2xl font-black mb-2">Processando com IA</h3>
          <p className="text-blue-600 font-bold">{statusMessage}</p>
          <p className="mt-8 text-xs text-slate-400 max-w-xs">"{tips[currentTip]}"</p>
        </div>
      )}
    </div>
  );
};

export default App;