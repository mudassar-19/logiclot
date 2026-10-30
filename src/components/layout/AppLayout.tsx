import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import MovingBackground from '@/components/MovingBackground';

interface AppLayoutProps {
  children?: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="relative min-h-screen" style={{ overflowX: 'hidden' }}>
      {/* Main content wrapper */}
      <div className="relative z-10">
        {children || <Outlet />}
      </div>
    </div>
  );
};

export default AppLayout;
