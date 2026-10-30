import { Progress } from '@/components/ui/progress';
import {
  Car, Clock, Target, DollarSign,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import type { DashboardMetrics } from '@/hooks/useDashboardData';

const COLOR_VEHICLES = 'hsl(224, 100%, 52%)';
const COLOR_HOURS = 'hsl(145, 63%, 42%)';
const COLOR_OPPS = 'hsl(280, 68%, 55%)';
const COLOR_PROFIT = 'hsl(25, 95%, 53%)';

interface DashboardContentProps {
  metrics: DashboardMetrics;
  timeFilter: string;
  setTimeFilter: (f: any) => void;
  isDemo?: boolean;
}

const MegaCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card rounded-2xl border border-border/50 p-6 shadow-[var(--shadow-card)] ${className}`}>
    {children}
  </div>
);

// Weekly demo data with low weekend activity
const weeklyVehicles = [
  { m: 'Mon', v: 245 }, { m: 'Tue', v: 268 }, { m: 'Wed', v: 312 },
  { m: 'Thu', v: 198 }, { m: 'Fri', v: 142 }, { m: 'Sat', v: 18 }, { m: 'Sun', v: 9 },
];
const weeklyHours = [
  { m: 'Mon', v: 1.1 }, { m: 'Tue', v: 1.2 }, { m: 'Wed', v: 1.4 },
  { m: 'Thu', v: 0.9 }, { m: 'Fri', v: 0.6 }, { m: 'Sat', v: 0.08 }, { m: 'Sun', v: 0.02 },
];
const weeklyOpps = [
  { m: 'Mon', v: 4 }, { m: 'Tue', v: 3 }, { m: 'Wed', v: 5 },
  { m: 'Thu', v: 2 }, { m: 'Fri', v: 1 }, { m: 'Sat', v: 0 }, { m: 'Sun', v: 0 },
];
const weeklyMargins = [
  { m: 'Jan', v: 18 }, { m: 'Feb', v: 22 }, { m: 'Mar', v: 27 },
  { m: 'Apr', v: 33 }, { m: 'May', v: 41 }, { m: 'Jun', v: 50 },
];

const DashboardContent = ({ metrics, isDemo }: DashboardContentProps) => {
  const hasData = metrics.hasData || isDemo;
  const dash = '—';

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2" data-tour="kpi-cards">
        {/* Card 1: Weekly Auction Vehicles Analyzed */}
        <MegaCard>
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground tracking-wide flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5" /> Weekly Auction Vehicles Analyzed
            </p>
          </div>
          <h3 className="text-3xl font-bold text-foreground tabular-nums mt-1">
            {hasData ? '6,192' : dash}
          </h3>
          {hasData && (
            <div className="h-20 mt-4 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyVehicles}>
                  <Bar dataKey="v" fill={COLOR_VEHICLES} radius={[3, 3, 0, 0]} />
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'hsl(220,10%,55%)' }} axisLine={false} tickLine={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </MegaCard>

        {/* Card 2: Dealer Hours Saved Weekly */}
        <MegaCard>
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground tracking-wide flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Dealer Hours Saved Weekly
            </p>
          </div>
          <h3 className="text-3xl font-bold text-foreground tabular-nums mt-1">
            {hasData ? '5.3 hrs' : dash}
          </h3>
          {hasData && (
            <div className="h-20 mt-4 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyHours}>
                  <defs>
                    <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLOR_HOURS} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={COLOR_HOURS} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={COLOR_HOURS} fill="url(#hoursGrad)" strokeWidth={2} dot={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'hsl(220,10%,55%)' }} axisLine={false} tickLine={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </MegaCard>

        {/* Card 3: Weekly Winning Opportunities Found */}
        <MegaCard>
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground tracking-wide flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Weekly Winning Opportunities Found
            </p>
          </div>
          <h3 className="text-3xl font-bold text-primary tabular-nums mt-1">
            {hasData ? '15' : dash}
          </h3>
          {hasData && (
            <div className="h-20 mt-4 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyOpps}>
                  <Bar dataKey="v" fill={COLOR_OPPS} radius={[3, 3, 0, 0]} />
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'hsl(220,10%,55%)' }} axisLine={false} tickLine={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </MegaCard>

        {/* Card 4: Profit Increase */}
        <MegaCard>
          <p className="text-xs font-medium text-muted-foreground tracking-wide mb-1 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" style={{ color: COLOR_PROFIT }} /> Front End Profit
          </p>
          <h3 className="text-3xl font-bold tabular-nums mt-1">
            {hasData ? <><span style={{ color: COLOR_VEHICLES }}>Up to 50%</span></> : dash}
          </h3>
          {hasData && (
            <>
              <p className="text-xs text-muted-foreground mt-1">increase in front end profit.</p>
              <div className="h-20 mt-4 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyMargins}>
                    <defs>
                      <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLOR_PROFIT} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={COLOR_PROFIT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={COLOR_PROFIT} fill="url(#marginGrad)" strokeWidth={2} dot={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'hsl(220,10%,55%)' }} axisLine={false} tickLine={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </MegaCard>

      </div>
    </div>
  );
};

export default DashboardContent;
