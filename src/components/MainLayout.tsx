import React, { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard, 
  Receipt, 
  TrendingDown, 
  MessageSquare, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { branding } from '@/config/branding';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { profile, signOut, activeCompany, companyMemberships, setActiveCompany } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { clientSlug } = useParams();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Painel Geral', 
      icon: LayoutDashboard, 
      path: clientSlug ? `/${clientSlug}/dashboard` : '/company/dashboard' 
    },
    { 
      id: 'transactions', 
      label: 'Transações', 
      icon: Receipt, 
      path: clientSlug ? `/${clientSlug}/bancos` : '/company/transactions' 
    },
    { 
      id: 'fixed-costs', 
      label: 'Custos Fixos', 
      icon: TrendingDown, 
      path: clientSlug ? `/${clientSlug}/caixa` : '/company/fixed-costs' 
    },
    { 
      id: 'chat', 
      label: 'Chat IA', 
      icon: MessageSquare, 
      path: clientSlug ? `/${clientSlug}/chat` : '/chat' 
    },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const activePath = location.pathname;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Using the dark theme from the "Original Process" */}
      <aside 
        className={cn(
          "flex flex-col bg-[#0F172A] text-slate-300 transition-all duration-300 ease-in-out border-right border-slate-800",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Header/Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-white truncate">
                {activeCompany?.company?.trade_name || activeCompany?.company?.name || branding.brandName}
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Portal do Cliente
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activePath.endsWith(item.id === 'dashboard' ? '/dashboard' : item.id === 'chat' ? '/chat' : item.id === 'transactions' ? '/bancos' : '/caixa') || 
                            (item.id === 'transactions' && activePath.includes('/transactions')) ||
                            (item.id === 'fixed-costs' && activePath.includes('/fixed-costs'));
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium border border-primary/20" 
                    : "hover:bg-slate-800/50 hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 shrink-0",
                  isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-300"
                )} />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer / Profile */}
        <div className="p-4 border-t border-slate-800/50 space-y-3">
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                {profile?.full_name?.substring(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-white truncate">{profile?.full_name}</span>
                <span className="text-[10px] text-slate-500 truncate">{profile?.email}</span>
              </div>
            </div>
          )}
          
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="text-sm">Sair</span>}
          </button>

          <div className="flex items-center gap-2 px-3 pt-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <svg width="14" height="11" viewBox="0 0 108 84" fill="currentColor" className="text-slate-600">
                <polygon points="2,4 33,4 27,20 0,20"/>
                <polygon points="1,30 31,30 25,46 0,46"/>
                <polygon points="3,56 33,56 27,72 2,72"/>
                <path d="M44,72 L54,4 L70,4 L84,72 L94,72 L104,4 L88,4 L78,50 L64,4 L44,4 Z" fillRule="evenodd"/>
              </svg>
            </div>
            {!collapsed && (
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                EasyNumbers
              </span>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-24 -right-3 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              {navItems.find(item => 
                activePath.endsWith(item.id === 'dashboard' ? '/dashboard' : item.id === 'chat' ? '/chat' : item.id === 'transactions' ? '/bancos' : '/caixa') || 
                (item.id === 'transactions' && activePath.includes('/transactions')) ||
                (item.id === 'fixed-costs' && activePath.includes('/fixed-costs'))
              )?.label || 'Bem-vindo'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-card" />
            </button>
            <div className="h-8 w-px bg-border mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-foreground">{profile?.full_name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{profile?.user_type?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
