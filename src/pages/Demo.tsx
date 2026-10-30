import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowRight, Menu, X, Mail, Settings, LayoutDashboard, Upload, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { generateDemoMetrics } from '@/lib/demoData';

type TimeFilter = 'YTD' | 'MTD' | 'Quarterly';

const demoNavigation = [
  { name: 'Dashboard', icon: LayoutDashboard, active: true },
  { name: 'Easy Upload', icon: Upload },
  { name: 'Settings', icon: Settings },
];

const Demo = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('YTD');
  const [metrics] = useState(() => generateDemoMetrics());
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-muted/40">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — identical to AppLayout */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[220px] bg-card border-r border-border/60 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-0 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-[60px] px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="LogicLot" className="h-7 w-7 rounded flex-shrink-0" />
            <span className="text-[16px] font-bold tracking-tight text-foreground">
              Logic<span className="text-primary">Lot</span>
            </span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Demo badge */}
        <div className="px-5 pb-3">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">Demo Mode</Badge>
          <p className="text-sm font-medium text-foreground mt-1.5">Premier Auto Group</p>
          <p className="text-xs text-muted-foreground">Dallas, TX</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="space-y-0.5">
            {demoNavigation.map((item) => (
              <div
                key={item.name}
                className={cn(
                  'flex items-center gap-3 rounded-xl text-[13.5px] font-medium transition-all duration-150 px-3 py-2.5 cursor-default',
                  item.active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className={cn('h-[18px] w-[18px] flex-shrink-0', item.active ? 'text-primary' : '')} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </nav>

        {/* CTA */}
        <div className="p-4 border-t border-border/60 space-y-2">
          <Button onClick={() => navigate('/auth?tab=signup')} className="w-full gap-2">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => navigate('/contact')} className="w-full justify-start gap-2 text-muted-foreground text-[13px]">
            <Mail className="h-4 w-4" /> Contact Us
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — identical to AppLayout */}
        <header className="sticky top-0 z-30 h-[56px] bg-card/80 backdrop-blur-sm border-b border-border/40 flex items-center px-4 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 mr-3" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-[16px] font-semibold text-foreground">Dashboard</h1>
          <div className="flex-1" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">Demo Mode</Badge>
        </header>

        {/* Page */}
        <main className="flex-1 p-5 lg:p-8 overflow-auto">
          <DashboardContent
            metrics={metrics}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            isDemo
          />
        </main>
      </div>
    </div>
  );
};

export default Demo;
