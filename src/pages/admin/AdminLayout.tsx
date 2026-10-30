import { useState } from 'react';
import { NavLink, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users,
  HardDrive,
  BrainCircuit,
  CreditCard,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Admin Overview', href: '/admin/overview', icon: LayoutDashboard },
  { name: 'Dealerships', href: '/admin/dealerships', icon: Building2 },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Data & Uploads', href: '/admin/data', icon: HardDrive },
  { name: 'AI Engine', href: '/admin/ai-engine', icon: BrainCircuit },
  { name: 'Tools', href: '/admin/campaigns', icon: Settings },
  { name: 'Billing & Plans', href: '/admin/billing', icon: CreditCard },
  { name: 'System Logs', href: '/admin/logs', icon: ScrollText },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

const pageTitles: Record<string, string> = {
  '/admin/overview': 'Admin Overview',
  '/admin/dealerships': 'Dealerships',
  '/admin/users': 'Users',
  '/admin/data': 'Data & Uploads',
  '/admin/ai-engine': 'AI Engine',
  '/admin/campaigns': 'Tools',
  '/admin/billing': 'Billing & Plans',
  '/admin/logs': 'System Logs',
  '/admin/settings': 'Settings',
};

const AdminLayout = () => {
  const { user, profile, loading, signOut, userRole } = useAuth();
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading || userRole === undefined) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/admin/overview') return location.pathname === '/admin/overview' || location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const currentTitle = pageTitles[location.pathname] || 'Admin Overview';

  return (
    <div className="min-h-screen flex bg-muted/40">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[230px] bg-card border-r border-border/60 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-0 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-[60px] px-5">
          <NavLink to="/admin/overview" className="flex items-center gap-2.5">
            <img src={logo} alt="LogicLot" className="h-7 w-7 rounded flex-shrink-0" />
            <span className="text-[16px] font-bold tracking-tight text-foreground">
              Logic<span className="text-primary">Lot</span>
            </span>
          </NavLink>
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="space-y-0.5">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl text-[13.5px] font-medium transition-all duration-150 px-3 py-2.5',
                    active
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <item.icon className={cn('h-[18px] w-[18px] flex-shrink-0', active ? 'text-primary' : '')} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border/60 p-3 space-y-0.5">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-xl text-[13.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors w-full px-3 py-2.5"
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-[56px] bg-card/80 backdrop-blur-sm border-b border-border/40 flex items-center px-4 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 mr-3" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <h1 className="text-[16px] font-semibold text-foreground">{currentTitle}</h1>

          <Badge variant="outline" className="ml-3 border-primary/40 text-primary text-[11px] font-semibold tracking-wide">
            <ShieldCheck className="h-3 w-3 mr-1" />
            ADMIN
          </Badge>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                  {(profile?.full_name || user?.email || 'A').charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{profile?.full_name || 'Admin'}</p>
                <p className="text-xs text-muted-foreground">Platform Admin</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/app/dashboard')}>
                <LayoutDashboard className="h-4 w-4 mr-2" /> Dealer Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-5 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
