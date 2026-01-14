
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
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
  
  // Estado de prontidão da chave API
  const [isApiKeyReady, setIsApiKeyReady] = useState<boolean>(false);

  // Checagem contínua de chave (resiliência)
  useEffect(() => {
    const checkKey = async () => {
      // Se já houver chave no ambiente (Vercel), libera o app
      if (process.env.API_KEY && process.env.API_KEY !== "") {
        setIsApiKeyReady(true);
        return;
      }

      // Tenta detectar o seletor do AI Studio
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) setIsApiKeyReady(true);
        } catch (e) {
          console.debug("Aguardando inicialização do AI Studio...");
        }
      }
    };
    checkKey();
    const interval = setInterval(checkKey, 2000); // Tenta novamente a cada 2s se não estiver pronto
    return () => clearInterval(interval);
  }, []);

  const handleConnectKey = async () => {
    setErrorMessage(null);
    try {
      // Tenta abrir o seletor mesmo que a verificação inicial falhe
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Regra de Race Condition: Assume sucesso após abrir
        setIsApiKeyReady(true);
      } else {
        // Se realmente não existir, informa como proceder
        setErrorMessage("O seletor de chaves do Google AI Studio não foi detectado. Certifique-se de que não há extensões bloqueando o script da Vercel.");
      }
    } catch (err) {
      setErrorMessage("Erro ao tentar abrir o seletor de chaves da Google.");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("A IA está processando seu PDF...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          const extracted = await extractClientsFromPDF(base64);
          if (extracted.length === 0) {
            setErrorMessage("A IA não conseguiu encontrar dados de clientes neste PDF.");
          } else {
            setClients(prev => [...prev, ...extracted]);
            setStep(AppStep.DATABASE);
          }
        } catch (err: any) {
          if (err.message.includes("entity was not found")) {
            setIsApiKeyReady(false);
            setErrorMessage("Sua chave de API parece inválida ou expirou. Por favor, vincule novamente.");
          } else {
            setErrorMessage("Erro no processamento da IA: " + err.message);
          }
        } finally {
          setLoading(false);
          if (event.target) event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      setErrorMessage("Falha ao ler o arquivo selecionado.");
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setClients(prev => prev.map(c => c.id === editingClient.id ? editingClient : c));
    setEditingClient(null);
  };

  const handleDeleteClient = (id: string) => {
    if (confirm("Deseja remover este cliente permanentemente?")) {
      setClients(prev => prev.filter(c => c.id !== id));
      setSelectedClientIds(prev => prev.filter(i => i !== id));
    }
  };

  const calculateRouteWithAI = async () => {
    if (selectedClientIds.length === 0) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("IA Gemini Pro organizando sua rota...");

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
      setErrorMessage("Erro ao otimizar rota: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const neighborhoods = useMemo(() => {
    const set = new Set(clients.map(c => c.neighborhood).filter(Boolean));
    return Array.from(set).sort();
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!selectedNeighborhood) return clients;
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

  const tips = [
    "A IA Gemini Pro 2.5 analisa a melhor logística para suas visitas.",
    "Bairros bem definidos permitem que a IA agrupe melhor as paradas.",
    "Corrigir o endereço manualmente ajuda na precisão do GPS.",
    "Importe PDFs de relatórios para agilizar o cadastro da sua base."
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

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans bg-slate-50 text-slate-900">
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
              <span className="text-[10px] font-black uppercase">IA Ativa</span>
            </div>
          )}
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {!isApiKeyReady ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-8 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto shadow-inner"><ShieldAlert className="w-12 h-12 text-blue-500" /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Conecte sua IA</h2>
              <p className="text-slate-500 leading-relaxed text-sm">Para que o sistema processe PDFs e crie rotas, você precisa vincular uma chave do Google AI Studio (mesmo gratuita).</p>
            </div>
            
            <button onClick={handleConnectKey} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3">
              Vincular Agora <ChevronRight className="w-5 h-5" />
            </button>
            
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-blue-500 underline transition-colors">Como criar uma chave grátis?</a>
            
            {errorMessage && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
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
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestão de Clientes</h2>
                    <p className="text-slate-500 font-medium">Você possui <span className="text-blue-600 font-bold">{clients.length}</span> registros na base.</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <input type="file" className="hidden" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} disabled={loading} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="flex-1 sm:flex-none px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"><FileUp className="w-5 h-5" /> Importar PDF</button>
                    <button onClick={() => setStep(AppStep.PLANNER)} className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"><Navigation className="w-5 h-5" /> Planejar Rota</button>
                  </div>
                </div>

                {clients.length === 0 && !loading ? (
                  <div className="bg-white rounded-[2.5rem] border border-slate-200 p-20 text-center shadow-xl">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6"><Users className="w-10 h-10 text-blue-400" /></div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Sua base está limpa</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">Suba um PDF com a lista de clientes para que possamos começar a roteirização.</p>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-8 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">Importar PDF Agora</button>
                  </div>
                ) : (
                  <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="px-8 py-6">Cliente</th>
                          <th className="px-8 py-6">Localização</th>
                          <th className="px-8 py-6">WhatsApp</th>
                          <th className="px-8 py-6 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clients.map(client => (
                          <tr key={client.id} className="hover:bg-blue-50/40 transition-colors group">
                            <td className="px-8 py-6">
                              <div className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{client.name}</div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">ID: {client.id.slice(-6)}</div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="text-sm text-slate-600 font-medium">{client.address}</div>
                              <div className="flex gap-2 mt-2">
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{client.neighborhood}</span>
                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{client.city}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-2 text-green-600 font-bold">
                                <MessageCircle className="w-4 h-4" />
                                {client.whatsapp}
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingClient(client)} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-xl transition-all" title="Editar">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteClient(client.id)} className="p-2 bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-xl transition-all" title="Excluir">
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
              <div className="h-full flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
                <div className="w-full md:w-96 flex flex-col gap-6 shrink-0">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
                    <h3 className="font-black text-slate-900 text-xl flex items-center gap-2"><MapIcon className="w-5 h-5 text-blue-600" /> Filtrar Região</h3>
                    <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all" value={selectedNeighborhood} onChange={(e) => setSelectedNeighborhood(e.target.value)}>
                      <option value="">Todos os Bairros...</option>
                      {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {selectedNeighborhood && <button onClick={selectAllInNeighborhood} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Selecionar Todo Bairro</button>}
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4">
                    <div className="space-y-3">
                      <input type="text" placeholder="Partida (Base)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-blue-500" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} />
                      <input type="text" placeholder="Retorno (Base)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-blue-500" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} />
                    </div>
                    <button disabled={selectedClientIds.length === 0 || loading} onClick={calculateRouteWithAI} className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-blue-700 disabled:opacity-30 shadow-xl shadow-blue-200 flex items-center justify-center gap-2 transition-all">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Gerar Rota Inteligente</>}
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[500px]">
                  <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 text-xl">Selecionados ({selectedClientIds.length})</h3>
                    {selectedClientIds.length > 0 && <button onClick={() => setSelectedClientIds([])} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-3 py-1 rounded-lg">Desmarcar Tudo</button>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {filteredClients.map((client) => {
                        const isSelected = selectedClientIds.includes(client.id);
                        return (
                          <div key={client.id} onClick={() => toggleClientSelection(client.id)} className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex gap-4 items-start ${isSelected ? 'border-blue-600 bg-blue-50/20 shadow-xl scale-[1.02]' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}>
                            <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>
                            <div className="overflow-hidden">
                              <h4 className="font-black text-slate-800 truncate leading-tight">{client.name}</h4>
                              <p className="text-xs text-slate-500 truncate mt-1">{client.address}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === AppStep.ROUTE && (
              <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-4">
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Rota Logística</h2>
                    <p className="text-slate-500 font-bold mt-1">Sua jornada de hoje organizada pela Inteligência Artificial.</p>
                  </div>
                  <span className="bg-blue-100 text-blue-700 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm border border-blue-200"><Sparkles className="w-4 h-4" /> Gemini Pro AI 2.5</span>
                </div>
                <div className="space-y-8 relative">
                  <div className="absolute left-6 top-8 bottom-8 w-1 bg-gradient-to-b from-blue-600 to-indigo-600 opacity-10 rounded-full hidden sm:block"></div>
                  {optimizedRoute.map((stop, idx) => (
                    <div key={stop.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col sm:flex-row items-start gap-8 transition-all hover:translate-x-1 relative z-10">
                      <div className="w-14 h-14 bg-blue-600 text-white rounded-[1.25rem] flex items-center justify-center font-black text-2xl shrink-0 shadow-lg shadow-blue-200 ring-4 ring-blue-50">{idx + 1}</div>
                      <div className="flex-1">
                        <h4 className="font-black text-2xl text-slate-800 leading-tight">{stop.name}</h4>
                        <p className="text-slate-500 font-medium mb-8 mt-2">{stop.address}, {stop.neighborhood}</p>
                        <div className="flex flex-wrap gap-4">
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address}, ${stop.city}`)}`} target="_blank" rel="noreferrer" className="bg-slate-900 text-white text-[11px] font-black px-8 py-4 rounded-2xl uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200"><MapPin className="w-4 h-4" /> Abrir no GPS</a>
                          <a href={`https://wa.me/${stop.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="bg-green-600 text-white text-[11px] font-black px-8 py-4 rounded-2xl uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-xl shadow-green-100"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-16 flex gap-4">
                  <button onClick={() => setStep(AppStep.PLANNER)} className="flex-1 py-6 border-2 border-dashed border-slate-300 rounded-[2rem] text-slate-400 font-black hover:border-blue-400 hover:text-blue-500 transition-all active:scale-95">Revisar Visitas</button>
                  <button onClick={() => window.print()} className="px-12 py-6 bg-white border border-slate-200 rounded-[2rem] font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-95">Imprimir Relatório</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE EDIÇÃO DE CLIENTE */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-tight">Editar Cliente</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Alterar informações de cadastro</p>
              </div>
              <button onClick={() => setEditingClient(null)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Fantasia / Razão Social</label>
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
                <button type="button" onClick={() => setEditingClient(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95">Descartar</button>
                <button type="submit" className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95">
                  <Save className="w-5 h-5" /> Salvar Cadastro
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
          <h3 className="text-3xl font-black mb-3 tracking-tight">Cérebro IA em Ação</h3>
          <p className="text-blue-600 font-bold mb-8 text-lg">{statusMessage}</p>
          <div className="max-w-xs p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mb-2">Dica Logística</p>
            <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{tips[currentTip]}"</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
