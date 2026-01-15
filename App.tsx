
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
  
  // Verifica se a chave está configurada no ambiente
  const apiKey = process.env.API_KEY;
  const isApiKeyReady = !!(apiKey && apiKey !== "undefined" && apiKey.length > 5);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("A IA está analisando seu PDF...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          const extracted = await extractClientsFromPDF(base64);
          if (extracted && extracted.length > 0) {
            setClients(prev => [...prev, ...extracted]);
          } else {
            throw new Error("Nenhum cliente foi detectado no arquivo.");
          }
        } catch (err: any) {
          setErrorMessage(err.message || "Erro desconhecido ao processar PDF.");
        } finally {
          setLoading(false);
          if (event.target) event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      setErrorMessage("Erro ao ler o arquivo local.");
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
    setStatusMessage("Otimizando sequência de visitas...");

    try {
      const clientsToVisit = clients.filter(c => selectedClientIds.includes(c.id));
      const orderedIds = await optimizeRoute(clientsToVisit);
      
      const orderedList: RouteStop[] = orderedIds.map((id, index) => {
        const client = clients.find(c => c.id === id);
        return client ? { ...client, stopOrder: index + 1 } : null;
      }).filter(Boolean) as RouteStop[];

      if (orderedList.length === 0) throw new Error("Não foi possível gerar a rota.");
      
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
    "O Gemini Flash processa PDFs em poucos segundos.",
    "Certifique-se de carregar um PDF com texto legível.",
    "Bairros padronizados melhoram a precisão da rota.",
    "A IA organiza as visitas para reduzir o tempo de deslocamento."
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setCurrentTip(prev => (prev + 1) % tips.length);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-100">
            <Navigation className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight">RotaVendas <span className="text-blue-600">Pro</span></h1>
        </div>
        
        {isApiKeyReady && (
          <nav className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setStep(AppStep.DATABASE)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${step === AppStep.DATABASE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Clientes
            </button>
            <button 
              onClick={() => setStep(AppStep.PLANNER)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${step === AppStep.PLANNER ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Planejador
            </button>
          </nav>
        )}
        
        <div className="flex items-center gap-2">
          {!isApiKeyReady ? (
            <div className="px-4 py-1.5 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase border border-red-100">Offline</div>
          ) : (
            <div className="px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 border border-green-100">
              <Sparkles className="w-3 h-3" /> IA Conectada
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {!isApiKeyReady ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-8 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-300">
            <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto" />
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 leading-tight">Configuração Necessária</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                A variável de ambiente <strong>API_KEY</strong> não foi encontrada. No Vercel, vá em <b>Settings > Environment Variables</b> e adicione sua chave do Gemini.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {errorMessage && (
              <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center justify-between border border-red-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-bold">{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-red-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
            )}

            {step === AppStep.DATABASE && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Base de Clientes</h2>
                    <p className="text-slate-500 font-medium">Total: <span className="text-blue-600 font-bold">{clients.length}</span> registros.</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <input type="file" className="hidden" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} disabled={loading} />
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={loading}
                      className="flex-1 sm:flex-none px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                      <FileUp className="w-5 h-5" /> Importar PDF
                    </button>
                    <button 
                      onClick={() => setStep(AppStep.PLANNER)} 
                      className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center"
                    >
                      <Navigation className="w-5 h-5 mr-2" /> Iniciar Planejamento
                    </button>
                  </div>
                </div>

                {clients.length === 0 && !loading ? (
                  <div className="bg-white rounded-[3rem] p-24 text-center border border-slate-200 shadow-sm animate-in fade-in zoom-in">
                    <Users className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-slate-800">Sua lista está vazia</h3>
                    <p className="text-slate-500 mt-2 max-w-xs mx-auto">Importe um relatório de clientes em PDF para começar a otimizar suas rotas.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                          <tr>
                            <th className="px-8 py-6">Nome / Razão</th>
                            <th className="px-8 py-6">Localização</th>
                            <th className="px-8 py-6">WhatsApp</th>
                            <th className="px-8 py-6 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {clients.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-8 py-6 font-bold text-slate-800">{c.name}</td>
                              <td className="px-8 py-6">
                                <div className="text-sm text-slate-600 font-medium">{c.address}</div>
                                <div className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded mt-1.5 inline-block uppercase tracking-wider">{c.neighborhood}</div>
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                                  <MessageCircle className="w-4 h-4" /> {c.whatsapp}
                                </div>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setEditingClient(c)} className="p-2.5 bg-slate-100 text-slate-400 hover:text-blue-600 rounded-xl transition-all hover:bg-white hover:shadow-sm"><Edit2 className="w-4 h-4" /></button>
                                  <button 
                                    onClick={() => setClients(prev => prev.filter(x => x.id !== c.id))} 
                                    className="p-2.5 bg-slate-100 text-slate-400 hover:text-red-600 rounded-xl transition-all hover:bg-white hover:shadow-sm"
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
                  </div>
                )}
              </div>
            )}

            {step === AppStep.PLANNER && (
              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-80 shrink-0 space-y-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                    <h3 className="font-black text-xl text-slate-900 tracking-tight">Filtrar por Região</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bairro Selecionado</label>
                      <select 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-colors cursor-pointer" 
                        value={selectedNeighborhood} 
                        onChange={e => setSelectedNeighborhood(e.target.value)}
                      >
                        <option value="">Todos os Bairros</option>
                        {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={calculateRouteWithAI} 
                    disabled={selectedClientIds.length === 0 || loading} 
                    className="w-full py-5 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Otimizar Rota</>}
                  </button>
                  <button onClick={() => setStep(AppStep.DATABASE)} className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">Voltar para Clientes</button>
                </div>
                
                <div className="flex-1 bg-white rounded-[3rem] border border-slate-200 overflow-hidden flex flex-col min-h-[500px] shadow-sm">
                  <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-xl">Selecionar Visitas ({selectedClientIds.length})</h3>
                    {selectedClientIds.length > 0 && (
                      <button onClick={() => setSelectedClientIds([])} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline">Limpar Seleção</button>
                    )}
                  </div>
                  <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto max-h-[600px]">
                    {filteredClients.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedClientIds(prev => prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id])} 
                        className={`p-6 rounded-[2rem] border-2 cursor-pointer flex gap-4 transition-all duration-200 ${selectedClientIds.includes(c.id) ? 'border-blue-600 bg-blue-50/20 shadow-sm shadow-blue-50 scale-[1.02]' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white'}`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 mt-1 shrink-0 flex items-center justify-center transition-all ${selectedClientIds.includes(c.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                          {selectedClientIds.includes(c.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-black text-slate-800 truncate leading-tight">{c.name}</h4>
                          <p className="text-xs text-slate-500 truncate mt-1">{c.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === AppStep.ROUTE && (
              <div className="max-w-3xl mx-auto space-y-8 pb-20 animate-in slide-in-from-bottom-8 duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-8">
                  <div className="space-y-1">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Roteiro Sugerido</h2>
                    <p className="text-slate-500 font-medium italic">IA Gemini Flash otimizou esta sequência para você.</p>
                  </div>
                  <button onClick={() => setStep(AppStep.PLANNER)} className="bg-slate-100 px-6 py-2.5 rounded-xl font-black text-xs text-slate-600 hover:bg-slate-200 transition-all uppercase tracking-widest">Ajustar Visitas</button>
                </div>

                <div className="space-y-6 relative">
                  <div className="absolute left-7 top-10 bottom-10 w-1 bg-slate-100 -z-10 rounded-full"></div>
                  {optimizedRoute.map((stop, idx) => (
                    <div key={stop.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-md flex items-start gap-8 hover:translate-x-1 transition-transform">
                      <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shrink-0 shadow-lg shadow-blue-100 ring-8 ring-white">{idx + 1}</div>
                      <div className="flex-1">
                        <h4 className="font-black text-2xl text-slate-800 leading-tight">{stop.name}</h4>
                        <p className="text-slate-500 font-medium mb-8 mt-1.5">{stop.address}, {stop.neighborhood}</p>
                        <div className="flex flex-wrap gap-4">
                          <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address}, ${stop.city}`)}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="px-8 py-4 bg-slate-900 text-white text-[11px] font-black rounded-2xl uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-slate-200 active:scale-95"
                          >
                            <MapPin className="w-4 h-4" /> Traçar Rota GPS
                          </a>
                          <a 
                            href={`https://wa.me/${stop.whatsapp.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="px-8 py-4 bg-green-600 text-white text-[11px] font-black rounded-2xl uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100 active:scale-95"
                          >
                            <MessageCircle className="w-4 h-4" /> Chamar WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep(AppStep.DATABASE)} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-300 font-black hover:border-blue-300 hover:text-blue-500 transition-all uppercase tracking-widest">Encerrar e Voltar para Base</button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE EDIÇÃO */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-2xl font-black text-slate-900">Atualizar Cadastro</h3>
              <button onClick={() => setEditingClient(null)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Fantasia / Razão</label>
                <input required type="text" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold transition-all" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Endereço Completo</label>
                <input required type="text" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-medium transition-all" value={editingClient.address} onChange={e => setEditingClient({...editingClient, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bairro</label>
                  <input required type="text" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold" value={editingClient.neighborhood} onChange={e => setEditingClient({...editingClient, neighborhood: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">WhatsApp</label>
                  <input required type="text" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold" value={editingClient.whatsapp} onChange={e => setEditingClient({...editingClient, whatsapp: e.target.value})} />
                </div>
              </div>
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setEditingClient(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95">
                  <Save className="w-5 h-5" /> Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-300">
          <div className="relative mb-10">
            <div className="w-32 h-32 border-[10px] border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto w-12 h-12 text-blue-600 animate-pulse" />
          </div>
          <h3 className="text-3xl font-black mb-3 tracking-tight">Cérebro IA Ativado</h3>
          <p className="text-blue-600 font-bold mb-8 text-lg">{statusMessage}</p>
          <div className="max-w-xs p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2 italic">Dica Rápida</p>
            <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{tips[currentTip]}"</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
