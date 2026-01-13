
import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { Client, AppStep, RouteStop } from './types';
import { extractClientsFromPDF, optimizeRoute } from './services/geminiService';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
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

  const loadingMessages = [
    "Lendo o conteúdo do seu PDF...",
    "Identificando nomes e endereços...",
    "Validando cidades no Rio Grande do Norte...",
    "Calculando coordenadas geográficas...",
    "Organizando sua base de clientes...",
    "Quase pronto, finalizando a extração..."
  ];

  const tips = [
    "Dica: Tente agrupar clientes por bairro para economizar combustível.",
    "Dica: O Rio Grande do Norte tem rotas específicas que economizam pedágios.",
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

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("O arquivo é muito grande (máximo 10MB).");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Iniciando leitura do arquivo...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          setStatusMessage("Enviando para análise da Inteligência Artificial...");
          const extracted = await extractClientsFromPDF(base64);
          
          if (extracted.length === 0) {
            setErrorMessage("Não encontramos clientes válidos no PDF. Certifique-se de que o arquivo contém nomes e endereços claros.");
          } else {
            setClients(prev => [...prev, ...extracted]);
            setStep(AppStep.DATABASE);
          }
        } catch (err: any) {
          console.error("Erro na extração:", err);
          setErrorMessage(err.message || "Falha ao processar dados.");
        } finally {
          setLoading(false);
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

  const clearSelection = () => {
    setSelectedClientIds([]);
  };

  const handleUseCurrentLocation = (field: 'start' | 'end') => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const val = `${pos.coords.latitude}, ${pos.coords.longitude}`;
        if (field === 'start') setStartAddress(val);
        else setEndAddress(val);
      }, (err) => {
        setErrorMessage("Permissão de geolocalização negada. Digite o endereço manualmente.");
      });
    }
  };

  const calculateRoute = async () => {
    if (!startAddress || !endAddress || selectedClientIds.length === 0) {
      setErrorMessage("Defina partida, chegada e selecione pelo menos um cliente.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Calculando rota logística inteligente...");

    try {
      const clientsToVisit = clients.filter(c => selectedClientIds.includes(c.id));
      const orderedIds = await optimizeRoute(startAddress, endAddress, clientsToVisit);
      
      const orderedList: RouteStop[] = orderedIds.map((id, index) => {
        const client = clients.find(c => c.id === id)!;
        return {
          ...client,
          stopOrder: index + 1
        };
      });

      setOptimizedRoute(orderedList);
      setStep(AppStep.ROUTE);
    } catch (err: any) {
      console.error("Erro ao otimizar rota", err);
      setErrorMessage(err.message || "Erro ao calcular rota.");
    } finally {
      setLoading(false);
    }
  };

  const isApiKeyError = errorMessage?.includes("API_KEY");

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <Navigation className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
            RotaVendas Pro <span className="text-[10px] font-bold text-slate-400 align-top ml-1">RN</span>
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200">
          {[
            { step: AppStep.UPLOAD, label: 'Upload' },
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
        <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><Settings className="w-5 h-5" /></button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {errorMessage && (
          <div className={`max-w-4xl mx-auto mb-8 p-6 rounded-3xl border shadow-2xl animate-in slide-in-from-top-4 duration-300 ${isApiKeyError ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl ${isApiKeyError ? 'bg-amber-100' : 'bg-red-100'}`}>
                {isApiKeyError ? <ShieldAlert className="w-6 h-6 text-amber-600" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">{isApiKeyError ? 'Configuração de API Necessária' : 'Ops! Algo deu errado'}</h3>
                <p className="text-sm opacity-90 leading-relaxed mb-4">{errorMessage}</p>
                {isApiKeyError && (
                  <div className="bg-white/50 p-4 rounded-2xl border border-amber-200/50 text-sm">
                    <p className="font-bold mb-2">Como resolver no Vercel:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs opacity-80">
                      <li>Acesse Settings &rarr; Environment Variables</li>
                      <li>Adicione <b>API_KEY</b> com sua chave do Google AI Studio</li>
                      <li>Faça o <b>Redeploy</b> do projeto</li>
                    </ol>
                    <a href="https://vercel.com" target="_blank" className="inline-flex items-center gap-1 mt-4 text-blue-600 font-bold hover:underline">Ir para o painel Vercel <ExternalLink className="w-3 h-3" /></a>
                  </div>
                )}
              </div>
              <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-black/5 rounded-full"><X className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {step === AppStep.UPLOAD && (
          <div className="max-w-4xl mx-auto py-10">
            <div className="text-center mb-12">
              <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">Tecnologia Gemini AI</span>
              <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Otimize suas vendas no RN</h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto">Importe sua lista de clientes e deixe nossa inteligência artificial organizar seu dia de trabalho.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-stretch">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 flex flex-col items-center text-center transition-transform hover:scale-[1.01]">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                  <FileUp className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Upload de PDF</h3>
                <p className="text-slate-500 mb-8 leading-relaxed px-4">Arraste seu documento ou clique abaixo. Identificamos bairros e coordenadas automaticamente.</p>
                <label className="w-full">
                  <span className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-200 active:scale-95">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><PlusCircle className="w-5 h-5" /> Selecionar Arquivo</>}
                  </span>
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={loading} />
                </label>
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex gap-4">
                  <div className="bg-green-100 p-3 rounded-2xl h-fit"><CheckCircle2 className="text-green-600 w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Geocodificação RN</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Suporte nativo para Natal, Mossoró, Caicó e Parnamirim.</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex gap-4">
                  <div className="bg-orange-100 p-3 rounded-2xl h-fit"><Navigation className="text-orange-600 w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Rotas Sem Desvios</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Algoritmos que priorizam as vias principais e evitam trânsito.</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2rem] text-white shadow-xl">
                   <p className="text-xs font-bold opacity-80 mb-2 uppercase tracking-widest">Status do Sistema</p>
                   <p className="text-2xl font-black">Online & Pronto</p>
                   <div className="mt-4 flex items-center gap-2">
                     <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                     <span className="text-[10px] font-bold opacity-70">IA Gemini Ativa</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === AppStep.DATABASE && (
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Base de Clientes</h2>
                <p className="text-slate-500 font-medium">Foram encontrados <span className="text-blue-600">{clients.length} clientes</span> no estado do RN.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(AppStep.UPLOAD)} className="px-5 py-3 border border-slate-200 bg-white rounded-2xl text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold shadow-sm"><FileUp className="w-4 h-4" /> Importar Mais</button>
                <button onClick={() => setStep(AppStep.PLANNER)} className="px-5 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 font-bold shadow-lg shadow-blue-200">Planejar Visitas <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Cliente</th>
                      <th className="px-8 py-5">Endereço Completo</th>
                      <th className="px-8 py-5">Bairro</th>
                      <th className="px-8 py-5">Cidade</th>
                      <th className="px-8 py-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg">{client.name[0]}</div>
                              <span className="font-bold text-slate-800">{client.name}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-sm text-slate-600 max-w-xs truncate">{client.address}</td>
                        <td className="px-8 py-6"><span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg uppercase tracking-wider">{client.neighborhood}</span></td>
                        <td className="px-8 py-6 text-sm font-medium text-slate-600">{client.city}</td>
                        <td className="px-8 py-6 text-right">
                          <button onClick={() => setClients(clients.filter(c => c.id !== client.id))} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 className="w-5 h-5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === AppStep.PLANNER && (
          <div className="h-full flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
            <div className="w-full md:w-96 flex flex-col gap-6 shrink-0">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6">
                <div>
                  <h3 className="font-black text-slate-900 text-xl flex items-center gap-2 mb-2">
                    <MapPin className="text-blue-600 w-6 h-6" /> 1. Região
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Selecione o bairro para focar suas vendas hoje.</p>
                </div>
                <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 appearance-none shadow-inner" value={selectedNeighborhood} onChange={(e) => setSelectedNeighborhood(e.target.value)}>
                  <option value="">Selecione o Bairro...</option>
                  {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {selectedNeighborhood && (
                  <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                    <button onClick={selectAllInNeighborhood} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Marcar Tudo</button>
                    <button onClick={clearSelection} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:underline">Limpar</button>
                  </div>
                )}
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6">
                <h3 className="font-black text-slate-900 text-xl flex items-center gap-2"><Navigation className="text-blue-600 w-6 h-6" /> 2. Rota</h3>
                <div className="space-y-4">
                  <div className="relative group">
                    <input type="text" placeholder="Endereço de Partida" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium pr-12 focus:border-blue-500 transition-all outline-none" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} />
                    <button onClick={() => handleUseCurrentLocation('start')} title="Usar minha localização" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"><LocateFixed className="w-5 h-5" /></button>
                  </div>
                  <div className="relative group">
                    <input type="text" placeholder="Endereço de Chegada" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium pr-12 focus:border-blue-500 transition-all outline-none" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} />
                    <button onClick={() => handleUseCurrentLocation('end')} title="Usar minha localização" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"><LocateFixed className="w-5 h-5" /></button>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecionados</p>
                      <p className="text-3xl font-black text-blue-600">{selectedClientIds.length}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bairro</p>
                       <p className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{selectedNeighborhood || '-'}</p>
                    </div>
                  </div>
                  <button disabled={selectedClientIds.length === 0 || loading} onClick={calculateRoute} className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-blue-700 disabled:opacity-30 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2 active:scale-95">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Navigation className="w-5 h-5" /> Otimizar Percurso</>}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col min-h-[600px]">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="font-black text-slate-900 text-xl flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    {selectedNeighborhood ? `Clientes em ${selectedNeighborhood}` : 'Selecione um bairro'}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-1">Clique nos cards para selecionar as visitas.</p>
                </div>
                {selectedNeighborhood && (
                  <span className="text-[10px] font-black text-blue-600 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm uppercase tracking-widest">
                    {filteredClients.length} cadastrados
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                {selectedNeighborhood ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredClients.map((client) => {
                      const isSelected = selectedClientIds.includes(client.id);
                      return (
                        <div 
                          key={client.id}
                          onClick={() => toggleClientSelection(client.id)}
                          className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative group flex gap-4 ${
                            isSelected 
                            ? 'border-blue-600 bg-white shadow-xl shadow-blue-900/10 ring-4 ring-blue-500/5' 
                            : 'border-white bg-white hover:border-slate-200 hover:shadow-lg'
                          }`}
                        >
                          <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-blue-600 border-blue-600 scale-110 shadow-lg shadow-blue-200' : 'bg-white border-slate-200'
                          }`}>
                            {isSelected && <Check className="w-4 h-4 text-white stroke-[4]" />}
                          </div>
                          
                          <div className="flex-1">
                            <h4 className={`font-black text-base mb-1 ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                              {client.name}
                            </h4>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed mb-4">
                              {client.address}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                                {client.city}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <div className="bg-white p-10 rounded-[3rem] shadow-sm mb-6 border border-slate-100"><Users className="w-16 h-16 opacity-20" /></div>
                    <p className="max-w-xs text-center font-bold text-slate-400 text-lg">Selecione um bairro no menu lateral para carregar a lista.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === AppStep.ROUTE && (
          <div className="max-w-4xl mx-auto pb-20">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Rota de Hoje</h2>
                <p className="text-slate-500 font-medium">Ordem de visita otimizada para o Rio Grande do Norte.</p>
              </div>
              <button onClick={() => setStep(AppStep.PLANNER)} className="text-blue-600 font-bold hover:underline flex items-center gap-2 bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm">
                Ajustar Seleção
              </button>
            </div>
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white p-8 rounded-[2rem] flex items-center gap-8 shadow-2xl shadow-blue-900/20">
                <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md"><Navigation className="w-8 h-8" /></div>
                <div>
                  <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">Partida</p>
                  <p className="font-bold text-xl leading-tight">{startAddress}</p>
                </div>
              </div>
              <div className="relative pl-12 space-y-6 py-6">
                <div className="absolute left-6 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 via-indigo-400 to-slate-200 rounded-full shadow-inner"></div>
                {optimizedRoute.map((stop, idx) => (
                  <div key={stop.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-start gap-6 relative group transition-all hover:border-blue-300 hover:translate-x-1">
                    <div className="absolute -left-9 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border-[6px] border-blue-600 rounded-full z-10 flex items-center justify-center font-black text-[10px] text-blue-600 shadow-lg">
                      {idx + 1}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-3xl"><Package className="w-8 h-8 text-slate-400" /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-black text-xl text-slate-800 tracking-tight">{stop.name}</h4>
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">#{idx+1}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">{stop.address}, {stop.neighborhood}, {stop.city}</p>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address}, ${stop.neighborhood}, ${stop.city}`)}`} target="_blank" rel="noreferrer" className="bg-slate-900 text-white text-[10px] font-black px-6 py-3 rounded-xl inline-flex items-center gap-2 hover:bg-black transition-colors shadow-lg shadow-black/10 uppercase tracking-widest">
                        <MapPin className="w-4 h-4" /> Abrir no Google Maps
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 text-white p-8 rounded-[2rem] flex items-center gap-8 shadow-2xl">
                <div className="bg-white/10 p-4 rounded-3xl"><CheckCircle2 className="w-8 h-8 text-green-400" /></div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Destino Final</p>
                  <p className="font-bold text-xl leading-tight">{endAddress}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-12 bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100/50 flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="text-center md:text-left">
                  <p className="text-blue-900 font-black text-xl mb-1">Tudo pronto!</p>
                  <p className="text-blue-700/60 text-sm font-medium">Boa jornada e ótimas vendas.</p>
               </div>
               <button onClick={() => window.print()} className="bg-white text-blue-600 font-black px-8 py-4 rounded-2xl shadow-sm border border-blue-200 hover:bg-blue-100 transition-colors uppercase tracking-widest text-xs">Imprimir</button>
            </div>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="relative mb-12">
            <div className="w-32 h-32 border-8 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Navigation className="w-12 h-12 text-blue-600 animate-pulse" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">IA Processando...</h3>
          <div className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] shadow-2xl shadow-blue-200 mb-8 min-w-[320px] animate-bounce">
            <p className="font-black text-sm flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" /> {statusMessage}
            </p>
          </div>
          
          <div className="max-w-sm h-24 flex flex-col items-center justify-center">
             <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-3">Dica Logística</p>
             <p className="text-slate-600 font-bold italic leading-relaxed animate-in slide-in-from-bottom-2 duration-700" key={currentTip}>
               "{tips[currentTip]}"
             </p>
          </div>

          <button 
            onClick={() => setLoading(false)}
            className="mt-12 px-8 py-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-transparent hover:border-red-100"
          >
            Interromper Processo
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
