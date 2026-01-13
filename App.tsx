
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  PlusCircle, 
  Map as MapIcon, 
  Users, 
  Navigation, 
  FileUp, 
  CheckCircle2, 
  ChevronRight,
  MapPin,
  Trash2,
  Package,
  ArrowRight,
  Settings,
  LocateFixed,
  AlertCircle,
  X,
  Loader2,
  Check
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

  const loadingMessages = [
    "Lendo o conteúdo do seu PDF...",
    "Identificando nomes e endereços...",
    "Validando cidades no Rio Grande do Norte...",
    "Calculando coordenadas geográficas...",
    "Organizando sua base de clientes...",
    "Quase pronto, finalizando a extração..."
  ];

  useEffect(() => {
    let interval: number;
    if (loading && step === AppStep.UPLOAD) {
      let i = 0;
      setStatusMessage(loadingMessages[0]);
      interval = window.setInterval(() => {
        i = (i + 1) % loadingMessages.length;
        setStatusMessage(loadingMessages[i]);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [loading, step]);

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
            setErrorMessage("Não encontramos clientes válidos no PDF.");
          } else {
            setClients(prev => [...prev, ...extracted]);
            setStep(AppStep.DATABASE);
          }
        } catch (err: any) {
          console.error("Erro na extração:", err);
          setErrorMessage(`Falha ao processar dados: ${err.message || "Erro desconhecido"}`);
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
        setErrorMessage("Não foi possível obter sua localização.");
      });
    }
  };

  const calculateRoute = async () => {
    if (!startAddress || !endAddress || selectedClientIds.length === 0) {
      setErrorMessage("Preencha partida, chegada e selecione clientes.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Calculando a melhor rota para os clientes selecionados...");

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
    } catch (err) {
      console.error("Erro ao otimizar rota", err);
      setErrorMessage("Erro ao calcular rota otimizada.");
    } finally {
      setLoading(false);
    }
  };

  const cancelProcess = () => {
    setLoading(false);
    setStatusMessage('');
    setErrorMessage(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Navigation className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            RotaVendas Pro <span className="text-[10px] font-normal text-slate-400 align-top uppercase tracking-widest">RN</span>
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setStep(AppStep.UPLOAD)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === AppStep.UPLOAD ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Upload</button>
          <button onClick={() => setStep(AppStep.DATABASE)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === AppStep.DATABASE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Clientes</button>
          <button onClick={() => setStep(AppStep.PLANNER)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === AppStep.PLANNER ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Planejador</button>
          {optimizedRoute.length > 0 && <button onClick={() => setStep(AppStep.ROUTE)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === AppStep.ROUTE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Rota Final</button>}
        </nav>
        <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><Settings className="w-5 h-5" /></button>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
        {errorMessage && (
          <div className="max-w-4xl mx-auto mb-6 bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between text-red-800 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-red-100 rounded-full"><X className="w-4 h-4" /></button>
          </div>
        )}

        {step === AppStep.UPLOAD && (
          <div className="max-w-4xl mx-auto py-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Logística Inteligente no RN</h2>
              <p className="text-slate-600 text-lg">Faça upload da sua lista de clientes para geolocalização automática.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6"><FileUp className="w-10 h-10 text-blue-600" /></div>
                <h3 className="text-xl font-bold mb-3">Upload de PDF</h3>
                <p className="text-slate-500 mb-8 leading-relaxed">Arraste seu arquivo ou clique para selecionar. Nossa IA irá extrair endereços automaticamente.</p>
                <label className="w-full">
                  <span className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><PlusCircle className="w-5 h-5" /> Selecionar Arquivo</>}
                  </span>
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={loading} />
                </label>
              </div>
              <div className="space-y-6">
                <div className="flex gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-green-100 p-3 rounded-xl h-fit"><CheckCircle2 className="text-green-600 w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Geocodificação via IA</h4>
                    <p className="text-sm text-slate-500 mt-1">Extraímos dados diretamente do seu PDF.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-orange-100 p-3 rounded-xl h-fit"><Navigation className="text-orange-600 w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Rotas Otimizadas</h4>
                    <p className="text-sm text-slate-500 mt-1">Reduza sua quilometragem diária.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === AppStep.DATABASE && (
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Base de Clientes</h2>
                <p className="text-slate-500">Total de {clients.length} clientes geolocalizados no RN.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(AppStep.UPLOAD)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-white transition-colors flex items-center gap-2 font-medium"><FileUp className="w-4 h-4" /> Importar Mais</button>
                <button onClick={() => setStep(AppStep.PLANNER)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium">Iniciar Planejamento <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Nome</th>
                      <th className="px-6 py-4 font-semibold">Endereço</th>
                      <th className="px-6 py-4 font-semibold">Bairro</th>
                      <th className="px-6 py-4 font-semibold">Cidade</th>
                      <th className="px-6 py-4 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">{client.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{client.address}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{client.neighborhood}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{client.city}</td>
                        <td className="px-6 py-4">
                          <button onClick={() => setClients(clients.filter(c => c.id !== client.id))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
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
          <div className="h-full flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><MapPin className="text-blue-600 w-5 h-5" /> 1. Bairro</h3>
                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={selectedNeighborhood} onChange={(e) => setSelectedNeighborhood(e.target.value)}>
                  <option value="">Selecione um bairro...</option>
                  {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {selectedNeighborhood && (
                  <div className="pt-2 flex flex-col gap-2">
                    <button onClick={selectAllInNeighborhood} className="text-xs text-blue-600 hover:underline text-left font-medium">Selecionar todos do bairro</button>
                    <button onClick={clearSelection} className="text-xs text-slate-500 hover:underline text-left font-medium">Limpar seleção</button>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Navigation className="text-blue-600 w-5 h-5" /> 2. Rota</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <input type="text" placeholder="Partida no RN" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-10" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} />
                    <button onClick={() => handleUseCurrentLocation('start')} className="absolute right-3 top-3 text-blue-500 hover:text-blue-700"><LocateFixed className="w-4 h-4" /></button>
                  </div>
                  <div className="relative">
                    <input type="text" placeholder="Chegada no RN" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-10" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} />
                    <button onClick={() => handleUseCurrentLocation('end')} className="absolute right-3 top-3 text-blue-500 hover:text-blue-700"><LocateFixed className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-slate-500">Selecionados:</span>
                    <span className="font-bold text-blue-600">{selectedClientIds.length}</span>
                  </div>
                  <button disabled={selectedClientIds.length === 0 || loading} onClick={calculateRoute} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Calcular Rota'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Users className="w-5 h-5 text-blue-600" />
                   {selectedNeighborhood ? `Clientes em ${selectedNeighborhood}` : 'Selecione um bairro'}
                </h3>
                {selectedNeighborhood && (
                  <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                    {filteredClients.length} encontrados
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {selectedNeighborhood ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClients.map((client) => {
                      const isSelected = selectedClientIds.includes(client.id);
                      return (
                        <div 
                          key={client.id}
                          onClick={() => toggleClientSelection(client.id)}
                          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative group ${
                            isSelected 
                            ? 'border-blue-600 bg-blue-50 shadow-md ring-1 ring-blue-600/10' 
                            : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                          }`}
                        >
                          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          
                          <div className="flex flex-col h-full">
                            <h4 className={`font-bold text-sm mb-1 ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                              {client.name}
                            </h4>
                            <p className="text-xs text-slate-500 mb-2 line-clamp-2">
                              {client.address}
                            </p>
                            <div className="mt-auto flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                {client.city}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <div className="bg-slate-50 p-6 rounded-full mb-4"><Users className="w-12 h-12" /></div>
                    <p className="max-w-xs text-center font-medium">Escolha um bairro no menu lateral para listar os clientes disponíveis para visita.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === AppStep.ROUTE && (
          <div className="max-w-4xl mx-auto pb-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rota Otimizada - RN</h2>
              <button onClick={() => setStep(AppStep.PLANNER)} className="text-blue-600 font-medium hover:underline flex items-center gap-1">Voltar ao Planejador</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-600 text-white p-6 rounded-3xl flex items-center gap-6 shadow-lg">
                <Navigation className="w-6 h-6" />
                <div>
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Partida</p>
                  <p className="font-bold text-lg">{startAddress}</p>
                </div>
              </div>
              <div className="relative pl-12 space-y-4 py-4">
                <div className="absolute left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-indigo-400 to-slate-200 rounded-full"></div>
                {optimizedRoute.map((stop, idx) => (
                  <div key={stop.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4 relative group hover:border-blue-400 transition-colors">
                    <div className="absolute -left-9 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border-4 border-blue-600 rounded-full z-10 flex items-center justify-center font-bold text-[10px] text-blue-600 shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl"><Package className="w-6 h-6 text-slate-500" /></div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800">{stop.name}</h4>
                      <p className="text-sm text-slate-500">{stop.address}, {stop.neighborhood}, {stop.city}</p>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address}, ${stop.neighborhood}, ${stop.city}`)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 mt-2 inline-flex items-center gap-1 hover:underline">
                        <MapPin className="w-3 h-3" /> Ver no Maps
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800 text-white p-6 rounded-3xl flex items-center gap-6 shadow-lg">
                <CheckCircle2 className="w-6 h-6" />
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Destino Final</p>
                  <p className="font-bold text-lg">{endAddress}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center"><Navigation className="w-10 h-10 text-blue-600 animate-pulse" /></div>
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 mb-4 tracking-tight">Processando</h3>
          <div className="bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100 shadow-sm mb-8 min-w-[300px]">
            <p className="text-blue-700 font-medium flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {statusMessage}</p>
          </div>
          <button onClick={cancelProcess} className="px-6 py-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all text-sm font-medium border border-transparent hover:border-slate-200">Cancelar e Voltar</button>
        </div>
      )}
    </div>
  );
};

export default App;
