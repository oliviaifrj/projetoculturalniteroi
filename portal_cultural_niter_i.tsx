import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, MapPin, User, Lock, CheckCircle2, Ticket, LogOut, 
  Menu, X, Info, ChevronRight, Barcode, QrCode, Plus, Trash2, Edit 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, onSnapshot, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE (REGRAS OBRIGATÓRIAS)
// ==========================================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'portal-cultural-niteroi';

// ==========================================
// 2. UTILITÁRIOS E DADOS SIMULADOS
// ==========================================
const LOGO_URL = "https://raw.githubusercontent.com/oliviaifrj/projetotcc/main/Projeto%20Cultural%20Niter%C3%B3i/src/assets/f19a20fe8267b1ae417ca0b547fd656760a37f9d.png";

// Gera um código único alfanumérico para ingressos e PIX
const gerarCodigoUnico = () => Math.random().toString(36).substring(2, 10).toUpperCase();

// Gera um código PIX Copia e Cola falso para o simulador
const gerarCodigoPix = () => `00020126580014BR.GOV.BCB.PIX0136${gerarCodigoUnico()}-${gerarCodigoUnico()}520400005303986540510.005802BR5916PORTAL CULTURAL6009NITEROI62070503***6304${gerarCodigoUnico()}`;

// Formata valores para a moeda Real Brasileiro (BRL)
const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

// Componente visual para simular um código de barras de ingresso
const CodigoDeBarrasVisual = ({ codigo }) => {
  const barras = Array.from({ length: 30 }).map((_, i) => (
    <div key={i} className="h-full bg-[#4A3728]" style={{ width: `${Math.max(1, Math.random() * 4)}px`, marginRight: `${Math.random() * 3}px` }}></div>
  ));
  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-lg border border-[#E8DCC4]">
      <div className="flex h-16 items-center w-full justify-center mb-2 overflow-hidden">{barras}</div>
      <span className="font-mono text-sm tracking-widest text-[#6B4226]">{codigo}</span>
    </div>
  );
};

