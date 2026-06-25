import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, MapPin, User, Lock, CheckCircle2, Ticket, LogOut, 
  Menu, X, Info, ChevronRight, Barcode, QrCode, Plus, Trash2, Edit, 
  Link as LinkIcon, Users, FileText, Heart, Filter, Tag
} from 'lucide-react';

// Importações do Firebase para Autenticação e Banco de Dados (Firestore)
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, onSnapshot, addDoc, deleteDoc, updateDoc, query, where, increment, arrayUnion, arrayRemove } from 'firebase/firestore';

// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDrNYJQY-v6f32L5HfgkWvurdohVgiYRQ8",
  authDomain: "bd-projetoculturalnit.firebaseapp.com",
  databaseURL: "https://bd-projetoculturalnit-default-rtdb.firebaseio.com",
  projectId: "bd-projetoculturalnit",
  storageBucket: "bd-projetoculturalnit.firebasestorage.app",
  messagingSenderId: "746322198527",
  appId: "1:746322198527:web:53b2afdcfc81ec168db1ca",
  measurementId: "G-LXQ0Q2HH9E"
};

// Inicialização dos serviços do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// E-mail oficial do Administrador. Logar com este e-mail libera a aba "Admin"
const ADMIN_EMAIL = 'admin@portalculturalniteroi.com';

// URL da logo do projeto
const LOGO_URL = "https://i.ibb.co/Ndy0fgDs/ce6e3ae7-066a-412f-afd0-f12b8075418c.png";

// ==========================================
// 2. FUNÇÕES UTILITÁRIAS
// ==========================================

// Gera um código alfanumérico aleatório para os ingressos
const gerarCodigoUnico = () => Math.random().toString(36).substring(2, 10).toUpperCase();

// Gera um código PIX no formato padrão do Banco Central para o simulador
const gerarCodigoPix = () => `00020126580014BR.GOV.BCB.PIX0136${gerarCodigoUnico()}-${gerarCodigoUnico()}520400005303986540510.005802BR5916PORTAL CULTURAL6009NITEROI62070503***6304${gerarCodigoUnico()}`;

// Converte valores numéricos para o formato da moeda brasileira (R$)
const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

// Componente visual que desenha um "código de barras" baseado em divs com larguras aleatórias
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
// Este componente gerencia o estado global e a navegação (Single Page Application)
// ==========================================
export default function App() {
  // Estados de Autenticação e Usuário
  const [usuarioFirebase, setUsuarioFirebase] = useState(null); // Objeto de usuário do Firebase Auth
  const [usuarioApp, setUsuarioApp] = useState(null); // Dados do perfil do usuário salvos no Firestore
  
  // Estado de Navegação
  const [visaoAtual, setVisaoAtual] = useState('home'); // Define qual tela será renderizada
  const [eventoSelecionado, setEventoSelecionado] = useState(null); // Guarda o evento clicado para exibir detalhes
  
  // Estados de Dados (Eventos, Categorias e Ingressos)
  const [eventos, setEventos] = useState([]);
  const [categoriasGlobais, setCategoriasGlobais] = useState([]);
  const [meusIngressos, setMeusIngressos] = useState([]);
  
  // Estados de Interface
  const [carregando, setCarregando] = useState(true);
  const [termoBuscaNav, setTermoBuscaNav] = useState('');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Hook 1: Monitora mudanças de login/logout no Firebase Authentication
  useEffect(() => {
    let unsubUser = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUsuarioFirebase(user);
      if (user) {
        // Se for o Admin, cria um perfil falso de admin localmente
        if (user.email === ADMIN_EMAIL) {
          setUsuarioApp({ fullName: 'Administrador Cultura', email: user.email, isAdmin: true, uid: user.uid, cpf: '000.000.000-00', savedEvents: [] });
          setCarregando(false);
        } else {
          // Se for usuário comum, busca os dados completos dele no Firestore (coleção 'users')
          unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) setUsuarioApp({ ...docSnap.data(), email: user.email, uid: user.uid, isAdmin: false });
            setCarregando(false);
          });
        }
      } else {
        setUsuarioApp(null);
        setCarregando(false);
      }
    });
    return () => { unsubscribeAuth(); unsubUser(); };
  }, []);

  // Hook 2: Busca Eventos, Categorias e Ingressos em tempo real (onSnapshot)
  useEffect(() => {
    // Busca todos os eventos cadastrados
    const unsubEventos = onSnapshot(collection(db, 'events'), (snapshot) => {
      setEventos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Erro eventos:", err));

    // Busca todas as categorias geradas pelo Admin
    const unsubCategorias = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategoriasGlobais(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Erro categorias:", err));

    // Busca os ingressos comprados pelo usuário logado (se não for admin)
    let unsubIngressos = () => {};
    if (usuarioFirebase && usuarioApp && !usuarioApp.isAdmin) {
      const qIngressos = query(collection(db, 'tickets'), where('userId', '==', usuarioFirebase.uid));
      unsubIngressos = onSnapshot(qIngressos, (snapshot) => {
        setMeusIngressos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.error("Erro ingressos:", err));
    } else {
      setMeusIngressos([]);
    }

    return () => { unsubEventos(); unsubCategorias(); unsubIngressos(); };
  }, [usuarioFirebase, usuarioApp?.isAdmin]);

  // Função que altera a tela atual e reseta o scroll
  const navegarPara = (visao, evento = null) => {
    setVisaoAtual(visao);
    if (evento) setEventoSelecionado(evento);
    setMenuMobileAberto(false);
    window.scrollTo(0, 0);
  };

  // Função para deslogar do sistema
  const realizarLogout = async () => {
    try { await signOut(auth); navegarPara('home'); } 
    catch (e) { console.error("Erro ao deslogar:", e); }
  };

  // Função para executar a busca ao apertar "Enter" ou clicar na lupa
  const submeterBuscaNav = (e) => {
    if (e.key === 'Enter' || e.type === 'click') navegarPara('busca');
  };

  // Tela de loading inicial
  if (carregando) return <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B5A2B]"></div></div>;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#4A3728]">
      {/* BARRA DE NAVEGAÇÃO SUPERIOR */}
      <nav className="bg-[#FAF6EE] border-b border-[#E8DCC4] sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            {/* Logo e Nome */}
            <div className="flex items-center cursor-pointer" onClick={() => navegarPara('home')}>
              <img src={LOGO_URL} alt="Logo" className="h-12 w-auto object-contain mr-3" onError={(e) => e.target.style.display='none'} />
              <span className="text-xl font-bold text-[#6B4226]">Portal Cultural Niterói</span>
            </div>
            
            {/* Links e Busca (Desktop) */}
            <div className="hidden md:flex items-center space-x-6">
              <button onClick={() => navegarPara('busca')} className="text-[#6B4226] font-medium hover:text-[#8B5A2B] transition">Explorar Eventos</button>
              
              <div className="relative flex items-center">
                <input 
                  type="text" placeholder="Pesquisar..." 
                  className="pl-10 pr-4 py-2 border border-[#E8DCC4] bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-[#8B5A2B] w-56 text-[#4A3728] text-sm"
                  value={termoBuscaNav} onChange={(e) => setTermoBuscaNav(e.target.value)} onKeyDown={submeterBuscaNav}
                />
                <Search className="absolute left-3 h-4 w-4 text-[#A68A6B] cursor-pointer" onClick={submeterBuscaNav} />
              </div>
              
              {/* Botões de Acesso Condicionais */}
              {usuarioApp ? (
                <>
                  <button onClick={() => navegarPara('perfil')} className="flex items-center text-[#6B4226] hover:text-[#8B5A2B] font-medium transition"><User className="w-5 h-5 mr-1" /> Perfil</button>
                  {usuarioApp.isAdmin && <button onClick={() => navegarPara('admin')} className="flex items-center text-[#A0522D] hover:text-[#8B4513] font-medium transition"><Lock className="w-5 h-5 mr-1" /> Admin</button>}
                  <button onClick={realizarLogout} className="text-red-500 hover:text-red-700 transition" title="Sair"><LogOut className="w-5 h-5" /></button>
                </>
              ) : (
                <div className="flex space-x-3">
                  <button onClick={() => navegarPara('login')} className="px-4 py-2 text-[#8B5A2B] font-medium hover:bg-[#F5E6D3] rounded-lg transition">Entrar</button>
                  <button onClick={() => navegarPara('cadastro')} className="px-4 py-2 bg-[#8B5A2B] text-white font-medium rounded-lg hover:bg-[#6B4226] transition shadow-sm">Cadastrar</button>
                </div>
              )}
            </div>

            {/* Menu Hambúrguer (Mobile) */}
            <div className="flex items-center md:hidden">
              <button onClick={() => setMenuMobileAberto(!menuMobileAberto)} className="text-[#6B4226]">
                {menuMobileAberto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Dropdown Menu (Mobile) */}
        {menuMobileAberto && (
          <div className="md:hidden bg-[#FAF6EE] border-b border-[#E8DCC4] px-4 pt-2 pb-4 space-y-3">
             <button onClick={() => navegarPara('busca')} className="w-full text-left px-4 py-2 font-medium text-[#6B4226]">Explorar Eventos</button>
             <div className="px-4"><input type="text" placeholder="Pesquisar..." className="w-full px-3 py-2 border border-[#E8DCC4] bg-white rounded-lg focus:outline-none" value={termoBuscaNav} onChange={(e) => setTermoBuscaNav(e.target.value)} /></div>
              {usuarioApp ? (
                <div className="flex flex-col space-y-3 mt-4 px-4">
                  <button onClick={() => navegarPara('perfil')} className="flex items-center text-[#6B4226]"><User className="w-5 h-5 mr-2"/> Meu Perfil</button>
                  {usuarioApp.isAdmin && <button onClick={() => navegarPara('admin')} className="flex items-center text-[#A0522D]"><Lock className="w-5 h-5 mr-2"/> Painel Admin</button>}
                  <button onClick={realizarLogout} className="flex items-center text-red-500"><LogOut className="w-5 h-5 mr-2"/> Sair</button>
                </div>
              ) : (
                <div className="flex flex-col space-y-2 mt-4 px-4">
                  <button onClick={() => navegarPara('login')} className="w-full text-center px-4 py-2 border border-[#8B5A2B] text-[#8B5A2B] font-medium rounded-lg">Entrar</button>
                  <button onClick={() => navegarPara('cadastro')} className="w-full text-center px-4 py-2 bg-[#8B5A2B] text-white font-medium rounded-lg">Cadastrar</button>
                </div>
              )}
          </div>
        )}
      </nav>

      {}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Switch Case em React para renderizar o componente correto dependendo da visaoAtual */}
        {visaoAtual === 'home' && <PaginaInicial eventos={eventos} navegarPara={navegarPara} />}
        {visaoAtual === 'busca' && <PaginaBusca eventos={eventos} categoriasGlobais={categoriasGlobais} termoInicial={termoBuscaNav} setTermoInicial={setTermoBuscaNav} navegarPara={navegarPara} />}
        {visaoAtual === 'evento' && eventoSelecionado && <PaginaDetalhesEvento evento={eventoSelecionado} usuarioApp={usuarioApp} navegarPara={navegarPara} db={db} />}
        {visaoAtual === 'checkout' && eventoSelecionado && usuarioApp && (
          <ProcessoCheckout evento={eventoSelecionado} usuario={usuarioApp} usuarioFirebase={usuarioFirebase} db={db} aoCompletar={() => navegarPara('perfil')} aoCancelar={() => navegarPara('evento', eventoSelecionado)} />
        )}
        {(visaoAtual === 'login' || visaoAtual === 'cadastro') && (
          <FormulariosAutenticacao visao={visaoAtual} setVisao={setVisaoAtual} db={db} />
        )}
        {visaoAtual === 'perfil' && usuarioApp && <PaginaPerfil usuarioApp={usuarioApp} eventos={eventos} meusIngressos={meusIngressos} navegarPara={navegarPara} />}
        {visaoAtual === 'admin' && usuarioApp?.isAdmin && <PainelAdministrador eventos={eventos} categoriasGlobais={categoriasGlobais} db={db} />}
      </main>
    </div>
  );
}

