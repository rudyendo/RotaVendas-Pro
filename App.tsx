
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
  ShieldAlert,
  Sparkles,
  ChevronRight,
  Map as MapIcon
} from 'lucide-react';
import { Client, AppStep, RouteStop } from './types';
import { extractClientsFromPDF, optimizeRoute } from './services/geminiService';
import MapView from './components/MapView';

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
  
  // Detecção robusta da chave de API
  const isApiKeyReady = useMemo(() => {
    try {
      const key = (typeof process !== 'undefined' && process.env?.API_KEY);
      return !!(key && key !== "undefined" && key.length > 10);
    } catch (e) {
      return false;
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Extraindo dados com Gemini 3 Pro...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          const extracted = await extractClientsFromPDF(base64);
          if (extracted && extracted.length > 0) {
            setClients(prev => [...prev, ...extracted]);
          } else {
            throw new Error("Nenhum dado legível no PDF.");
          }
        } catch (err: any) {
          setErrorMessage(err.message || "Erro na IA. Verifique sua chave.");
        } finally {
          setLoading(false);
          if (event.target) event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      setErrorMessage("Falha ao ler arquivo local.");
    }
  };

  const toggleClientSelection = (id: string) => {
    setSelectedClientIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const calculateRouteWithAI = async () => {
    if (selectedClientIds.length === 0) return;
    
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("A IA está calculando a melhor rota...");

    try {
      const clientsToVisit = clients.filter(c => selectedClientIds.includes(c.id));
      const orderedIds = await optimizeRoute(clientsToVisit);
      
      const orderedList: RouteStop[] = orderedIds.map((id, index) => {
        const client = clients.find(c => c.id === id);
        return client ? { ...client, stopOrder: index + 1 } : null;
      }).filter(Boolean) as RouteStop[];

      setOptimizedRoute(orderedList);
      setStep(AppStep.ROUTE);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao otimizar rota.");
    } finally {
      setLoading(false);
    }
  };

  const neighborhoods = useMemo(() => {
    return Array.from(new Set(clients.map(c => c.neighborhood).filter(Boolean))).sort();
  }, [clients]);

  const filteredClients = useMemo(() => {
    return selectedNeighborhood ? clients.filter(c => c.neighborhood === selectedNeighborhood) : clients;
  }, [clients, selectedNeighborhood]);

  const tips = [
    "Gemini 3 Pro é ideal para ler tabelas de PDFs.",
    "A chave de API deve estar no painel do Vercel.",
    "Clique no mapa para selecionar os clientes da rota.",
    "Endereços bem formatados geram rotas melhores."
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => setCurrentTip(prev => (prev + 1) % tips.length), 3000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-[100]">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-200">
            <Navigation className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tighter">ROTA<span className="text-blue-600">PRO</span></h1>
        </div>
        
        {isApiKeyReady && (
          <nav className="hidden md:flex gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => setStep(AppStep.DATABASE)} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${step === AppStep.DATABASE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>Clientes</button>
            <button onClick={() => setStep(AppStep.PLANNER)} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${step === AppStep.PLANNER ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>Mapa e Planejador</button>
          </nav>
        )}
        
        <div className="flex items-center gap-2">
          {!isApiKeyReady ? (
            <div className="px-4 py-2 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase border border-red-100 flex items-center gap-2">
              <ShieldAlert className="w-3 h-3" /> API Ausente
            </div>
          ) : (
            <div className="px-4 py-2 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase flex items-center gap-2 border border-green-100">
              <Sparkles className="w-3 h-3" /> IA Pronta
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {!isApiKeyReady ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center space-y-8 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-500">
              <Key className="w-20 h-20 text-amber-500 mx-auto" />
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-900 leading-tight">Aguardando Chave</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Para o sistema funcionar, adicione sua <strong>API_KEY</strong> nas configurações do projeto (Environment Variables).
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full relative">
            {errorMessage && (
              <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] w-full max-w-xl px-4 animate-in slide-in-from-top-4">
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center justify-between border border-red-200 shadow-xl">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">{errorMessage}</span>
                  </div>
                  <button onClick={() => setErrorMessage(null)} className="p-2 hover:bg-red-100 rounded-full"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            {step === AppStep.DATABASE && (
              <div className="h-full overflow-y-auto p-4 md:p-8 space-y-8">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900">Carteira de Clientes</h2>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Status: {clients.length} sincronizados</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <input type="file" className="hidden" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} disabled={loading} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none px-8 py-4 bg-white border-2 border-slate-200 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">
                      <FileUp className="w-5 h-5" /> Importar PDF
                    </button>
                    <button onClick={() => setStep(AppStep.PLANNER)} className="flex-1 sm:flex-none px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center">
                      Planejar <ChevronRight className="w-5 h-5 ml-1" />
                    </button>
                  </div>
                </div>

                <div className="max-w-7xl mx-auto">
                  {clients.length === 0 ? (
                    <div className="bg-white rounded-[4rem] p-32 text-center border-2 border-dashed border-slate-200">
                      <Users className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                      <h3 className="text-2xl font-black text-slate-800">Sua base está vazia</h3>
                      <p className="text-slate-400 mt-2 max-w-xs mx-auto font-medium">Suba um relatório de clientes em PDF para a IA processar os dados automaticamente.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                            <tr>
                              <th className="px-10 py-6">Cliente</th>
                              <th className="px-10 py-6">Localização</th>
                              <th className="px-10 py-6">WhatsApp</th>
                              <th className="px-10 py-6 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {clients.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50 transition-all group">
                                <td className="px-10 py-8 font-black text-slate-800 text-lg">{c.name}</td>
                                <td className="px-10 py-8">
                                  <div className="text-sm text-slate-600 font-bold">{c.address}</div>
                                  <div className="text-[10px] font-black text-blue-500 bg-blue-50 px-2.5 py-1 rounded-lg mt-2 inline-block uppercase tracking-wider">{c.neighborhood}</div>
                                </td>
                                <td className="px-10 py-8">
                                  <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-2 text-green-600 font-black text-sm hover:underline">
                                    <MessageCircle className="w-5 h-5" /> {c.whatsapp}
                                  </a>
                                </td>
                                <td className="px-10 py-8 text-right">
                                  <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingClient(c)} className="p-3 bg-white text-slate-400 hover:text-blue-600 rounded-2xl shadow-sm border border-slate-100"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => setClients(prev => prev.filter(x => x.id !== c.id))} className="p-3 bg-white text-slate-400 hover:text-red-600 rounded-2xl shadow-sm border border-slate-100"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === AppStep.PLANNER && (
              <div className="h-full flex flex-col md:flex-row">
                {/* Lateral de Controle */}
                <div className="w-full md:w-[400px] bg-white border-r border-slate-200 flex flex-col shadow-2xl z-20">
                  <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                    <div>
                      <h3 className="font-black text-2xl tracking-tighter">Planejador</h3>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Selecione os pontos no mapa</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Filtrar por Bairro</label>
                        <select className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm outline-none focus:border-blue-500 transition-all cursor-pointer" value={selectedNeighborhood} onChange={e => setSelectedNeighborhood(e.target.value)}>
                          <option value="">Todos os Bairros</option>
                          {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Selecionados</span>
                        <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg">{selectedClientIds.length}</span>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {filteredClients.map(c => (
                          <div key={c.id} onClick={() => toggleClientSelection(c.id)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${selectedClientIds.includes(c.id) ? 'border-blue-600 bg-blue-50/50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedClientIds.includes(c.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                              {selectedClientIds.includes(c.id) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="font-bold text-sm text-slate-800 truncate leading-none mb-1">{c.name}</h4>
                              <p className="text-[10px] text-slate-500 truncate">{c.neighborhood}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-8 border-t border-slate-100 bg-slate-50/50">
                    <button onClick={calculateRouteWithAI} disabled={selectedClientIds.length === 0 || loading} className="w-full py-5 bg-blue-600 text-white font-black rounded-3xl shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-30 transition-all flex items-center justify-center gap-3">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Otimizar Visitas</>}
                    </button>
                    <button onClick={() => setStep(AppStep.DATABASE)} className="w-full mt-4 py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600">Voltar para Base</button>
                  </div>
                </div>

                {/* Mapa Interativo */}
                <div className="flex-1 relative bg-slate-200">
                  <MapView 
                    clients={filteredClients} 
                    selectedClients={selectedClientIds} 
                    onToggleClient={toggleClientSelection} 
                  />
                  <div className="absolute top-6 left-6 bg-white/90 backdrop-blur px-5 py-3 rounded-2xl border border-slate-200 shadow-xl z-[1000] flex items-center gap-3 pointer-events-none">
                    <MapIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black uppercase tracking-widest">Mapa Ativo</span>
                  </div>
                </div>
              </div>
            )}

            {step === AppStep.ROUTE && (
              <div className="h-full overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-12 pb-24 animate-in slide-in-from-bottom-12 duration-700">
                  <div className="flex flex-col sm:flex-row justify-between items-end gap-4 border-b-4 border-slate-100 pb-10">
                    <div className="space-y-2">
                      <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Roteiro do Dia</h2>
                      <p className="text-blue-600 font-black uppercase text-xs tracking-[0.2em] px-1">Otimizado por IA Flash</p>
                    </div>
                    <button onClick={() => setStep(AppStep.PLANNER)} className="bg-white border-2 border-slate-200 px-8 py-3 rounded-2xl font-black text-xs text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all uppercase tracking-widest shadow-sm">Editar Visitas</button>
                  </div>

                  <div className="space-y-8 relative">
                    <div className="absolute left-[31px] top-12 bottom-12 w-1.5 bg-slate-100 -z-10 rounded-full"></div>
                    {optimizedRoute.map((stop, idx) => (
                      <div key={stop.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex items-start gap-10 hover:translate-x-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center font-black text-3xl shrink-0 shadow-2xl shadow-blue-200 ring-[10px] ring-white">{idx + 1}</div>
                        <div className="flex-1">
                          <h4 className="font-black text-3xl text-slate-800 tracking-tight leading-none mb-2">{stop.name}</h4>
                          <p className="text-slate-400 font-bold text-lg mb-8">{stop.address}, {stop.neighborhood}</p>
                          <div className="flex flex-wrap gap-4">
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address}, ${stop.city}`)}`} target="_blank" rel="noreferrer" className="px-10 py-5 bg-slate-900 text-white text-[11px] font-black rounded-[1.2rem] uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95">
                              <MapPin className="w-5 h-5" /> Abrir no GPS
                            </a>
                            <a href={`https://wa.me/${stop.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="px-10 py-5 bg-green-600 text-white text-[11px] font-black rounded-[1.2rem] uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-green-700 transition-all shadow-xl active:scale-95">
                              <MessageCircle className="w-5 h-5" /> WhatsApp
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setStep(AppStep.DATABASE)} className="w-full py-8 border-4 border-dashed border-slate-200 rounded-[3rem] text-slate-300 font-black text-xl hover:border-blue-300 hover:text-blue-400 transition-all uppercase tracking-widest group">
                    <span className="group-hover:scale-105 inline-block transition-transform">Finalizar Atendimento</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE EDIÇÃO */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in duration-500">
            <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Editar Cadastro</h3>
              <button onClick={() => setEditingClient(null)} className="p-4 hover:bg-slate-200 rounded-3xl transition-all"><X className="w-8 h-8 text-slate-400" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setClients(prev => prev.map(c => c.id === editingClient.id ? editingClient : c)); setEditingClient(null); }} className="p-12 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Fantasia</label>
                <input required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-blue-500 font-black text-lg" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Logradouro</label>
                <input required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-blue-500 font-bold" value={editingClient.address} onChange={e => setEditingClient({...editingClient, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bairro</label>
                  <input required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-blue-500 font-black" value={editingClient.neighborhood} onChange={e => setEditingClient({...editingClient, neighborhood: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">WhatsApp</label>
                  <input required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-blue-500 font-black" value={editingClient.whatsapp} onChange={e => setEditingClient({...editingClient, whatsapp: e.target.value})} />
                </div>
              </div>
              <div className="pt-6 flex gap-6">
                <button type="button" onClick={() => setEditingClient(null)} className="flex-1 py-6 bg-slate-100 text-slate-500 font-black rounded-3xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs">Cancelar</button>
                <button type="submit" className="flex-2 py-6 bg-blue-600 text-white font-black rounded-3xl shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest text-xs">
                  <Save className="w-5 h-5" /> Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOADER GLOBAL */}
      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-2xl z-[9999] flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-500">
          <div className="relative mb-12">
            <div className="w-40 h-40 border-[12px] border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto w-16 h-16 text-blue-600 animate-pulse" />
          </div>
          <h3 className="text-4xl font-black mb-4 tracking-tighter">Processamento IA</h3>
          <p className="text-blue-600 font-black mb-12 text-xl tracking-tight">{statusMessage}</p>
          <div className="max-w-sm p-8 bg-slate-50 rounded-[3rem] border-2 border-slate-100 shadow-xl">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mb-3 italic">Did you know?</p>
            <p className="text-lg text-slate-700 font-bold leading-tight italic">"{tips[currentTip]}"</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
