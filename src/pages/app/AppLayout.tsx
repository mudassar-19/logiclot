import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardList,
  Clock,
  Settings,
  LogOut,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TooltipTrigger as TooltipTriggerBase,
} from '@/components/ui/tooltip';

const navigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { name: 'Buying Preferences', href: '/app/preferences', icon: SlidersHorizontal },
  { name: 'Buy list', href: '/app/buy-list', icon: ClipboardList },
  { name: 'History', href: '/app/lane-strategy', icon: Clock },
  { name: 'Account', href: '/app/settings', icon: Settings },
];

const pageTitles: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/preferences': 'Buying Preferences',
  '/app/buy-list': 'Buy List',
  '/app/lane-strategy': 'Lane Strategy',
  '/app/settings': 'Settings',
};

const AppLayout = () => {
  const { user, profile, organization, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string, name: string) => {
    if (name === 'Run lists') {
      return (location.pathname === '/app/dashboard' || location.pathname === '/app') && location.hash === '#run-lists';
    }
    if (path === '/app/dashboard') {
      return (location.pathname === '/app/dashboard' || location.pathname === '/app') && location.hash !== '#run-lists';
    }
    return location.pathname.startsWith(path);
  };

  const currentTitle = pageTitles[location.pathname.split('?')[0]] || 'Dashboard';
  const isDashboard = location.pathname === '/app/dashboard' || location.pathname === '/app';

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen flex bg-[#FAFBFF] w-full max-w-full overflow-x-hidden">
        {/* Sidebar — visible on desktop (>=768px), hidden on mobile */}
        <aside className="hidden md:flex w-[60px] lg:w-[200px] bg-[#12131A] text-white border-r border-white/10 flex-col transition-all duration-200 shrink-0 h-screen sticky top-0 z-50">
          {/* Logo */}
          <div className="flex items-center h-[60px] px-4 gap-2 border-b border-white/10 flex-shrink-0">
            <img src={logo} alt="LogicLot" className="h-7 w-7 rounded flex-shrink-0" />
            <span className="text-[16px] font-bold tracking-tight text-white hidden lg:inline">
              Logic<span className="text-[#5A5AFF]">Lot</span>
            </span>
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-4 px-2 overflow-y-auto">
            <div className="space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href, item.name);
                const linkContent = (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl text-[13.5px] font-medium transition-all duration-150 py-2.5',
                      'lg:justify-start lg:px-3 justify-center px-2',
                      active
                        ? 'bg-[#5A5AFF] text-white font-semibold'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                    <span className="hidden lg:inline">{item.name}</span>
                  </NavLink>
                );

                return (
                  <div key={item.name} className="lg:block">
                    <div className="lg:hidden">
                      <Tooltip>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs bg-[#12131A] text-white border-white/10">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="hidden lg:block">{linkContent}</div>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Plan Chip / Pinned Bottom Section */}
          <div className="mt-auto border-t border-white/10 p-2 flex-shrink-0">
            {/* Plan Info Card - Expanded (Lg View) */}
            <div className="hidden lg:flex flex-col gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10 mb-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12px] text-white">Pro Plan</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#5A5AFF] text-white font-bold tracking-wider">ACTIVE</span>
              </div>
              <div className="space-y-1 mt-1 text-[11px] text-white/75">
                <div className="flex justify-between">
                  <span>Daily limit:</span>
                  <span className="text-white font-semibold">100 uploads</span>
                </div>
                <div className="flex justify-between">
                  <span>Renewal:</span>
                  <span className="text-white font-semibold">Mar 1, 2026</span>
                </div>
              </div>
            </div>

            {/* Plan Info Icon - Collapsed (Below Lg View) */}
            <div className="flex lg:hidden justify-center py-2 mb-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center cursor-help">
                    <span className="text-[10px] font-bold text-[#5A5AFF]">PRO</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs bg-[#12131A] text-white border-white/10">
                  <p className="font-semibold">Pro Plan (Active)</p>
                  <p className="text-white/75 mt-0.5">Limit: 100 uploads/day</p>
                  <p className="text-white/75">Renews: Mar 1, 2026</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Logout Link */}
            <div className="lg:block">
              <div className="lg:hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors w-full px-2 py-2.5"
                    >
                      <LogOut className="h-[18px] w-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs bg-[#12131A] text-white border-white/10">
                    Logout
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="hidden lg:block">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 rounded-xl text-[13.5px] font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors w-full px-3 py-2.5"
                >
                  <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className={cn(
            "sticky top-0 z-30 h-[56px] bg-white/80 backdrop-blur-sm border-b border-border/40 flex items-center px-4 lg:px-8",
            isDashboard ? "flex md:hidden" : "flex"
          )}>
            <h1 className="text-[16px] font-semibold text-foreground">{currentTitle}</h1>
            <div className="flex-1" />
            {organization?.name && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-[11.5px] tracking-wide mr-2 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#5A5AFF] shrink-0 animate-pulse"></span>
                <span>{organization.name}</span>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-slate-100">
                  <div className="h-8 w-8 rounded-full bg-[#5A5AFF] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col items-start text-left ml-1">
                    <span className="text-[12.5px] font-semibold text-foreground leading-tight">
                      {profile?.full_name || 'User'}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border border-border">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.full_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{organization?.name || 'Dealer'}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/app/settings')}>
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-5 lg:p-8 overflow-auto bg-[#FAFBFF] pb-24 md:pb-8">
            <Outlet />
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#12131A] border-t border-white/10 flex items-center justify-around z-50 px-2">
            {navigation.map((item) => {
              const active = isActive(item.href, item.name);
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 py-1 gap-1 text-[10px] font-medium transition-colors duration-150',
                    active
                      ? 'text-[#5A5AFF] font-bold'
                      : 'text-white/60 hover:text-white'
                  )}
                >
                  <item.icon className="h-[20px] w-[20px]" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AppLayout;