// ==========================================
// 3. COMPONENTE PRINCIPAL (Roteador Central)
// Este componente controla qual página (View) está sendo exibida no momento.
// ==========================================
export default function App() {
  const [usuarioFirebase, setUsuarioFirebase] = useState(null);
  const [usuarioApp, setUsuarioApp] = useState(null); // Perfil simulado do usuário logado
  const [visaoAtual, setVisaoAtual] = useState('home'); // Telas: home, evento, checkout, perfil, login, cadastro, admin
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [meusIngressos, setMeusIngressos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Inicialização da Autenticação
  useEffect(() => {
    const inicializarAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Erro na autenticação", e);
      }
    };
    inicializarAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuarioFirebase(user);
      setCarregando(false);
    });
    return () => unsubscribe();
  }, []);

  // Busca de Eventos Públicos e Ingressos Privados do banco de dados (Firestore)
  useEffect(() => {
    if (!usuarioFirebase) return;

    // Buscar Eventos
    const refEventos = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubEventos = onSnapshot(refEventos, (snapshot) => {
      const dadosEventos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEventos(dadosEventos);
    }, (err) => console.error(err));

    // Buscar Ingressos do Usuário
    const refIngressos = collection(db, 'artifacts', appId, 'users', usuarioFirebase.uid, 'tickets');
    const unsubIngressos = onSnapshot(refIngressos, (snapshot) => {
      const dadosIngressos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMeusIngressos(dadosIngressos);
    }, (err) => console.error(err));

    return () => {
      unsubEventos();
      unsubIngressos();
    };
  }, [usuarioFirebase]);

  // Função auxiliar para mudar de "página"
  const navegarPara = (visao, evento = null) => {
    setVisaoAtual(visao);
    if (evento) setEventoSelecionado(evento);
    setMenuMobileAberto(false);
    window.scrollTo(0, 0);
  };

  // Função auxiliar para deslogar
  const realizarLogout = () => {
    setUsuarioApp(null);
    navegarPara('home');
  };

  // Tela de carregamento enquanto o Firebase conecta
  if (carregando) return <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B5A2B]"></div></div>;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#4A3728]">
      {/* BARRA DE NAVEGAÇÃO (CABEÇALHO) */}
      <nav className="bg-[#FAF6EE] border-b border-[#E8DCC4] sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center cursor-pointer" onClick={() => navegarPara('home')}>
              <img src={LOGO_URL} alt="Logo Portal Cultural" className="h-12 w-auto object-contain" onError={(e) => e.target.style.display='none'} />
              <span className="ml-3 text-xl font-bold text-[#6B4226]">
                Portal Cultural
              </span>
            </div>
            
            {/* Menu Desktop */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Buscar eventos..." 
                  className="pl-10 pr-4 py-2 border border-[#E8DCC4] bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-[#8B5A2B] w-64 text-[#4A3728]"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-[#A68A6B]" />
              </div>
              
              {usuarioApp ? (
                <>
                  <button onClick={() => navegarPara('perfil')} className="flex items-center text-[#6B4226] hover:text-[#8B5A2B] font-medium transition">
                    <User className="w-5 h-5 mr-1" /> Meu Perfil
                  </button>
                  {usuarioApp.isAdmin && (
                    <button onClick={() => navegarPara('admin')} className="flex items-center text-[#A0522D] hover:text-[#8B4513] font-medium transition">
                      <Lock className="w-5 h-5 mr-1" /> Admin
                    </button>
                  )}
                  <button onClick={realizarLogout} className="text-red-500 hover:text-red-700 transition" title="Sair da Conta">
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <div className="flex space-x-3">
                  <button onClick={() => navegarPara('login')} className="px-4 py-2 text-[#8B5A2B] font-medium hover:bg-[#F5E6D3] rounded-lg transition">Entrar</button>
                  <button onClick={() => navegarPara('cadastro')} className="px-4 py-2 bg-[#8B5A2B] text-white font-medium rounded-lg hover:bg-[#6B4226] transition shadow-sm">Cadastrar</button>
                </div>
              )}
            </div>

            {/* Botão Menu Mobile */}
            <div className="flex items-center md:hidden">
              <button onClick={() => setMenuMobileAberto(!menuMobileAberto)} className="text-[#6B4226]">
                {menuMobileAberto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menu Mobile Expandido */}
        {menuMobileAberto && (
          <div className="md:hidden bg-[#FAF6EE] border-b border-[#E8DCC4] px-4 pt-2 pb-4 space-y-3">
             <input 
                  type="text" 
                  placeholder="Buscar eventos..." 
                  className="w-full px-4 py-2 border border-[#E8DCC4] bg-white rounded-lg focus:outline-none"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
              />
              {usuarioApp ? (
                <div className="flex flex-col space-y-3 mt-4">
                  <button onClick={() => navegarPara('perfil')} className="flex items-center text-[#6B4226]"><User className="w-5 h-5 mr-2"/> Perfil & Ingressos</button>
                  {usuarioApp.isAdmin && <button onClick={() => navegarPara('admin')} className="flex items-center text-[#A0522D]"><Lock className="w-5 h-5 mr-2"/> Painel Admin</button>}
                  <button onClick={realizarLogout} className="flex items-center text-red-500"><LogOut className="w-5 h-5 mr-2"/> Sair</button>
                </div>
              ) : (
                <div className="flex flex-col space-y-2 mt-4">
                  <button onClick={() => navegarPara('login')} className="w-full text-center px-4 py-2 border border-[#8B5A2B] text-[#8B5A2B] font-medium rounded-lg">Entrar</button>
                  <button onClick={() => navegarPara('cadastro')} className="w-full text-center px-4 py-2 bg-[#8B5A2B] text-white font-medium rounded-lg">Cadastrar</button>
                </div>
              )}
          </div>
        )}
      </nav>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (RENDERIZAÇÃO CONDICIONAL DAS "PÁGINAS") */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {visaoAtual === 'home' && <PaginaInicial eventos={eventos} busca={busca} navegarPara={navegarPara} />}
        
        {visaoAtual === 'evento' && eventoSelecionado && <PaginaDetalhesEvento evento={eventoSelecionado} usuarioApp={usuarioApp} navegarPara={navegarPara} />}
        
        {visaoAtual === 'checkout' && eventoSelecionado && usuarioApp && (
          <ProcessoCheckout 
            evento={eventoSelecionado} 
            usuario={usuarioApp} 
            usuarioFirebase={usuarioFirebase}
            db={db}
            appId={appId}
            aoCompletar={() => navegarPara('perfil')}
            aoCancelar={() => navegarPara('evento', eventoSelecionado)}
          />
        )}

        {(visaoAtual === 'login' || visaoAtual === 'cadastro') && (
          <FormulariosAutenticacao 
            visao={visaoAtual} 
            setVisao={setVisaoAtual} 
            setUsuarioApp={setUsuarioApp}
            usuarioFirebase={usuarioFirebase}
            db={db}
            appId={appId}
          />
        )}

        {visaoAtual === 'perfil' && usuarioApp && <PaginaPerfil usuarioApp={usuarioApp} meusIngressos={meusIngressos} navegarPara={navegarPara} />}

        {visaoAtual === 'admin' && usuarioApp?.isAdmin && <PainelAdministrador eventos={eventos} db={db} appId={appId} />}

      </main>
    </div>
  );
}

