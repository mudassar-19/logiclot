import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ArrowRight } from 'lucide-react';

interface GradientHomeButtonProps {
  className?: string;
}

/**
 * "Back to Home" button styled to match the "Get Started" gradient CTA
 */
const GradientHomeButton = ({ className }: GradientHomeButtonProps) => {
  return (
    <Link to="/">
      <Button
        size="sm"
        className={`bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0 gap-2 shadow-[0_0_16px_rgba(6,182,212,0.25)] hover:shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all ${className || ''}`}
      >
        <Home className="h-4 w-4" />
        Home
      </Button>
    </Link>
  );
};

export default GradientHomeButton;
