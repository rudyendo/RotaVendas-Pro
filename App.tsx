
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  Navigation, 
  FileUp, 
  MapPin, 
  Trash2, 
  Edit2,
  Save,
  AlertCircle, 
  X, 
  Loader2, 
  Check, 
  MessageCircle,
  Key,
  ChevronRight,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { Client, AppStep, RouteStop } from './types';
import { extractClientsFromPDF, optimizeRoute } from './services/geminiService';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.DATABASE);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<RouteStop[]>([]);
  const [currentTip, setCurrentTip] = useState(0);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const envKey = process.env.API_KEY;
  const isApiKeyReady = !!(envKey && envKey !== "undefined" && envKey.length > 5);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Analisando PDF...");
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

  const calculateRouteWithAI = async () => {
    if (selectedClientIds.length === 0) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Calculando rota...");
    try {
      const clientsToVisit = clients.filter(c => selectedClientIds.includes(c.id));
      const orderedIds = await optimizeRoute("", "", clientsToVisit);
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
    "A IA Flash é 2x mais rápida na extração de dados.",
    "Certifique-se de definir API_KEY no Vercel.",
    "Bairros organizados facilitam o roteiro.",
    "Rotas inteligentes salvam tempo e combustível."
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => setCurrentTip(prev => (prev + 1) % tips.length), 3500);
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
            <button 
              onClick={() => setStep(AppStep.DATABASE)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold ${step === AppStep.DATABASE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              Clientes
            </button>
            <button 
              onClick={() => setStep(AppStep.PLANNER)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold ${step === AppStep.PLANNER ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              Planejador
            </button>
          </nav>
        )}
        
        <div className="flex items-center gap-2">
          {!isApiKeyReady ? (
            <div className="px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase">Offline</div>
          ) : (
            <div className="px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> IA Ativa
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {!isApiKeyReady ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-8 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
            <div className="space-y-3">
              <h2 className="text-2xl font-black">Configuração Pendente</h2>
              <p className="text-slate-500 text-sm">
                Adicione a variável de ambiente <strong>API_KEY</strong> no painel do Vercel com a chave que você possui.
              </p>
            </div>
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
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">Base de Clientes</h2>
                  <div className="flex gap-3">
                    <input type="file" className="hidden" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} />
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50"
                    >
                      <FileUp className="w-5 h-5" /> Importar PDF
                    </button>
                    <button 
                      onClick={() => setStep(AppStep.PLANNER)} 
                      className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700"
                    >
                      <Navigation className="w-5 h-5 inline mr-2" /> Planejar Visitas
                    </button>
                  </div>
                </div>

                {clients.length === 0 ? (
                  <div className="bg-white rounded-[2.5rem] p-24 text-center border border-slate-200">
                    <Users className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                    <p className="text-slate-500 font-medium">Sua lista está vazia. Suba um PDF para começar.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                        <tr>
                          <th className="px-8 py-5">Nome</th>
                          <th className="px-8 py-5">Endereço</th>
                          <th className="px-8 py-5">WhatsApp</th>
                          <th className="px-8 py-5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clients.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-8 py-5 font-bold text-slate-800">{c.name}</td>
                            <td className="px-8 py-5 text-sm text-slate-500">
                              {c.address} <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded ml-2 uppercase">{c.neighborhood}</span>
                            </td>
                            <td className="px-8 py-5 text-sm text-green-600 font-bold">{c.whatsapp}</td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingClient(c)} className="p-2 text-slate-300 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                                <button 
                                  onClick={() => setClients(prev => prev.filter(x => x.id !== c.id))} 
                                  className="p-2 text-slate-300 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                    <h3 className="font-black text-lg">Região</h3>
                    <select 
                      className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" 
                      value={selectedNeighborhood} 
                      onChange={e => setSelectedNeighborhood(e.target.value)}
                    >
                      <option value="">Todos os Bairros</option>
                      {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button 
                    onClick={calculateRouteWithAI} 
                    disabled={selectedClientIds.length === 0 || loading} 
                    className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl disabled:opacity-30"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Gerar Rota"}
                  </button>
                </div>
                <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                  <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black">Visitas ({selectedClientIds.length})</h3>
                    {selectedClientIds.length > 0 && <button onClick={() => setSelectedClientIds([])} className="text-xs font-bold text-red-500 uppercase">Limpar</button>}
                  </div>
                  <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto">
                    {filteredClients.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedClientIds(prev => prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id])} 
                        className={`p-6 rounded-2xl border-2 cursor-pointer flex gap-4 transition-all ${selectedClientIds.includes(c.id) ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 mt-1 flex items-center justify-center ${selectedClientIds.includes(c.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                          {selectedClientIds.includes(c.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-bold truncate text-slate-800">{c.name}</h4>
                          <p className="text-xs text-slate-500 truncate">{c.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === AppStep.ROUTE && (
              <div className="max-w-3xl mx-auto space-y-6 pb-20">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-3xl font-black">Roteiro Otimizado</h2>
                  <button onClick={() => setStep(AppStep.PLANNER)} className="text-blue-600 font-bold">Editar Visitas</button>
                </div>
                {optimizedRoute.map((stop, idx) => (
                  <div key={stop.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-md flex items-center gap-8">
                    <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shrink-0">{idx + 1}</div>
                    <div className="flex-1">
                      <h4 className="font-black text-xl text-slate-800">{stop.name}</h4>
                      <p className="text-sm text-slate-500 mb-6">{stop.address}, {stop.neighborhood}</p>
                      <div className="flex gap-3">
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`} 
                          target="_blank" 
                          className="px-6 py-3 bg-slate-900 text-white text-[11px] font-black rounded-xl uppercase tracking-widest flex items-center gap-2"
                        >
                          <MapPin className="w-4 h-4" /> GPS
                        </a>
                        <a 
                          href={`https://wa.me/${stop.whatsapp.replace(/\D/g, '')}`} 
                          target="_blank" 
                          className="px-6 py-3 bg-green-600 text-white text-[11px] font-black rounded-xl uppercase tracking-widest flex items-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black">Editar Dados</h3>
              <button onClick={() => setEditingClient(null)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-10 space-y-5">
              <input 
                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" 
                value={editingClient.name} 
                onChange={e => setEditingClient({...editingClient, name: e.target.value})} 
                placeholder="Nome Fantasia" 
              />
              <input 
                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl" 
                value={editingClient.address} 
                onChange={e => setEditingClient({...editingClient, address: e.target.value})} 
                placeholder="Logradouro" 
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl" 
                  value={editingClient.neighborhood} 
                  onChange={e => setEditingClient({...editingClient, neighborhood: e.target.value})} 
                  placeholder="Bairro" 
                />
                <input 
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" 
                  value={editingClient.whatsapp} 
                  onChange={e => setEditingClient({...editingClient, whatsapp: e.target.value})} 
                  placeholder="WhatsApp" 
                />
              </div>
              <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700">
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[1000] flex flex-col items-center justify-center text-center p-8">
          <div className="relative mb-10">
            <div className="w-24 h-24 border-8 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <h3 className="text-2xl font-black mb-2 tracking-tight">Processando Inteligência</h3>
          <p className="text-blue-600 font-bold mb-8">{statusMessage}</p>
          <p className="text-xs text-slate-400 font-medium italic max-w-xs">"{tips[currentTip]}"</p>
        </div>
      )}
    </div>
  );
};

export default App;
