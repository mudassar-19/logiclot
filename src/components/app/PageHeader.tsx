import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
}

const PageHeader = ({ title, breadcrumbs }: PageHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
      <h4 className="text-lg font-heading font-semibold text-foreground">{title}</h4>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-primary transition-colors">{crumb.label}</Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