// ==========================================
// COMPONENTE: PÁGINA INICIAL
// ==========================================
const PaginaInicial = ({ eventos, busca, navegarPara }) => (
  <div className="space-y-12">
    {/* Banner Principal (Hero Section) */}
    <div className="relative rounded-2xl overflow-hidden bg-[#3E2723] text-white shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-[#3E2723] to-transparent z-10"></div>
      <img src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80" alt="Cultura Niterói" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
      <div className="relative z-20 p-8 md:p-16 w-full md:w-2/3">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-[#FAF6EE]">Descubra a Cultura em Niterói</h1>
        <p className="text-lg text-[#E8DCC4] mb-8 max-w-xl">Encontre shows, peças de teatro, exposições e muito mais. Reserve seu ingresso e viva a cidade.</p>
        <button onClick={() => document.getElementById('grade-eventos').scrollIntoView({behavior: 'smooth'})} className="px-6 py-3 bg-[#A0522D] hover:bg-[#8B4513] text-white font-bold rounded-full transition shadow-lg flex items-center">
          Ver Programação <ChevronRight className="ml-2 w-5 h-5" />
        </button>
      </div>
    </div>

    {/* Grade de Eventos */}
    <div id="grade-eventos">
      <h2 className="text-2xl font-bold text-[#4A3728] mb-6 flex items-center"><Calendar className="mr-2 text-[#8B5A2B]" /> Próximos Eventos</h2>
      
      {eventos.length === 0 ? (
        <div className="text-center py-12 text-[#A68A6B]">Nenhum evento programado no momento.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventos
            .filter(e => e.title.toLowerCase().includes(busca.toLowerCase()) || e.category.toLowerCase().includes(busca.toLowerCase()))
            .map(evento => (
            <div key={evento.id} onClick={() => navegarPara('evento', evento)} className="bg-white rounded-xl shadow-sm border border-[#E8DCC4] overflow-hidden cursor-pointer hover:shadow-md transition group">
              <div className="h-48 overflow-hidden relative bg-[#FAF6EE]">
                <img src={evento.imageUrl || 'https://via.placeholder.com/400x300?text=Sem+Imagem'} alt={evento.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                <div className="absolute top-3 right-3 bg-white px-3 py-1 rounded-full text-xs font-bold text-[#8B5A2B] shadow">
                  {evento.category}
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-[#4A3728] mb-2 line-clamp-1">{evento.title}</h3>
                <div className="space-y-2 text-sm text-[#6B4226] mb-4">
                  <div className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-[#A68A6B]" /> {new Date(evento.date).toLocaleDateString('pt-BR')} às {evento.time}</div>
                  <div className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-[#A68A6B]" /> {evento.location}</div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-[#E8DCC4]">
                  <span className="font-bold text-lg text-[#4A3728]">
                    {evento.isFree ? <span className="text-[#A0522D]">Gratuito</span> : formatarMoeda(evento.price)}
                  </span>
                  <button className="text-[#8B5A2B] font-medium hover:text-[#6B4226] text-sm flex items-center transition">
                    Detalhes <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ==========================================
// COMPONENTE: DETALHES DO EVENTO
// ==========================================
const PaginaDetalhesEvento = ({ evento, usuarioApp, navegarPara }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-[#E8DCC4] overflow-hidden max-w-4xl mx-auto">
    {/* Imagem de Capa do Evento */}
    <div className="h-64 md:h-96 w-full relative bg-[#FAF6EE]">
       <img src={evento.imageUrl || 'https://via.placeholder.com/800x400'} alt={evento.title} className="w-full h-full object-cover" />
       <div className="absolute inset-0 bg-gradient-to-t from-[#2C1A14]/80 to-transparent"></div>
       <div className="absolute bottom-6 left-6 right-6 text-white">
         <span className="bg-[#A0522D] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3 inline-block">{evento.category}</span>
         <h1 className="text-3xl md:text-4xl font-extrabold text-[#FAF6EE]">{evento.title}</h1>
       </div>
    </div>
    
    {/* Informações Textuais */}
    <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-6">
        <div>
          <h3 className="text-xl font-bold text-[#4A3728] mb-3">Sobre o Evento</h3>
          <p className="text-[#6B4226] leading-relaxed whitespace-pre-wrap">{evento.description}</p>
        </div>
        
        {evento.observations && (
          <div className="bg-[#FAF6EE] p-4 rounded-xl border border-[#E8DCC4] flex items-start">
            <Info className="w-5 h-5 text-[#8B5A2B] mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[#6B4226]">{evento.observations}</p>
          </div>
        )}
      </div>

      {/* Card Lateral de Compra/Reserva */}
      <div className="bg-[#FDFBF7] p-6 rounded-xl border border-[#E8DCC4] h-fit space-y-6">
        <div className="space-y-4">
          <div className="flex items-center text-[#6B4226]">
            <Calendar className="w-5 h-5 mr-3 text-[#8B5A2B]" />
            <div>
              <p className="font-semibold">{new Date(evento.date).toLocaleDateString('pt-BR')}</p>
              <p className="text-sm text-[#A68A6B]">{evento.time}</p>
            </div>
          </div>
          <div className="flex items-center text-[#6B4226]">
            <MapPin className="w-5 h-5 mr-3 text-[#8B5A2B]" />
            <div>
              <p className="font-semibold">{evento.location}</p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[#E8DCC4]">
          <p className="text-sm text-[#A68A6B] mb-1">Valor do Ingresso</p>
          <p className="text-3xl font-bold text-[#4A3728] mb-4">
            {evento.isFree ? "Gratuito" : formatarMoeda(evento.price)}
          </p>
          <button 
            onClick={() => usuarioApp ? navegarPara('checkout', evento) : navegarPara('login')}
            className="w-full py-3 bg-[#8B5A2B] text-white font-bold rounded-xl hover:bg-[#6B4226] transition shadow-md flex justify-center items-center"
          >
            <Ticket className="w-5 h-5 mr-2" />
            {usuarioApp ? "Garantir Ingresso" : "Faça Login para Comprar"}
          </button>
          <p className="text-center text-xs text-[#A68A6B] mt-3">Sujeito à disponibilidade ({evento.capacity} vagas totais)</p>
        </div>
      </div>
    </div>
  </div>
);

// ==========================================
// COMPONENTE: FLUXO DE PAGAMENTO (CHECKOUT)
// ==========================================
const ProcessoCheckout = ({ evento, usuario, usuarioFirebase, db, appId, aoCompletar, aoCancelar }) => {
  const [etapa, setEtapa] = useState(1); // 1: Selecionar Tipo, 2: Pagamento, 3: Sucesso
  const [tipoIngresso, setTipoIngresso] = useState('Inteira');
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [processando, setProcessando] = useState(false);
  const [idIngressoGerado, setIdIngressoGerado] = useState('');

  // Mapeamento de preços simulados
  const tabelaPrecos = {
    'Inteira': evento.price,
    'Meia-Entrada': evento.price / 2,
    'Especial (PCD)': 0,
    'Gratuito': 0
  };

  const precoAtual = evento.isFree ? 0 : tabelaPrecos[tipoIngresso];

  const processarPagamentoSimulado = async () => {
    setProcessando(true);
    // Simula tempo de rede bancária
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Gerar registro do ingresso no Firebase
    try {
      const refIngressos = collection(db, 'artifacts', appId, 'users', usuarioFirebase.uid, 'tickets');
      const novoCodigoIngresso = gerarCodigoUnico() + gerarCodigoUnico();
      const dadosIngresso = {
        eventId: evento.id,
        eventTitle: evento.title,
        eventDate: new Date(evento.date).toLocaleDateString('pt-BR'),
        ticketType: evento.isFree ? 'Gratuito' : tipoIngresso,
        pricePaid: precoAtual,
        ownerName: usuario.fullName,
        ownerCpf: usuario.cpf,
        ticketCode: novoCodigoIngresso,
        purchasedAt: new Date().toISOString()
      };
      await addDoc(refIngressos, dadosIngresso);
      setIdIngressoGerado(novoCodigoIngresso);
      setEtapa(3);
    } catch (e) {
      console.error("Erro ao criar ingresso", e);
      alert("Erro ao processar ingresso.");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-[#E8DCC4] overflow-hidden">
      <div className="bg-[#8B5A2B] p-6 text-white text-center">
        <h2 className="text-2xl font-bold text-[#FAF6EE]">Finalizar Reserva</h2>
        <p className="text-[#E8DCC4] mt-1">{evento.title}</p>
      </div>

      <div className="p-6 md:p-8">
        {/* ETAPA 1: ESCOLHA DO TIPO DE INGRESSO */}
        {etapa === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-[#4A3728] border-b border-[#E8DCC4] pb-2">1. Selecione o tipo de ingresso</h3>
            {!evento.isFree ? (
              <div className="space-y-3">
                {['Inteira', 'Meia-Entrada', 'Especial (PCD)'].map(tipo => (
                  <label key={tipo} className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${tipoIngresso === tipo ? 'border-[#8B5A2B] bg-[#FAF6EE]' : 'border-[#E8DCC4] hover:bg-[#FDFBF7]'}`}>
                    <input type="radio" name="tipoIngresso" value={tipo} checked={tipoIngresso === tipo} onChange={(e) => setTipoIngresso(e.target.value)} className="w-5 h-5 text-[#8B5A2B] focus:ring-[#8B5A2B] accent-[#8B5A2B]" />
                    <span className="ml-3 flex-1 font-medium text-[#4A3728]">{tipo}</span>
                    <span className="font-bold text-[#6B4226]">{formatarMoeda(tabelaPrecos[tipo])}</span>
                  </label>
                ))}
                <p className="text-xs text-[#A68A6B] mt-2">* Comprovantes de meia-entrada ou condição especial serão exigidos na portaria.</p>
              </div>
            ) : (
              <div className="p-4 bg-[#F5E6D3] border border-[#D2B48C] rounded-xl text-[#6B4226] font-medium flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-[#8B5A2B]" /> Evento Gratuito. Apenas confirme sua reserva.
              </div>
            )}

            <div className="pt-6 flex justify-between items-center">
              <button onClick={aoCancelar} className="text-[#A68A6B] hover:text-[#6B4226] font-medium transition">Cancelar</button>
              <button onClick={() => setEtapa(2)} className="px-6 py-3 bg-[#8B5A2B] text-white font-bold rounded-xl hover:bg-[#6B4226] transition">
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 2: PAGAMENTO SIMULADO */}
        {etapa === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-[#4A3728] border-b border-[#E8DCC4] pb-2">2. Pagamento</h3>
            
            <div className="bg-[#FDFBF7] p-4 rounded-xl border border-[#E8DCC4] flex justify-between items-center mb-6">
              <span className="text-[#6B4226]">Total a pagar:</span>
              <span className="text-2xl font-bold text-[#8B5A2B]">{formatarMoeda(precoAtual)}</span>
            </div>

            {precoAtual > 0 ? (
              <div className="space-y-4">
                <div className="flex space-x-4 mb-4">
                  <button onClick={() => setMetodoPagamento('pix')} className={`flex-1 py-3 border rounded-xl font-medium flex flex-col items-center transition ${metodoPagamento === 'pix' ? 'border-[#A0522D] bg-[#FDF5E6] text-[#A0522D]' : 'border-[#E8DCC4] text-[#A68A6B]'}`}>
                    <QrCode className="w-6 h-6 mb-1" /> PIX
                  </button>
                  <button onClick={() => setMetodoPagamento('boleto')} className={`flex-1 py-3 border rounded-xl font-medium flex flex-col items-center transition ${metodoPagamento === 'boleto' ? 'border-[#8B5A2B] bg-[#FAF6EE] text-[#8B5A2B]' : 'border-[#E8DCC4] text-[#A68A6B]'}`}>
                    <Barcode className="w-6 h-6 mb-1" /> Boleto
                  </button>
                </div>

                {metodoPagamento === 'pix' && (
                  <div className="text-center p-6 border border-dashed border-[#D2B48C] bg-[#FDFBF7] rounded-xl">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg" alt="QR Code PIX Simulacao" className="w-32 h-32 mx-auto mb-4 opacity-30 mix-blend-multiply" />
                    <p className="text-sm font-medium text-[#6B4226] mb-2">Código PIX Copia e Cola:</p>
                    <div className="bg-white p-2 border border-[#E8DCC4] rounded text-xs break-all font-mono text-[#8B5A2B] select-all">
                      {gerarCodigoPix()}
                    </div>
                  </div>
                )}

                 {metodoPagamento === 'boleto' && (
                  <div className="text-center p-6 border border-dashed border-[#D2B48C] bg-[#FDFBF7] rounded-xl">
                    <Barcode className="w-full h-16 text-[#8B5A2B] mx-auto mb-4 opacity-50" />
                    <p className="text-sm font-medium text-[#6B4226] mb-2">Código de Barras:</p>
                    <div className="bg-white p-2 border border-[#E8DCC4] rounded text-sm tracking-widest font-mono text-[#8B5A2B] select-all">
                      34191.09008 63571.277308 71444.640008 5 95000000{precoAtual.toString().replace('.','')}
                    </div>
                  </div>
                )}
              </div>
            ) : (
               <div className="text-center p-6 text-[#A68A6B]">
                 Nenhum pagamento é necessário. Clique em confirmar para emitir o ingresso gratuito.
               </div>
            )}

            <div className="pt-6 flex justify-between items-center">
              <button onClick={() => setEtapa(1)} className="text-[#A68A6B] hover:text-[#6B4226] font-medium transition">Voltar</button>
              <button 
                onClick={processarPagamentoSimulado} 
                disabled={processando}
                className="px-6 py-3 bg-[#A0522D] text-white font-bold rounded-xl hover:bg-[#8B4513] transition disabled:opacity-50 flex items-center"
              >
                {processando ? "Processando..." : (precoAtual > 0 ? "Confirmar Pagamento Simulado" : "Emitir Ingresso Gratuito")}
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3: SUCESSO */}
        {etapa === 3 && (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 bg-[#F5E6D3] text-[#A0522D] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-[#4A3728]">Reserva Confirmada!</h3>
            <p className="text-[#6B4226]">Seu ingresso foi emitido com sucesso e adicionado ao seu perfil.</p>
            <div className="bg-[#FAF6EE] border border-[#E8DCC4] p-4 rounded-xl inline-block text-left w-full max-w-sm">
              <p className="text-sm text-[#A68A6B] mb-1">Código Único do Ingresso:</p>
              <p className="font-mono font-bold tracking-widest text-lg text-[#8B5A2B]">{idIngressoGerado}</p>
            </div>
            <div className="pt-4">
              <button onClick={aoCompletar} className="w-full px-6 py-3 bg-[#8B5A2B] text-white font-bold rounded-xl hover:bg-[#6B4226] transition">
                Ver Meus Ingressos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// COMPONENTE: LOGIN E CADASTRO
// Simula a criação de usuários no Firebase para a interface
// ==========================================
const FormulariosAutenticacao = ({ visao, setVisao, setUsuarioApp, usuarioFirebase, db, appId }) => {
  const [dadosFormulario, setDadosFormulario] = useState({ fullName: '', cpf: '', email: '', password: '' });
  const [erro, setErro] = useState('');

  const ehLogin = visao === 'login';

  const submeterFormulario = async (e) => {
    e.preventDefault();
    setErro('');

    if (!usuarioFirebase) {
      setErro("Erro de conexão de segurança. Atualize a página.");
      return;
    }

    try {
      // Mock para o TCC: Armazenamos o perfil numa coleção "mockUsers"
      const refUsuarios = collection(db, 'artifacts', appId, 'public', 'data', 'mockUsers');
      const consulta = await getDocs(refUsuarios);
      const usuariosExistentes = consulta.docs.map(d => ({id: d.id, ...d.data()}));

      if (ehLogin) {
        // Encontrar usuário
        const usuarioEncontrado = usuariosExistentes.find(u => (u.email === dadosFormulario.email || u.cpf === dadosFormulario.email) && u.password === dadosFormulario.password);
        
        // Acesso Admin (Backdoor para testes TCC)
        if (dadosFormulario.email === 'admin@admin.com') {
           setUsuarioApp({ fullName: 'Administrador Cultura', email: 'admin@admin.com', cpf: '000.000.000-00', isAdmin: true });
           setVisao('home');
           return;
        }

        if (usuarioEncontrado) {
          setUsuarioApp(usuarioEncontrado);
          setVisao('home');
        } else {
          setErro("Credenciais inválidas. Verifique seu email/CPF e senha.");
        }
      } else {
        // Cadastro
        if (usuariosExistentes.some(u => u.email === dadosFormulario.email || u.cpf === dadosFormulario.cpf)) {
           setErro("Este Email ou CPF já está cadastrado no sistema.");
           return;
        }
        const novoUsuario = {
          fullName: dadosFormulario.fullName,
          cpf: dadosFormulario.cpf,
          email: dadosFormulario.email,
          password: dadosFormulario.password, // (Apenas para mock escolar)
          isAdmin: false
        };
        await addDoc(refUsuarios, novoUsuario);
        setUsuarioApp(novoUsuario);
        setVisao('home');
      }
    } catch (err) {
      console.error(err);
      setErro("Erro no servidor de banco de dados.");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-2xl shadow-md border border-[#E8DCC4]">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#4A3728]">{ehLogin ? 'Acesse sua conta' : 'Crie sua conta'}</h2>
        <p className="text-[#A68A6B] text-sm mt-2">{ehLogin ? 'Para comprar ingressos e ver seus pedidos.' : 'Preencha seus dados para vivenciar a cultura.'}</p>
      </div>

      {erro && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-200">{erro}</div>}

      <form onSubmit={submeterFormulario} className="space-y-4">
        {!ehLogin && (
          <>
            <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Nome Completo</label>
              <input type="text" required className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-2 focus:ring-[#8B5A2B] outline-none text-[#4A3728]" value={dadosFormulario.fullName} onChange={e => setDadosFormulario({...dadosFormulario, fullName: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-1">CPF</label>
              <input type="text" required placeholder="000.000.000-00" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-2 focus:ring-[#8B5A2B] outline-none text-[#4A3728]" value={dadosFormulario.cpf} onChange={e => setDadosFormulario({...dadosFormulario, cpf: e.target.value})} />
            </div>
          </>
        )}
        
        <div>
          <label className="block text-sm font-medium text-[#6B4226] mb-1">{ehLogin ? 'Email ou CPF' : 'Email'}</label>
          <input type="text" required className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-2 focus:ring-[#8B5A2B] outline-none text-[#4A3728]" value={dadosFormulario.email} onChange={e => setDadosFormulario({...dadosFormulario, email: e.target.value})} />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[#6B4226] mb-1">Senha</label>
          <input type="password" required className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-2 focus:ring-[#8B5A2B] outline-none text-[#4A3728]" value={dadosFormulario.password} onChange={e => setDadosFormulario({...dadosFormulario, password: e.target.value})} />
        </div>

        <button type="submit" className="w-full py-3 mt-4 bg-[#8B5A2B] text-white font-bold rounded-xl hover:bg-[#6B4226] transition shadow-sm">
          {ehLogin ? 'Entrar no Portal' : 'Concluir Cadastro'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-[#A68A6B]">
        {ehLogin ? (
          <p>Não tem conta? <button onClick={() => setVisao('cadastro')} className="text-[#A0522D] font-bold hover:underline">Cadastre-se grátis</button></p>
        ) : (
          <p>Já tem uma conta? <button onClick={() => setVisao('login')} className="text-[#A0522D] font-bold hover:underline">Faça login</button></p>
        )}
        {ehLogin && <p className="mt-4 text-xs text-[#D2B48C]">Para acessar como Admin no TCC, use email "admin@admin.com"</p>}
      </div>
    </div>
  );
};

// ==========================================
// COMPONENTE: PERFIL DO USUÁRIO E INGRESSOS
// ==========================================
const PaginaPerfil = ({ usuarioApp, meusIngressos, navegarPara }) => (
  <div className="max-w-4xl mx-auto space-y-8">
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E8DCC4] flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
      <div className="w-24 h-24 bg-[#FAF6EE] rounded-full flex items-center justify-center text-[#8B5A2B] border-4 border-[#E8DCC4] shadow-sm">
        <User className="w-12 h-12" />
      </div>
      <div className="text-center md:text-left flex-1">
        <h2 className="text-2xl font-bold text-[#4A3728]">{usuarioApp.fullName}</h2>
        <p className="text-[#A68A6B]">{usuarioApp.email}</p>
        <div className="mt-2 flex items-center justify-center md:justify-start space-x-4">
          <span className="text-sm bg-[#FDFBF7] border border-[#E8DCC4] px-3 py-1 rounded-full text-[#6B4226]">CPF: {usuarioApp.cpf}</span>
          {usuarioApp.isAdmin && <span className="text-sm bg-[#F5E6D3] border border-[#D2B48C] px-3 py-1 rounded-full text-[#8B5A2B] font-medium">Conta Administrador</span>}
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-xl font-bold text-[#4A3728] mb-4 flex items-center"><Ticket className="mr-2 text-[#8B5A2B]" /> Meus Ingressos</h3>
      {meusIngressos.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-[#E8DCC4] text-center text-[#A68A6B] shadow-sm">
          Você ainda não possui ingressos. <button onClick={() => navegarPara('home')} className="text-[#A0522D] font-medium underline">Explorar eventos</button>
        </div>
      ) : (
        <div className="space-y-4">
          {meusIngressos.map(ingresso => (
            <div key={ingresso.id} className="bg-white rounded-xl shadow-sm border border-[#E8DCC4] overflow-hidden flex flex-col md:flex-row">
              <div className="p-6 flex-1 flex flex-col justify-center border-b md:border-b-0 md:border-r border-dashed border-[#D2B48C]">
                <span className="text-xs font-bold uppercase text-[#A0522D] tracking-wider mb-1">{ingresso.ticketType}</span>
                <h4 className="text-xl font-bold text-[#4A3728] mb-2">{ingresso.eventTitle}</h4>
                <div className="text-sm text-[#6B4226] space-y-1">
                  <p><Calendar className="w-4 h-4 inline mr-1 text-[#A68A6B]" /> {ingresso.eventDate}</p>
                  <p><User className="w-4 h-4 inline mr-1 text-[#A68A6B]" /> Titular: {ingresso.ownerName}</p>
                </div>
              </div>
              <div className="p-6 bg-[#FAF6EE] md:w-64 flex flex-col items-center justify-center">
                <CodigoDeBarrasVisual codigo={ingresso.ticketCode} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ==========================================
// COMPONENTE: PAINEL ADMINISTRATIVO (CRUD EVENTOS)
// ==========================================
const PainelAdministrador = ({ eventos, db, appId }) => {
  const [editando, setEditando] = useState(false);
  const [dadosFormulario, setDadosFormulario] = useState({ title: '', description: '', date: '', time: '', location: '', imageUrl: '', price: 0, capacity: 100, category: 'Música', isFree: false, observations: '' });
  const [idEdicao, setIdEdicao] = useState(null);

  const limparFormulario = () => {
    setDadosFormulario({ title: '', description: '', date: '', time: '', location: '', imageUrl: '', price: 0, capacity: 100, category: 'Música', isFree: false, observations: '' });
    setIdEdicao(null);
    setEditando(false);
  };

  const salvarEvento = async (e) => {
    e.preventDefault();
    const payload = {
      ...dadosFormulario,
      price: Number(dadosFormulario.price),
      capacity: Number(dadosFormulario.capacity),
      isFree: Boolean(dadosFormulario.isFree)
    };

    try {
      if (idEdicao) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', idEdicao), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), payload);
      }
      limparFormulario();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar evento");
    }
  };

  const deletarEvento = async (id) => {
    if (confirm("Certeza que deseja excluir este evento do portal?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', id));
    }
  };

  const iniciarEdicao = (ev) => {
    setDadosFormulario(ev);
    setIdEdicao(ev.id);
    setEditando(true);
    window.scrollTo(0, 0);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Cabeçalho do Admin */}
      <div className="flex justify-between items-center bg-[#4A3728] text-[#FAF6EE] p-6 rounded-2xl shadow-md border border-[#3E2723]">
        <div>
          <h2 className="text-2xl font-bold flex items-center"><Lock className="mr-2 text-[#D2B48C]" /> Painel Administrativo</h2>
          <p className="text-[#D2B48C] text-sm mt-1">Gerenciamento oficial de eventos do Portal Cultural Niterói</p>
        </div>
        {!editando && (
          <button onClick={() => setEditando(true)} className="px-4 py-2 bg-[#A0522D] hover:bg-[#8B4513] text-white font-bold rounded-lg flex items-center transition shadow-sm">
            <Plus className="w-5 h-5 mr-1" /> Novo Evento
          </button>
        )}
      </div>

      {/* Formulário de Criação/Edição */}
      {editando && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md border border-[#E8DCC4]">
          <h3 className="text-xl font-bold text-[#4A3728] mb-6">{idEdicao ? 'Editar Evento Existente' : 'Cadastrar Novo Evento'}</h3>
          <form onSubmit={salvarEvento} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Título do Evento</label>
              <input required type="text" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.title} onChange={e=>setDadosFormulario({...dadosFormulario, title: e.target.value})} />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Descrição Completa</label>
              <textarea required rows="3" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.description} onChange={e=>setDadosFormulario({...dadosFormulario, description: e.target.value})}></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Data</label>
              <input required type="date" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.date} onChange={e=>setDadosFormulario({...dadosFormulario, date: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Horário</label>
              <input required type="time" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.time} onChange={e=>setDadosFormulario({...dadosFormulario, time: e.target.value})} />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Local</label>
              <input required type="text" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.location} onChange={e=>setDadosFormulario({...dadosFormulario, location: e.target.value})} />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-[#6B4226] mb-1">URL da Imagem de Capa (Link)</label>
              <input type="url" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.imageUrl} onChange={e=>setDadosFormulario({...dadosFormulario, imageUrl: e.target.value})} />
            </div>

             <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Categoria Principal</label>
              <select className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.category} onChange={e=>setDadosFormulario({...dadosFormulario, category: e.target.value})}>
                <option value="Música">Música / Shows</option>
                <option value="Teatro">Teatro</option>
                <option value="Exposição">Exposição</option>
                <option value="Cinema">Cinema</option>
                <option value="Dança">Dança</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

             <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Capacidade (Total de Ingressos)</label>
              <input required type="number" min="1" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.capacity} onChange={e=>setDadosFormulario({...dadosFormulario, capacity: e.target.value})} />
            </div>

             <div className="col-span-1 md:col-span-2 flex items-center space-x-4 p-4 bg-[#FAF6EE] rounded-lg border border-[#E8DCC4]">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 text-[#8B5A2B] rounded border-[#D2B48C] focus:ring-[#8B5A2B]" checked={dadosFormulario.isFree} onChange={e=>setDadosFormulario({...dadosFormulario, isFree: e.target.checked, price: e.target.checked ? 0 : dadosFormulario.price})} />
                  <span className="font-medium text-[#4A3728]">O Evento é Gratuito</span>
                </label>
                
                {!dadosFormulario.isFree && (
                  <div className="flex-1 flex items-center border-l border-[#D2B48C] pl-4 ml-4">
                    <span className="mr-2 text-sm text-[#6B4226]">Valor Inteira (R$):</span>
                    <input required type="number" step="0.01" min="0" className="w-32 px-4 py-2 border border-[#E8DCC4] rounded-lg text-[#4A3728]" value={dadosFormulario.price} onChange={e=>setDadosFormulario({...dadosFormulario, price: e.target.value})} />
                  </div>
                )}
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-[#6B4226] mb-1">Observações (Avisos legais, meia-entrada, faixa etária)</label>
              <input type="text" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:ring-[#8B5A2B] text-[#4A3728]" value={dadosFormulario.observations} onChange={e=>setDadosFormulario({...dadosFormulario, observations: e.target.value})} />
            </div>

            <div className="col-span-1 md:col-span-2 flex justify-end space-x-4 pt-6 border-t border-[#E8DCC4]">
               <button type="button" onClick={limparFormulario} className="px-6 py-2 text-[#A68A6B] font-medium hover:bg-[#FDFBF7] rounded-lg transition">Cancelar</button>
               <button type="submit" className="px-6 py-2 bg-[#8B5A2B] text-white font-bold rounded-lg hover:bg-[#6B4226] transition shadow-sm">Salvar Evento no Portal</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de Eventos Cadastrados */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E8DCC4] overflow-hidden">
        <div className="p-6 border-b border-[#E8DCC4] bg-[#FAF6EE]">
          <h3 className="text-lg font-bold text-[#4A3728]">Lista de Eventos Publicados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FDFBF7] text-[#8B5A2B] text-sm uppercase tracking-wider border-b border-[#E8DCC4]">
                <th className="p-4 font-bold">Informações do Evento</th>
                <th className="p-4 font-bold">Data / Localização</th>
                <th className="p-4 font-bold">Preço Base</th>
                <th className="p-4 font-bold">Capacidade</th>
                <th className="p-4 font-bold text-right">Controles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DCC4]">
              {eventos.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-[#A68A6B]">Nenhum evento registrado ainda.</td></tr>
              ) : eventos.map(ev => (
                <tr key={ev.id} className="hover:bg-[#FAF6EE] transition">
                  <td className="p-4">
                    <div className="font-bold text-[#4A3728] text-base">{ev.title}</div>
                    <div className="text-xs text-[#A0522D] mt-1 px-2 py-0.5 bg-[#F5E6D3] rounded-full inline-block font-medium">{ev.category}</div>
                  </td>
                  <td className="p-4 text-sm text-[#6B4226]">
                    <div className="font-medium">{new Date(ev.date).toLocaleDateString('pt-BR')} às {ev.time}</div>
                    <div className="text-xs mt-0.5 text-[#A68A6B]">{ev.location}</div>
                  </td>
                  <td className="p-4 font-bold text-[#8B5A2B]">
                    {ev.isFree ? <span className="text-[#A0522D]">Entrada Franca</span> : formatarMoeda(ev.price)}
                  </td>
                  <td className="p-4 text-sm text-[#6B4226]">
                    <span className="font-mono bg-[#FDFBF7] px-2 py-1 rounded border border-[#E8DCC4]">{ev.capacity} ingressos</span>
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <button onClick={() => iniciarEdicao(ev)} className="p-2 text-[#8B5A2B] hover:bg-[#F5E6D3] rounded-lg transition mr-2" title="Editar informações">
                      <Edit className="w-5 h-5" />
                    </button>
                    <button onClick={() => deletarEvento(ev.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Excluir evento">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};