// ==========================================
// COMPONENTE: CARTÃO DE EVENTO (Reutilizável)
// Exibe a miniatura do evento na Home e na Busca
// ==========================================
const CartaoEvento = ({ evento, navegarPara }) => {
  // Cálculo de vagas. Se for Aberto, não tem limite de vagas que esgote o evento.
  const ingressosDisponiveis = evento.capacity - (evento.soldTickets || 0);
  const esgotado = !evento.isOpenEvent && ingressosDisponiveis <= 0;

  return (
    <div onClick={() => navegarPara('evento', evento)} className="bg-white rounded-xl shadow-sm border border-[#E8DCC4] overflow-hidden cursor-pointer hover:shadow-md transition group flex flex-col h-full">
      <div className="h-48 overflow-hidden relative bg-[#FAF6EE]">
        <img src={evento.imageUrl || 'https://via.placeholder.com/400x300?text=Sem+Imagem'} alt={evento.title} className={`w-full h-full object-cover transition duration-500 ${esgotado ? 'grayscale opacity-70' : 'group-hover:scale-105'}`} />
        <div className="absolute top-3 right-3 bg-white px-3 py-1 rounded-full text-xs font-bold text-[#8B5A2B] shadow">{evento.category}</div>
        {esgotado && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="bg-red-600 text-white font-bold px-4 py-2 rounded-full tracking-widest uppercase">Esgotado</span></div>}
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-[#4A3728] mb-2 line-clamp-1">{evento.title}</h3>
        <div className="space-y-2 text-sm text-[#6B4226] mb-4">
          <div className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-[#A68A6B] flex-shrink-0" /> <span className="line-clamp-1">{new Date(evento.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} às {evento.time}</span></div>
          <div className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-[#A68A6B] flex-shrink-0" /> <span className="line-clamp-1">{evento.location}</span></div>
        </div>
        <div className="mt-auto pt-4 border-t border-[#E8DCC4] flex justify-between items-center">
          <span className="font-bold text-lg text-[#4A3728]">
            {evento.isOpenEvent ? <span className="text-[#8B5A2B] text-sm">Aberto ao Público</span> : (evento.isFree ? <span className="text-[#A0522D]">Gratuito</span> : formatarMoeda(evento.price))}
          </span>
          <button className="text-[#8B5A2B] font-medium hover:text-[#6B4226] text-sm flex items-center transition">Detalhes <ChevronRight className="w-4 h-4 ml-1" /></button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// PÁGINAS MENORES
// ==========================================
const PaginaInicial = ({ eventos, navegarPara }) => (
  <div className="space-y-12">
    {/* Banner Principal com Imagem de Fundo e Overlay */}
    <div className="relative rounded-2xl overflow-hidden bg-[#3E2723] text-white shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-[#3E2723] to-transparent z-10"></div>
      <img src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80" alt="Cultura Niterói" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
      <div className="relative z-20 p-8 md:p-16 w-full md:w-2/3">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-[#FAF6EE]">Portal Cultural Niterói</h1>
        <p className="text-lg text-[#E8DCC4] mb-8 max-w-xl">Encontre shows, peças de teatro, exposições e muito mais. Reserve seu ingresso e valorize a arte local.</p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => document.getElementById('destaques').scrollIntoView({behavior: 'smooth'})} className="px-6 py-3 bg-[#A0522D] hover:bg-[#8B4513] text-white font-bold rounded-full transition shadow-lg flex items-center">
            Ver Destaques <ChevronRight className="ml-2 w-5 h-5" />
          </button>
          <button onClick={() => navegarPara('busca')} className="px-6 py-3 bg-[#FAF6EE] text-[#6B4226] hover:bg-white font-bold rounded-full transition shadow-lg flex items-center">
            Explorar Tudo
          </button>
        </div>
      </div>
    </div>

    {/* Seção Destaques (Últimos Eventos Criados) */}
    <div id="destaques">
      <h2 className="text-2xl font-bold text-[#4A3728] mb-6 flex items-center"><Calendar className="mr-2 text-[#8B5A2B]" /> Em Destaque</h2>
      {eventos.length === 0 ? (
        <div className="text-center py-12 text-[#A68A6B]">Nenhum evento programado no momento.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventos.slice(0, 6).map(evento => <CartaoEvento key={evento.id} evento={evento} navegarPara={navegarPara} />)}
        </div>
      )}
      {eventos.length > 6 && (
        <div className="text-center mt-8">
           <button onClick={() => navegarPara('busca')} className="text-[#A0522D] font-bold hover:underline">Ver todos os eventos...</button>
        </div>
      )}
    </div>
  </div>
);

const PaginaBusca = ({ eventos, categoriasGlobais, termoInicial, setTermoInicial, navegarPara }) => {
  // Estados Locais para os Filtros
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroPreco, setFiltroPreco] = useState('todos');

  // Lógica de Filtragem combinada
  const eventosFiltrados = eventos.filter(ev => {
    const bateTexto = ev.title.toLowerCase().includes(termoInicial.toLowerCase()) || (ev.author && ev.author.toLowerCase().includes(termoInicial.toLowerCase()));
    const bateCategoria = filtroCategoria === '' || ev.category === filtroCategoria;
    const batePreco = filtroPreco === 'todos' || 
                      (filtroPreco === 'gratis' && (ev.isFree || ev.isOpenEvent)) || 
                      (filtroPreco === 'pago' && !ev.isFree && !ev.isOpenEvent);
    return bateTexto && bateCategoria && batePreco;
  });

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Barra Lateral (Sidebar) de Filtros */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#E8DCC4] sticky top-24">
          <h3 className="text-lg font-bold text-[#4A3728] mb-4 flex items-center"><Filter className="w-5 h-5 mr-2 text-[#8B5A2B]"/> Filtros</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-2">Busca</label>
              <input type="text" placeholder="Nome do evento..." className="w-full px-3 py-2 border border-[#E8DCC4] rounded-lg text-sm outline-none focus:border-[#8B5A2B]" value={termoInicial} onChange={e => setTermoInicial(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-2">Categoria</label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                <label className="flex items-center space-x-2 cursor-pointer text-sm text-[#4A3728]">
                  <input type="radio" name="cat" checked={filtroCategoria === ''} onChange={() => setFiltroCategoria('')} className="accent-[#8B5A2B]" /> <span>Todas</span>
                </label>
                {categoriasGlobais.map(cat => (
                  <label key={cat.id} className="flex items-center space-x-2 cursor-pointer text-sm text-[#4A3728]">
                    <input type="radio" name="cat" checked={filtroCategoria === cat.name} onChange={() => setFiltroCategoria(cat.name)} className="accent-[#8B5A2B]" /> <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6B4226] mb-2">Preço</label>
              <select className="w-full px-3 py-2 border border-[#E8DCC4] rounded-lg text-sm outline-none focus:border-[#8B5A2B]" value={filtroPreco} onChange={e=>setFiltroPreco(e.target.value)}>
                <option value="todos">Qualquer valor</option><option value="gratis">Abertos / Gratuitos</option><option value="pago">Apenas Pagos</option>
              </select>
            </div>
            <button onClick={() => {setTermoInicial(''); setFiltroCategoria(''); setFiltroPreco('todos');}} className="w-full py-2 mt-2 text-sm text-[#A0522D] bg-[#F5E6D3] hover:bg-[#E8DCC4] font-bold rounded-lg transition">Limpar Filtros</button>
          </div>
        </div>
      </div>
      
      {/* Resultados da Busca */}
      <div className="flex-1">
        <h2 className="text-2xl font-bold text-[#4A3728] mb-6">Explorar <span className="text-lg font-normal text-[#A68A6B]">({eventosFiltrados.length} resultados)</span></h2>
        {eventosFiltrados.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-[#D2B48C] text-center">
            <Search className="w-12 h-12 text-[#E8DCC4] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#6B4226]">Nenhum evento encontrado</h3>
            <p className="text-[#A68A6B] mt-2">Tente ajustar seus filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {eventosFiltrados.map(evento => <CartaoEvento key={evento.id} evento={evento} navegarPara={navegarPara} />)}
          </div>
        )}
      </div>
    </div>
  );
};

const PaginaDetalhesEvento = ({ evento, usuarioApp, navegarPara, db }) => {
  const [erroAoSalvar, setErroAoSalvar] = useState('');
  
  const ingressosDisponiveis = evento.capacity - (evento.soldTickets || 0);
  const esgotado = !evento.isOpenEvent && ingressosDisponiveis <= 0;
  
  // Verifica no array de favoritos do usuário se o ID do evento atual está incluso
  const isSaved = usuarioApp?.savedEvents?.includes(evento.id);

  // Função para Favoritar / Desfavoritar
  const alternarSalvarEvento = async () => {
    if (!usuarioApp) { setErroAoSalvar("Faça login para salvar eventos favoritos."); return; }
    if (usuarioApp.isAdmin) { setErroAoSalvar("Contas admin não salvam eventos."); return; }
    
    setErroAoSalvar('');
    const userRef = doc(db, 'users', usuarioApp.uid);
    try {
      // Se já estiver salvo, remove (arrayRemove). Se não, adiciona (arrayUnion).
      await updateDoc(userRef, { savedEvents: isSaved ? arrayRemove(evento.id) : arrayUnion(evento.id) });
    } catch (err) { console.error(err); setErroAoSalvar("Erro ao processar."); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E8DCC4] overflow-hidden max-w-4xl mx-auto">
      {/* Imagem de Capa do Evento com Gradiente Escuro */}
      <div className="h-64 md:h-96 w-full relative bg-[#FAF6EE]">
        <img src={evento.imageUrl || 'https://via.placeholder.com/800x400'} alt={evento.title} className={`w-full h-full object-cover ${esgotado ? 'grayscale' : ''}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2C1A14]/90 via-[#2C1A14]/40 to-transparent"></div>
        <div className="absolute bottom-6 left-6 right-6 text-white flex justify-between items-end">
          <div>
            <span className="bg-[#A0522D] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3 inline-block">{evento.category}</span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#FAF6EE] mb-2">{evento.title}</h1>
            {evento.author && <p className="text-[#E8DCC4] flex items-center"><User className="w-4 h-4 mr-2" /> Realização: {evento.author}</p>}
          </div>
          
          {/* Botão de Coração (Salvar) */}
          <div className="flex flex-col items-end">
            {erroAoSalvar && <span className="bg-red-500/80 text-white text-xs px-2 py-1 rounded mb-2">{erroAoSalvar}</span>}
            <button onClick={alternarSalvarEvento} className="bg-white/20 hover:bg-white/40 p-3 rounded-full backdrop-blur-sm transition group" title="Salvar evento">
              <Heart className={`w-6 h-6 ${isSaved ? 'fill-red-500 text-red-500' : 'text-white group-hover:text-red-300'}`} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Corpo da Página de Detalhes */}
      <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Coluna da Esquerda (Textos) */}
        <div className="md:col-span-2 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-[#4A3728] mb-3">Sobre o Evento</h3>
            <p className="text-[#6B4226] leading-relaxed whitespace-pre-wrap">{evento.description}</p>
          </div>
          
          {evento.externalLink && (
            <div>
              <a href={evento.externalLink} target="_blank" rel="noreferrer" className="inline-flex items-center text-[#A0522D] hover:text-[#8B4513] font-medium underline">
                <LinkIcon className="w-4 h-4 mr-1" /> Mais informações no site oficial do evento
              </a>
            </div>
          )}

          {evento.observations && (
            <div className="bg-[#FAF6EE] p-4 rounded-xl border border-[#E8DCC4] flex items-start">
              <Info className="w-5 h-5 text-[#8B5A2B] mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#6B4226]">{evento.observations}</p>
            </div>
          )}
        </div>

        {/* Coluna da Direita (Painel de Compra) */}
        <div className="bg-[#FDFBF7] p-6 rounded-xl border border-[#E8DCC4] h-fit space-y-6">
          <div className="space-y-4">
            <div className="flex items-start text-[#6B4226]">
              <Calendar className="w-5 h-5 mr-3 text-[#8B5A2B] mt-0.5" />
              <div>
                <p className="font-semibold text-[#4A3728]">Início</p>
                <p className="text-sm">{new Date(evento.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} às {evento.time}</p>
                {/* Mostra o término caso o administrador tenha preenchido */}
                {evento.endDate && evento.endTime && (
                  <div className="mt-2">
                    <p className="font-semibold text-[#4A3728]">Término</p>
                    <p className="text-sm">{new Date(evento.endDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} às {evento.endTime}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center text-[#6B4226]">
              <MapPin className="w-5 h-5 mr-3 text-[#8B5A2B]" />
              <div><p className="font-semibold text-[#4A3728]">{evento.location}</p></div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#E8DCC4]">
            {/* Lógica para Evento Aberto (Não requer ingresso) */}
            {evento.isOpenEvent ? (
              <div className="bg-[#E8F5E9] text-[#2E7D32] p-4 rounded-xl text-center border border-[#A5D6A7]">
                <p className="font-bold text-lg mb-1">Evento Aberto</p>
                <p className="text-sm">Não é necessário emitir ingressos. Chegue cedo e aproveite!</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#A68A6B] mb-1">Valor do Ingresso</p>
                <p className="text-3xl font-bold text-[#4A3728] mb-2">
                  {evento.isFree ? "Gratuito" : formatarMoeda(evento.price)}
                </p>
                
                <div className="mb-4">
                  {esgotado ? (
                    <span className="inline-block bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded border border-red-200">Esgotado</span>
                  ) : (
                    <span className="inline-block bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded border border-green-200">{ingressosDisponiveis} ingressos disponíveis</span>
                  )}
                </div>

                {evento.limitOnePerCpf && <p className="text-xs text-red-600 mb-3 font-medium">* Limite de 1 ingresso por CPF</p>}

                <button 
                  onClick={() => usuarioApp ? navegarPara('checkout', evento) : navegarPara('login')} 
                  disabled={esgotado}
                  className="w-full py-3 bg-[#8B5A2B] text-white font-bold rounded-xl hover:bg-[#6B4226] transition shadow-md flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Ticket className="w-5 h-5 mr-2" /> 
                  {esgotado ? "Lotação Máxima" : (usuarioApp ? "Garantir Ingresso" : "Faça Login para Comprar")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProcessoCheckout = ({ evento, usuario, usuarioFirebase, db, aoCompletar, aoCancelar }) => {
  const [etapa, setEtapa] = useState(1);
  const [tipoIngresso, setTipoIngresso] = useState('Inteira');
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [idIngressoGerado, setIdIngressoGerado] = useState('');

  // Lógica de preços priorizando a configuração do evento (Gratuito ou Metade)
  const precoPrioritario = evento.priorityType === 'gratuito' ? 0 : (evento.price / 2);
  const tabelaPrecos = { 
    'Inteira': evento.price, 
    'Meia-Entrada': evento.price / 2, 
    'Ingresso Prioritário (Consultar Lei Federal nº 10.048/2000)': precoPrioritario, 
    'Gratuito': 0 
  };
  const precoAtual = evento.isFree ? 0 : tabelaPrecos[tipoIngresso];

  const processarPagamento = async () => {
    setProcessando(true); setErro('');
    
    try {
      // Dupla checagem: Re-verifica se acabou os ingressos antes de salvar
      const eventoDoc = await getDoc(doc(db, 'events', evento.id));
      if (eventoDoc.data().soldTickets >= evento.capacity) {
        setErro("Desculpe, os ingressos acabaram de esgotar!");
        setProcessando(false); return;
      }

      // Re-verifica se o CPF já comprou (Caso o Limite esteja ativado)
      if (evento.limitOnePerCpf) {
        const qCpf = query(collection(db, 'tickets'), where('eventId', '==', evento.id), where('ownerCpf', '==', usuario.cpf));
        const cpfSnap = await getDocs(qCpf);
        if (!cpfSnap.empty) {
          setErro("Você já adquiriu um ingresso para este evento (Limite de 1 por CPF).");
          setProcessando(false); return;
        }
      }

      // Delay de 1.5s para simular conexão bancária
      await new Promise(resolve => setTimeout(resolve, 1500));
      const novoCodigoIngresso = gerarCodigoUnico() + gerarCodigoUnico();
      
      // Cria o documento de Ingresso no Firestore
      await addDoc(collection(db, 'tickets'), {
        eventId: evento.id, eventTitle: evento.title, eventDate: new Date(evento.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
        ticketType: evento.isFree ? 'Gratuito' : tipoIngresso, pricePaid: precoAtual, 
        ownerName: usuario.fullName, ownerCpf: usuario.cpf, ownerEmail: usuario.email, userId: usuarioFirebase.uid,
        ticketCode: novoCodigoIngresso, purchasedAt: new Date().toISOString()
      });

      // Incrementa o contador de vendas do evento
      await updateDoc(doc(db, 'events', evento.id), { soldTickets: increment(1) });
      
      setIdIngressoGerado(novoCodigoIngresso); setEtapa(3);
    } catch (e) {
      console.error(e); setErro("Erro ao processar ingresso. Tente novamente.");
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
        {erro && <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 mb-6 font-medium text-center flex items-center justify-center"><Info className="w-5 h-5 mr-2"/> {erro}</div>}

        {etapa === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-[#4A3728] border-b border-[#E8DCC4] pb-2">1. Selecione o tipo de ingresso</h3>
            {!evento.isFree ? (
              <div className="space-y-3">
                {Object.keys(tabelaPrecos).filter(k => k !== 'Gratuito').map(tipo => (
                  <label key={tipo} className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${tipoIngresso === tipo ? 'border-[#8B5A2B] bg-[#FAF6EE]' : 'border-[#E8DCC4] hover:bg-[#FDFBF7]'}`}>
                    <input type="radio" name="tipoIngresso" value={tipo} checked={tipoIngresso === tipo} onChange={(e) => setTipoIngresso(e.target.value)} className="w-5 h-5 accent-[#8B5A2B]" />
                    <span className="ml-3 flex-1 font-medium text-[#4A3728]">{tipo}</span>
                    <span className="font-bold text-[#6B4226]">{formatarMoeda(tabelaPrecos[tipo])}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-[#F5E6D3] border border-[#D2B48C] rounded-xl text-[#6B4226] font-medium flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-[#8B5A2B]" /> Evento Gratuito. Apenas confirme sua reserva.
              </div>
            )}
            <div className="pt-6 flex justify-between items-center">
              <button onClick={aoCancelar} className="text-[#A68A6B] hover:text-[#6B4226] font-medium transition">Cancelar</button>
              <button onClick={() => {setErro(''); setEtapa(2);}} className="px-6 py-3 bg-[#8B5A2B] text-white font-bold rounded-xl hover:bg-[#6B4226] transition">Continuar</button>
            </div>
          </div>
        )}
        
        {etapa === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-[#4A3728] border-b border-[#E8DCC4] pb-2">2. Pagamento</h3>
            <div className="bg-[#FDFBF7] p-4 rounded-xl border border-[#E8DCC4] flex justify-between items-center mb-6">
              <span className="text-[#6B4226]">Total a pagar ({tipoIngresso}):</span>
              <span className="text-2xl font-bold text-[#8B5A2B]">{formatarMoeda(precoAtual)}</span>
            </div>
            {precoAtual > 0 ? (
              <div className="space-y-4">
                <div className="flex space-x-4 mb-4">
                  <button onClick={() => setMetodoPagamento('pix')} className={`flex-1 py-3 border rounded-xl font-medium flex flex-col items-center transition ${metodoPagamento === 'pix' ? 'border-[#A0522D] bg-[#FDF5E6] text-[#A0522D]' : 'border-[#E8DCC4] text-[#A68A6B]'}`}><QrCode className="w-6 h-6 mb-1" /> PIX</button>
                  <button onClick={() => setMetodoPagamento('boleto')} className={`flex-1 py-3 border rounded-xl font-medium flex flex-col items-center transition ${metodoPagamento === 'boleto' ? 'border-[#8B5A2B] bg-[#FAF6EE] text-[#8B5A2B]' : 'border-[#E8DCC4] text-[#A68A6B]'}`}><Barcode className="w-6 h-6 mb-1" /> Boleto</button>
                </div>
                {metodoPagamento === 'pix' && (
                  <div className="text-center p-6 border border-dashed border-[#D2B48C] bg-[#FDFBF7] rounded-xl">
                    <p className="text-sm font-medium text-[#6B4226] mb-2">Código PIX Copia e Cola:</p>
                    <div className="bg-white p-2 border border-[#E8DCC4] rounded text-xs break-all font-mono text-[#8B5A2B] select-all">{gerarCodigoPix()}</div>
                  </div>
                )}
                 {metodoPagamento === 'boleto' && (
                  <div className="text-center p-6 border border-dashed border-[#D2B48C] bg-[#FDFBF7] rounded-xl">
                    <p className="text-sm font-medium text-[#6B4226] mb-2">Código de Barras:</p>
                    <div className="bg-white p-2 border border-[#E8DCC4] rounded text-sm tracking-widest font-mono text-[#8B5A2B] select-all">34191.09008 63571.277308 71444.640008 5 95000000{precoAtual.toString().replace('.','')}</div>
                  </div>
                )}
              </div>
            ) : (
               <div className="text-center p-6 text-[#A68A6B]">Nenhum pagamento é necessário. Clique em confirmar para emitir o ingresso.</div>
            )}
            <div className="pt-6 flex justify-between items-center">
              <button onClick={() => setEtapa(1)} className="text-[#A68A6B] hover:text-[#6B4226] font-medium transition">Voltar</button>
              <button onClick={processarPagamento} disabled={processando} className="px-6 py-3 bg-[#A0522D] text-white font-bold rounded-xl hover:bg-[#8B4513] transition disabled:opacity-50 flex items-center">{processando ? "Processando..." : (precoAtual > 0 ? "Confirmar Pagamento Simulado" : "Emitir Ingresso Gratuito")}</button>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 bg-[#F5E6D3] text-[#A0522D] rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-10 h-10" /></div>
            <h3 className="text-2xl font-bold text-[#4A3728]">Reserva Confirmada!</h3>
            <p className="text-[#6B4226]">Seu ingresso foi emitido com sucesso e adicionado ao seu perfil.</p>
            <div className="bg-[#FAF6EE] border border-[#E8DCC4] p-4 rounded-xl inline-block text-left w-full max-w-sm">
              <p className="text-sm text-[#A68A6B] mb-1">Código Único do Ingresso:</p>
              <p className="font-mono font-bold tracking-widest text-lg text-[#8B5A2B]">{idIngressoGerado}</p>
            </div>
            <div className="pt-4"><button onClick={aoCompletar} className="w-full px-6 py-3 bg-[#8B5A2B] text-white font-bold rounded-xl hover:bg-[#6B4226] transition">Ver Meus Ingressos</button></div>
          </div>
        )}
      </div>
    </div>
  );
};

const FormulariosAutenticacao = ({ visao, setVisao, db }) => {
  const [dadosFormulario, setDadosFormulario] = useState({ fullName: '', cpf: '', email: '', password: '' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const ehLogin = visao === 'login';

  const submeterFormulario = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      if (ehLogin) {
        // Tenta logar usando Email e Senha do Firebase Auth
        await signInWithEmailAndPassword(auth, dadosFormulario.email, dadosFormulario.password);
        setVisao('home'); 
      } else {
        // Tenta registrar novo usuário
        const credencial = await createUserWithEmailAndPassword(auth, dadosFormulario.email, dadosFormulario.password);
        // Salva os detalhes adicionais (Nome, CPF e Array de Eventos Salvos) no Firestore
        await setDoc(doc(db, 'users', credencial.user.uid), { fullName: dadosFormulario.fullName, cpf: dadosFormulario.cpf, isAdmin: false, savedEvents: [] });
        setVisao('home');
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setErro('Este email já está cadastrado.');
      else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') setErro('Credenciais inválidas.');
      else if (err.code === 'auth/weak-password') setErro('A senha deve ter no mínimo 6 caracteres.');
      else setErro('Ocorreu um erro. Verifique seus dados.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-2xl shadow-md border border-[#E8DCC4]">
      <div className="text-center mb-8"><h2 className="text-2xl font-bold text-[#4A3728]">{ehLogin ? 'Acesse sua conta' : 'Crie sua conta'}</h2></div>
      {erro && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-200">{erro}</div>}
      <form onSubmit={submeterFormulario} className="space-y-4">
        {!ehLogin && (
          <>
            <input type="text" placeholder="Nome Completo" required className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:outline-none focus:border-[#8B5A2B]" value={dadosFormulario.fullName} onChange={e => setDadosFormulario({...dadosFormulario, fullName: e.target.value})} />
            <input type="text" placeholder="CPF" required className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:outline-none focus:border-[#8B5A2B]" value={dadosFormulario.cpf} onChange={e => setDadosFormulario({...dadosFormulario, cpf: e.target.value})} />
          </>
        )}
        <input type="email" placeholder="Email" required className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:outline-none focus:border-[#8B5A2B]" value={dadosFormulario.email} onChange={e => setDadosFormulario({...dadosFormulario, email: e.target.value})} />
        <input type="password" placeholder="Senha (mín. 6 caracteres)" required minLength="6" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg focus:outline-none focus:border-[#8B5A2B]" value={dadosFormulario.password} onChange={e => setDadosFormulario({...dadosFormulario, password: e.target.value})} />
        <button type="submit" disabled={carregando} className="w-full py-3 mt-4 bg-[#8B5A2B] text-white font-bold rounded-xl hover:bg-[#6B4226] transition disabled:opacity-50">{carregando ? 'Processando...' : (ehLogin ? 'Entrar' : 'Cadastrar')}</button>
      </form>
      <div className="mt-6 text-center text-sm text-[#A68A6B]">
        {ehLogin ? <p>Não tem conta? <button onClick={() => setVisao('cadastro')} className="text-[#A0522D] font-bold">Cadastre-se</button></p> : <p>Já tem conta? <button onClick={() => setVisao('login')} className="text-[#A0522D] font-bold">Faça login</button></p>}
      </div>
    </div>
  );
};

const PaginaPerfil = ({ usuarioApp, eventos, meusIngressos, navegarPara }) => {
  // Filtra do array de eventos apenas os que o usuário favoritou
  const eventosSalvos = eventos.filter(ev => usuarioApp?.savedEvents?.includes(ev.id));

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E8DCC4] flex items-center space-x-6">
        <div className="w-20 h-20 bg-[#FAF6EE] rounded-full flex items-center justify-center text-[#8B5A2B] border-2 border-[#D2B48C]"><User className="w-10 h-10" /></div>
        <div>
          <h2 className="text-2xl font-bold text-[#4A3728]">{usuarioApp.fullName}</h2>
          <p className="text-[#A68A6B]">{usuarioApp.email}</p>
          <div className="mt-2 space-x-3">
            {usuarioApp.cpf && <span className="text-xs bg-[#FDFBF7] border border-[#E8DCC4] px-3 py-1 rounded-full text-[#6B4226]">CPF: {usuarioApp.cpf}</span>}
            {usuarioApp.isAdmin && <span className="text-xs bg-teal-100 text-teal-800 px-3 py-1 rounded-full font-bold">Admin</span>}
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-bold text-[#4A3728] mb-4 flex items-center"><Ticket className="mr-2 text-[#8B5A2B]" /> Meus Ingressos</h3>
        {meusIngressos.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-[#E8DCC4] text-center text-[#A68A6B]">Você ainda não possui ingressos.</div>
        ) : (
          <div className="space-y-4">
            {meusIngressos.map(ingresso => (
              <div key={ingresso.id} className="bg-white rounded-xl shadow-sm border border-[#E8DCC4] overflow-hidden flex flex-col md:flex-row">
                <div className="p-6 flex-1 flex flex-col justify-center border-b md:border-b-0 md:border-r border-dashed border-[#D2B48C]">
                  <span className="text-xs font-bold uppercase text-[#A0522D] tracking-wider mb-1">{ingresso.ticketType.replace(' (Consultar Lei Federal nº 10.048/2000)','')}</span>
                  <h4 className="text-xl font-bold text-[#4A3728] mb-2">{ingresso.eventTitle}</h4>
                  <p className="text-sm text-[#6B4226] mb-1"><Calendar className="w-4 h-4 inline mr-1" /> {ingresso.eventDate}</p>
                  <p className="text-sm text-[#6B4226]"><User className="w-4 h-4 inline mr-1" /> Titular: {ingresso.ownerName}</p>
                </div>
                <div className="p-6 bg-[#FAF6EE] md:w-64 flex flex-col items-center justify-center">
                  <CodigoDeBarrasVisual codigo={ingresso.ticketCode} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-bold text-[#4A3728] mb-4 flex items-center"><Heart className="mr-2 text-red-500 fill-red-500" /> Eventos Salvos</h3>
        {eventosSalvos.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-[#E8DCC4] text-center text-[#A68A6B]">Você ainda não salvou nenhum evento.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {eventosSalvos.map(evento => (
               <div key={evento.id} onClick={() => navegarPara('evento', evento)} className="bg-white rounded-xl shadow-sm border border-[#E8DCC4] overflow-hidden cursor-pointer hover:shadow-md transition flex items-center p-3">
                 <img src={evento.imageUrl || 'https://via.placeholder.com/100'} alt={evento.title} className="w-20 h-20 object-cover rounded-lg mr-4" />
                 <div>
                   <h4 className="font-bold text-[#4A3728] line-clamp-1">{evento.title}</h4>
                   <p className="text-sm text-[#6B4226]"><Calendar className="w-3 h-3 inline mr-1" /> {new Date(evento.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                   <p className="text-xs text-[#A0522D] mt-1 font-medium">{evento.category}</p>
                 </div>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PainelAdministrador = ({ eventos, categoriasGlobais, db }) => {
  const [abaAtiva, setAbaAtiva] = useState('eventos'); // 'eventos', 'relatorios', 'categorias'
  const [editando, setEditando] = useState(false);
  
  // Estado que guarda as informações do formulário de criação/edição
  const [dadosFormulario, setDadosFormulario] = useState({ 
    title: '', description: '', date: '', time: '', endDate: '', endTime: '', location: '', imageUrl: '', 
    price: 0, capacity: 100, category: categoriasGlobais.length > 0 ? categoriasGlobais[0].name : 'Música', 
    isOpenEvent: false, isFree: false, observations: '', author: '', externalLink: '', priorityType: 'meia', limitOnePerCpf: false, soldTickets: 0
  });
  const [idEdicao, setIdEdicao] = useState(null);
  
  // Estados para Relatórios de Vendas
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState('');
  const [ingressosVendidos, setIngressosVendidos] = useState([]);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  
  // Estado para Categorias
  const [novaCategoria, setNovaCategoria] = useState('');
  
  // Controle de Confirmação Inline (Evitando alert/confirm)
  const [confirmarExclusaoEvento, setConfirmarExclusaoEvento] = useState(null);
  const [confirmarExclusaoCategoria, setConfirmarExclusaoCategoria] = useState(null);

  // Efeito que carrega ingressos sempre que o admin escolhe um evento no relatório
  useEffect(() => {
    if (!eventoSelecionadoId) { setIngressosVendidos([]); return; }
    setCarregandoRelatorio(true);
    const q = query(collection(db, 'tickets'), where('eventId', '==', eventoSelecionadoId));
    getDocs(q).then(snap => {
      setIngressosVendidos(snap.docs.map(d => ({id: d.id, ...d.data()})));
      setCarregandoRelatorio(false);
    }).catch(err => { console.error(err); setCarregandoRelatorio(false); });
  }, [eventoSelecionadoId, db]);

  // Função para limpar o formulário e fechar edição
  const limparFormulario = () => {
    setDadosFormulario({ title: '', description: '', date: '', time: '', endDate: '', endTime: '', location: '', imageUrl: '', price: 0, capacity: 100, category: categoriasGlobais.length > 0 ? categoriasGlobais[0].name : 'Música', isOpenEvent: false, isFree: false, observations: '', author: '', externalLink: '', priorityType: 'meia', limitOnePerCpf: false, soldTickets: 0 });
    setEditando(false); setIdEdicao(null);
  };

  // Salva o Evento no Banco
  const salvarEvento = async (e) => {
    e.preventDefault();
    const payload = { ...dadosFormulario, price: Number(dadosFormulario.price), capacity: Number(dadosFormulario.capacity), isFree: Boolean(dadosFormulario.isFree), isOpenEvent: Boolean(dadosFormulario.isOpenEvent), limitOnePerCpf: Boolean(dadosFormulario.limitOnePerCpf) };
    try {
      if (idEdicao) await updateDoc(doc(db, 'events', idEdicao), payload);
      else await addDoc(collection(db, 'events'), payload);
      limparFormulario();
    } catch (err) { console.error(err); } 
  };

  // Exclui Evento (com confirmação inline)
  const deletarEvento = async (id) => {
    await deleteDoc(doc(db, 'events', id));
    setConfirmarExclusaoEvento(null); // Reseta a UI de confirmação
  };

  // Cria Nova Categoria Dinâmica
  const adicionarCategoria = async (e) => {
    e.preventDefault();
    if (!novaCategoria.trim()) return;
    try { await addDoc(collection(db, 'categories'), { name: novaCategoria.trim() }); setNovaCategoria(''); } 
    catch(err) { console.error(err); }
  };

  // Exclui Categoria (com confirmação inline)
  const deletarCategoria = async (id) => {
    await deleteDoc(doc(db, 'categories', id));
    setConfirmarExclusaoCategoria(null); // Reseta a UI de confirmação
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center bg-[#4A3728] text-[#FAF6EE] p-6 rounded-2xl shadow-md border border-[#3E2723]">
        <div>
          <h2 className="text-2xl font-bold flex items-center"><Lock className="mr-2 text-[#D2B48C]" /> Painel Administrativo</h2>
          <p className="text-[#D2B48C] text-sm mt-1">Gerenciamento no Firestore</p>
        </div>
      </div>

      {/* Menu Superior (Abas) */}
      <div className="flex border-b border-[#E8DCC4] space-x-4 overflow-x-auto">
        <button onClick={() => {setAbaAtiva('eventos'); setEditando(false);}} className={`px-4 py-2 font-bold whitespace-nowrap ${abaAtiva === 'eventos' ? 'text-[#8B5A2B] border-b-2 border-[#8B5A2B]' : 'text-[#A68A6B]'}`}>Gestão de Eventos</button>
        <button onClick={() => setAbaAtiva('categorias')} className={`px-4 py-2 font-bold flex items-center whitespace-nowrap ${abaAtiva === 'categorias' ? 'text-[#8B5A2B] border-b-2 border-[#8B5A2B]' : 'text-[#A68A6B]'}`}><Tag className="w-4 h-4 mr-1"/> Categorias</button>
        <button onClick={() => setAbaAtiva('relatorios')} className={`px-4 py-2 font-bold flex items-center whitespace-nowrap ${abaAtiva === 'relatorios' ? 'text-[#A0522D] border-b-2 border-[#A0522D]' : 'text-[#A68A6B]'}`}><FileText className="w-4 h-4 mr-1"/> Relatórios de Vendas</button>
      </div>

      {/* ABA DE GESTÃO DE EVENTOS */}
      {abaAtiva === 'eventos' && (
        <div className="space-y-6">
          {!editando ? (
            <div className="flex justify-end"><button onClick={() => setEditando(true)} className="px-4 py-2 bg-[#A0522D] hover:bg-[#8B4513] text-white font-bold rounded-lg shadow flex items-center"><Plus className="w-5 h-5 mr-1" /> Novo Evento</button></div>
          ) : (
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md border border-[#E8DCC4]">
              <h3 className="text-xl font-bold text-[#4A3728] mb-4 border-b border-[#E8DCC4] pb-2">{idEdicao ? 'Editar Evento' : 'Novo Evento'}</h3>
              <form onSubmit={salvarEvento} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Inputs de Informação Básica */}
                <div className="col-span-2 space-y-1"><label className="text-sm font-medium text-[#6B4226]">Título do Evento</label><input required type="text" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={dadosFormulario.title} onChange={e=>setDadosFormulario({...dadosFormulario, title: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-sm font-medium text-[#6B4226]">Autor / Produtor</label><input type="text" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={dadosFormulario.author} onChange={e=>setDadosFormulario({...dadosFormulario, author: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-sm font-medium text-[#6B4226]">Link Externo Oficial</label><input type="url" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={dadosFormulario.externalLink} onChange={e=>setDadosFormulario({...dadosFormulario, externalLink: e.target.value})} /></div>
                <div className="col-span-2 space-y-1"><label className="text-sm font-medium text-[#6B4226]">Descrição Completa</label><textarea required rows="3" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={dadosFormulario.description} onChange={e=>setDadosFormulario({...dadosFormulario, description: e.target.value})}></textarea></div>
                
                {/* Caixa de Datas com Início e Fim */}
                <div className="bg-[#FAF6EE] p-4 rounded-lg col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border border-[#E8DCC4]">
                  <div><label className="block text-xs font-bold text-[#A68A6B] mb-1">Data de Início *</label><input required type="date" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none" value={dadosFormulario.date} onChange={e=>setDadosFormulario({...dadosFormulario, date: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-[#A68A6B] mb-1">Hora de Início *</label><input required type="time" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none" value={dadosFormulario.time} onChange={e=>setDadosFormulario({...dadosFormulario, time: e.target.value})} /></div>
                  <div><label className="block text-xs text-[#A68A6B] mb-1">Data Final (Opcional)</label><input type="date" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none" value={dadosFormulario.endDate} onChange={e=>setDadosFormulario({...dadosFormulario, endDate: e.target.value})} /></div>
                  <div><label className="block text-xs text-[#A68A6B] mb-1">Hora Final (Opcional)</label><input type="time" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none" value={dadosFormulario.endTime} onChange={e=>setDadosFormulario({...dadosFormulario, endTime: e.target.value})} /></div>
                </div>

                <input required type="text" placeholder="Local do Evento" className="col-span-2 px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={dadosFormulario.location} onChange={e=>setDadosFormulario({...dadosFormulario, location: e.target.value})} />
                <input type="url" placeholder="URL da Imagem de Capa" className="col-span-2 px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={dadosFormulario.imageUrl} onChange={e=>setDadosFormulario({...dadosFormulario, imageUrl: e.target.value})} />
                
                {/* Configurações Avançadas de Ingressos/Bilheteria */}
                <div className="col-span-2 border-t border-[#E8DCC4] pt-4 mt-2">
                  <h4 className="font-bold text-[#4A3728] mb-4">Configurações de Bilheteria</h4>
                  
                  {/* Opção Evento Aberto (Esconde Preço e Capacidade se marcado) */}
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <label className="flex items-center space-x-2 cursor-pointer font-bold text-green-800">
                      <input type="checkbox" className="w-5 h-5 accent-green-600" checked={dadosFormulario.isOpenEvent} onChange={e=>setDadosFormulario({...dadosFormulario, isOpenEvent: e.target.checked})} /> 
                      <span>Evento Aberto ao Público (Não necessita emissão de ingresso)</span>
                    </label>
                  </div>

                  {!dadosFormulario.isOpenEvent && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="text-sm font-medium text-[#6B4226]">Categoria Principal</label>
                        <select className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={dadosFormulario.category} onChange={e=>setDadosFormulario({...dadosFormulario, category: e.target.value})}>
                          {categoriasGlobais.length === 0 && <option value="Outros">Outros</option>}
                          {categoriasGlobais.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                        </select>
                      </div>
                      <div><label className="text-sm font-medium text-[#6B4226]">Capacidade Total</label><input required type="number" min="1" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none" value={dadosFormulario.capacity} onChange={e=>setDadosFormulario({...dadosFormulario, capacity: e.target.value})} /></div>
                      <div><label className="text-sm font-medium text-[#6B4226]">Valor Base (Inteira R$)</label><input required type="number" step="0.01" min="0" disabled={dadosFormulario.isFree} className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg disabled:bg-gray-100" value={dadosFormulario.price} onChange={e=>setDadosFormulario({...dadosFormulario, price: e.target.value})} /></div>
                      
                      <div className="flex flex-col space-y-2 col-span-2 bg-[#FDFBF7] p-4 rounded border border-[#E8DCC4]">
                        <label className="flex items-center space-x-2 cursor-pointer font-medium text-[#8B5A2B]">
                          <input type="checkbox" className="w-5 h-5 accent-[#8B5A2B]" checked={dadosFormulario.isFree} onChange={e=>setDadosFormulario({...dadosFormulario, isFree: e.target.checked, price: e.target.checked ? 0 : dadosFormulario.price})} /> <span>O Evento é 100% Gratuito (mas emite ingresso)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer font-medium text-red-600">
                          <input type="checkbox" className="w-5 h-5 accent-red-600" checked={dadosFormulario.limitOnePerCpf} onChange={e=>setDadosFormulario({...dadosFormulario, limitOnePerCpf: e.target.checked})} /> <span>Restringir compra a 1 ingresso por CPF</span>
                        </label>
                      </div>
                      <div className="col-span-2"><label className="text-sm font-medium text-[#6B4226]">Configuração do "Ingresso Prioritário"</label>
                        <select className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none" value={dadosFormulario.priorityType} onChange={e=>setDadosFormulario({...dadosFormulario, priorityType: e.target.value})}>
                          <option value="meia">Será cobrado o valor de Meia-Entrada</option><option value="gratuito">Será 100% Gratuito</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-span-2"><label className="text-sm font-medium text-[#6B4226]">Observações (Ex: Classificação Indicativa)</label><input type="text" className="w-full px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={dadosFormulario.observations} onChange={e=>setDadosFormulario({...dadosFormulario, observations: e.target.value})} /></div>
                
                {/* Botões de Ação do Formulário */}
                <div className="col-span-2 flex justify-end space-x-4 pt-6 border-t border-[#E8DCC4]">
                  <button type="button" onClick={limparFormulario} className="px-6 py-2 text-[#A68A6B] hover:bg-[#FDFBF7] rounded-lg transition">Cancelar</button>
                  <button type="submit" className="px-6 py-2 bg-[#8B5A2B] text-white font-bold rounded-lg hover:bg-[#6B4226] transition shadow-sm">Salvar Evento</button>
                </div>
              </form>
            </div>
          )}

          {/* Tabela de Eventos Cadastrados */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8DCC4] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-[#FAF6EE] text-[#4A3728]"><th className="p-4">Evento</th><th className="p-4">Data/Hora</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th></tr></thead>
              <tbody className="divide-y divide-[#E8DCC4]">
                {eventos.map(ev => (
                  <tr key={ev.id} className="hover:bg-[#FDFBF7] transition">
                    <td className="p-4 font-bold text-[#4A3728]">{ev.title} <span className="block font-normal text-xs text-[#A0522D]">{ev.category}</span></td>
                    <td className="p-4 text-sm text-[#6B4226]">{new Date(ev.date).toLocaleDateString('pt-BR', {timeZone:'UTC'})}</td>
                    <td className="p-4 text-sm font-medium">
                      {ev.isOpenEvent ? <span className="text-green-700">Aberto (Sem Ingresso)</span> : <span>{ev.capacity - (ev.soldTickets || 0)} disp. / {ev.capacity}</span>}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {/* Lógica Inline de Confirmação de Exclusão (sem o alert() nativo) */}
                      {confirmarExclusaoEvento === ev.id ? (
                        <div className="inline-flex items-center space-x-2 bg-red-50 p-1 rounded border border-red-200">
                          <span className="text-xs text-red-600 font-bold">Excluir?</span>
                          <button onClick={() => deletarEvento(ev.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Sim</button>
                          <button onClick={() => setConfirmarExclusaoEvento(null)} className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400">Não</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setDadosFormulario(ev); setIdEdicao(ev.id); setEditando(true); window.scrollTo(0,0); }} className="p-2 text-[#8B5A2B] hover:bg-[#F5E6D3] rounded-lg transition mr-2"><Edit className="w-5 h-5" /></button>
                          <button onClick={() => setConfirmarExclusaoEvento(ev.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-5 h-5" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA DE GESTÃO DE CATEGORIAS */}
      {abaAtiva === 'categorias' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md border border-[#E8DCC4] space-y-6">
           <h3 className="text-lg font-bold text-[#4A3728]">Gerenciar Categorias</h3>
           <form onSubmit={adicionarCategoria} className="flex gap-4">
             <input type="text" placeholder="Nova categoria (Ex: Festival)" className="flex-1 px-4 py-2 border border-[#E8DCC4] rounded-lg outline-none focus:border-[#8B5A2B]" value={novaCategoria} onChange={e=>setNovaCategoria(e.target.value)} required />
             <button type="submit" className="px-6 py-2 bg-[#8B5A2B] text-white font-bold rounded-lg hover:bg-[#6B4226] transition flex items-center"><Plus className="w-5 h-5 mr-1"/> Adicionar</button>
           </form>
           
           <div className="mt-6 border border-[#E8DCC4] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead><tr className="bg-[#FAF6EE] text-[#6B4226] border-b border-[#E8DCC4]"><th className="p-3">Nome da Categoria</th><th className="p-3 text-right">Ação</th></tr></thead>
                <tbody className="divide-y divide-[#E8DCC4]">
                  {categoriasGlobais.length === 0 && <tr><td colSpan="2" className="p-4 text-center text-[#A68A6B]">Nenhuma categoria cadastrada.</td></tr>}
                  {categoriasGlobais.map(cat => (
                    <tr key={cat.id} className="hover:bg-[#FDFBF7]">
                      <td className="p-3 font-medium text-[#4A3728]">{cat.name}</td>
                      <td className="p-3 text-right">
                        {confirmarExclusaoCategoria === cat.id ? (
                           <div className="inline-flex items-center space-x-2 bg-red-50 p-1 rounded border border-red-200">
                             <span className="text-xs text-red-600 font-bold">Excluir?</span>
                             <button onClick={() => deletarCategoria(cat.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Sim</button>
                             <button onClick={() => setConfirmarExclusaoCategoria(null)} className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400">Não</button>
                           </div>
                        ) : (
                          <button onClick={() => setConfirmarExclusaoCategoria(cat.id)} className="p-2 text-red-500 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4"/></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {/* ABA DE RELATÓRIOS E COMPRADORES */}
      {abaAtiva === 'relatorios' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md border border-[#E8DCC4] space-y-6">
          <div>
            <label className="block text-sm font-bold text-[#4A3728] mb-2">Selecione um Evento para ver as vendas:</label>
            <select className="w-full max-w-lg px-4 py-3 border border-[#E8DCC4] rounded-lg focus:outline-none focus:border-[#8B5A2B] bg-[#FDFBF7]" value={eventoSelecionadoId} onChange={(e) => setEventoSelecionadoId(e.target.value)}>
              <option value="">-- Escolha um evento --</option>
              {/* Eventos Abertos não geram ingressos, portanto são removidos deste select */}
              {eventos.filter(e => !e.isOpenEvent).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          {eventoSelecionadoId && (
            <div className="pt-6 border-t border-[#E8DCC4]">
              {carregandoRelatorio ? (
                 <div className="text-center py-8 text-[#A68A6B]">Carregando ingressos...</div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-[#4A3728] flex items-center"><Users className="w-5 h-5 mr-2 text-[#A0522D]"/> Relatório de Compradores</h3>
                    <span className="bg-[#F5E6D3] text-[#8B5A2B] px-4 py-1 rounded-full font-bold text-sm">Total Vendido: {ingressosVendidos.length} ingressos</span>
                  </div>
                  {ingressosVendidos.length === 0 ? (
                    <div className="text-center py-8 bg-[#FDFBF7] rounded border border-dashed border-[#D2B48C] text-[#A68A6B]">Nenhum ingresso gerado para este evento.</div>
                  ) : (
                    <div className="overflow-x-auto border border-[#E8DCC4] rounded-lg">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead><tr className="bg-[#FAF6EE] text-[#6B4226] border-b border-[#E8DCC4]"><th className="p-3">Nome / Email</th><th className="p-3">CPF</th><th className="p-3">Tipo do Ingresso</th><th className="p-3">Valor Pago</th><th className="p-3 font-mono">Cód. Transação</th></tr></thead>
                        <tbody className="divide-y divide-[#E8DCC4]">
                          {ingressosVendidos.map(ing => (
                            <tr key={ing.id} className="hover:bg-[#FDFBF7]">
                              <td className="p-3"><p className="font-bold text-[#4A3728]">{ing.ownerName}</p><p className="text-xs text-[#A68A6B]">{ing.ownerEmail}</p></td>
                              <td className="p-3 text-[#6B4226]">{ing.ownerCpf}</td>
                              <td className="p-3"><span className="bg-[#F5E6D3] text-[#A0522D] px-2 py-0.5 rounded text-xs font-bold uppercase">{ing.ticketType.replace(' (Consultar Lei Federal nº 10.048/2000)','')}</span></td>
                              <td className="p-3 font-medium text-[#4A3728]">{formatarMoeda(ing.pricePaid)}</td>
                              <td className="p-3 font-mono text-xs text-[#A68A6B]">{ing.ticketCode}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
