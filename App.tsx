
import React, { useState, useCallback, useMemo } from 'react';
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
  LocateFixed
} from 'lucide-react';
import { Client, AppStep, RouteStop } from './types';
import { extractClientsFromPDF, optimizeRoute } from './services/geminiService';
import MapView from './components/MapView';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [startAddress, setStartAddress] = useState<string>('');
  const [endAddress, setEndAddress] = useState<string>('');
  const [optimizedRoute, setOptimizedRoute] = useState<RouteStop[]>([]);

  // Extraction handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const extracted = await extractClientsFromPDF(base64);
        setClients(prev => [...prev, ...extracted]);
        setStep(AppStep.DATABASE);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro ao processar PDF", err);
      alert("Houve um erro ao ler o PDF. Tente novamente.");
    } finally {
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
        alert("Não foi possível obter sua localização. Verifique as permissões do navegador.");
      });
    }
  };

  const calculateRoute = async () => {
    if (!startAddress || !endAddress || selectedClientIds.length === 0) {
      alert("Preencha o endereço de partida, chegada e selecione pelo menos um cliente.");
      return;
    }

    setLoading(true);
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
      alert("Erro ao calcular rota otimizada.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Navigation className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            RotaVendas Pro
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setStep(AppStep.UPLOAD)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === AppStep.UPLOAD ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Upload
          </button>
          <button 
            onClick={() => setStep(AppStep.DATABASE)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === AppStep.DATABASE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Clientes
          </button>
          <button 
            onClick={() => setStep(AppStep.PLANNER)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === AppStep.PLANNER ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Planejador
          </button>
          {optimizedRoute.length > 0 && (
            <button 
              onClick={() => setStep(AppStep.ROUTE)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === AppStep.ROUTE ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Rota Final
            </button>
          )}
        </nav>
        <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
        
        {/* STEP 1: UPLOAD */}
        {step === AppStep.UPLOAD && (
          <div className="max-w-4xl mx-auto py-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Bem-vindo ao Futuro das Vendas</h2>
              <p className="text-slate-600 text-lg">Faça upload da sua lista de clientes em PDF para começar.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <FileUp className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-3">Upload de PDF</h3>
                <p className="text-slate-500 mb-8 leading-relaxed">Arraste seu arquivo ou clique para selecionar. Nossa IA irá extrair endereços, contatos e bairros automaticamente.</p>
                <label className="w-full">
                  <span className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200">
                    {loading ? 'Processando...' : <><PlusCircle className="w-5 h-5" /> Selecionar Arquivo</>}
                  </span>
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={loading} />
                </label>
              </div>
              
              <div className="space-y-6">
                <div className="flex gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-green-100 p-3 rounded-xl h-fit"><CheckCircle2 className="text-green-600 w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Extração de Dados Inteligente</h4>
                    <p className="text-sm text-slate-500 mt-1">Nossa IA lê PDFs complexos e estrutura as informações para você.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-indigo-100 p-3 rounded-xl h-fit"><MapIcon className="text-indigo-600 w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Mapeamento Geográfico</h4>
                    <p className="text-sm text-slate-500 mt-1">Visualize todos os seus clientes em um mapa interativo por bairro.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-orange-100 p-3 rounded-xl h-fit"><Navigation className="text-orange-600 w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Otimização de Rota</h4>
                    <p className="text-sm text-slate-500 mt-1">Economize combustível com rotas calculadas para máxima eficiência.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: DATABASE */}
        {step === AppStep.DATABASE && (
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Base de Clientes</h2>
                <p className="text-slate-500">Total de {clients.length} clientes importados.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setStep(AppStep.UPLOAD)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-white transition-colors flex items-center gap-2 font-medium"
                >
                  <FileUp className="w-4 h-4" /> Importar Mais
                </button>
                <button 
                  onClick={() => setStep(AppStep.PLANNER)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  Iniciar Planejamento <ArrowRight className="w-4 h-4" />
                </button>
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
                      <th className="px-6 py-4 font-semibold">Contato</th>
                      <th className="px-6 py-4 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                              {client.name[0]}
                            </div>
                            <span className="font-medium text-slate-800">{client.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{client.address}</td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-medium border border-slate-200">
                            {client.neighborhood || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{client.phone || '-'}</td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => setClients(clients.filter(c => c.id !== client.id))}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center opacity-40">
                            <Users className="w-16 h-16 mb-4" />
                            <p>Nenhum cliente cadastrado.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PLANNER */}
        {step === AppStep.PLANNER && (
          <div className="h-full flex flex-col md:flex-row gap-6">
            {/* Sidebar Controls */}
            <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <MapPin className="text-blue-600 w-5 h-5" /> 1. Escolha o Bairro
                </h3>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                >
                  <option value="">Selecione um bairro...</option>
                  {neighborhoods.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                
                {selectedNeighborhood && (
                  <div className="pt-2 flex flex-col gap-2">
                    <button 
                      onClick={selectAllInNeighborhood}
                      className="text-xs text-blue-600 hover:underline text-left font-medium"
                    >
                      Selecionar todos ({filteredClients.length})
                    </button>
                    <button 
                      onClick={clearSelection}
                      className="text-xs text-slate-500 hover:underline text-left font-medium"
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Navigation className="text-blue-600 w-5 h-5" /> 2. Pontos de Rota
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Partida</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Endereço ou Coordenadas"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-10"
                        value={startAddress}
                        onChange={(e) => setStartAddress(e.target.value)}
                      />
                      <button 
                        onClick={() => handleUseCurrentLocation('start')}
                        className="absolute right-3 top-3 text-blue-500 hover:text-blue-700"
                        title="Usar localização atual"
                      >
                        <LocateFixed className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Chegada</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Endereço ou Coordenadas"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-10"
                        value={endAddress}
                        onChange={(e) => setEndAddress(e.target.value)}
                      />
                      <button 
                        onClick={() => handleUseCurrentLocation('end')}
                        className="absolute right-3 top-3 text-blue-500 hover:text-blue-700"
                        title="Usar localização atual"
                      >
                        <LocateFixed className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-slate-500">Selecionados:</span>
                    <span className="font-bold text-blue-600">{selectedClientIds.length}</span>
                  </div>
                  <button 
                    disabled={selectedClientIds.length === 0 || loading}
                    onClick={calculateRoute}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-100"
                  >
                    {loading ? 'Calculando Rota...' : 'Calcular Melhor Rota'}
                  </button>
                </div>
              </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] relative">
              {selectedNeighborhood ? (
                <MapView 
                  clients={filteredClients} 
                  selectedClients={selectedClientIds}
                  onToggleClient={toggleClientSelection}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                  <div className="bg-slate-50 p-6 rounded-full mb-4">
                    <MapIcon className="w-12 h-12" />
                  </div>
                  <p className="max-w-xs font-medium">Selecione um bairro ao lado para visualizar os clientes no mapa.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: FINAL ROUTE */}
        {step === AppStep.ROUTE && (
          <div className="max-w-4xl mx-auto pb-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Rota Otimizada</h2>
              <button 
                onClick={() => setStep(AppStep.PLANNER)}
                className="text-blue-600 font-medium hover:underline flex items-center gap-1"
              >
                Voltar ao Planejador
              </button>
            </div>

            <div className="space-y-4">
              {/* Start Node */}
              <div className="bg-blue-600 text-white p-6 rounded-3xl flex items-center gap-6 relative shadow-lg">
                <div className="bg-white/20 p-3 rounded-2xl">
                  <Navigation className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Ponto de Partida</p>
                  <p className="font-bold text-lg">{startAddress}</p>
                </div>
              </div>

              {/* Stops */}
              <div className="relative pl-12 space-y-4 py-4">
                <div className="absolute left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-indigo-400 to-slate-200 rounded-full"></div>
                
                {optimizedRoute.map((stop, idx) => (
                  <div key={stop.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4 relative group hover:border-blue-400 transition-colors">
                    <div className="absolute -left-9 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border-4 border-blue-600 rounded-full z-10 flex items-center justify-center font-bold text-[10px] text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                      {idx + 1}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl">
                      <Package className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800">{stop.name}</h4>
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Visita #{idx + 1}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{stop.address}</p>
                      <div className="flex gap-4 mt-3">
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
                        >
                          <MapPin className="w-3 h-3" /> Ver no Maps
                        </a>
                        <span className="text-xs text-slate-400 border-l pl-4 border-slate-200">{stop.phone || 'Sem telefone'}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 self-center" />
                  </div>
                ))}
              </div>

              {/* End Node */}
              <div className="bg-slate-800 text-white p-6 rounded-3xl flex items-center gap-6 shadow-lg">
                <div className="bg-white/10 p-3 rounded-2xl text-slate-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Destino Final</p>
                  <p className="font-bold text-lg">{endAddress}</p>
                </div>
              </div>
            </div>

            <div className="mt-12 flex justify-center">
              <button 
                onClick={() => window.print()}
                className="bg-white border-2 border-slate-200 px-8 py-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                Imprimir Rota Diária
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <Navigation className="absolute inset-0 m-auto w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Processando Inteligência</h3>
          <p className="text-slate-500 max-w-xs">
            {step === AppStep.UPLOAD 
              ? "Estamos lendo seu PDF e extraindo todos os dados dos clientes..." 
              : "Estamos calculando a rota mais eficiente para você economizar tempo e combustível..."}
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
