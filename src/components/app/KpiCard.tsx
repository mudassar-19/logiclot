import { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  delta?: string;
  deltaDirection?: 'up' | 'down';
  deltaPositive?: boolean;
  subtitle?: string;
  icon: ReactNode;
}

const KpiCard = ({ title, value, delta, deltaDirection, deltaPositive, subtitle, icon }: KpiCardProps) => {
  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-heading font-bold text-foreground tabular-nums">{value}</h3>
          {delta && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded',
                deltaPositive
                  ? 'text-green-700 bg-green-100'
                  : 'text-red-700 bg-red-100'
              )}>
                {deltaDirection === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {delta}
              </span>
              {subtitle && <span className="text-xs text-muted-foreground ml-1">{subtitle}</span>}
            </div>
          )}
          {!delta && subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
