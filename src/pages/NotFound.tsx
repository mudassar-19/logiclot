import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { logger } from '@/lib/logger';
import logo from "@/assets/logo.png";

const log = logger('Router');

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    log.warn('404 — Non-existent route accessed', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src={logo} alt="LogicLot" className="h-10 w-10 rounded" />
          <span className="text-2xl font-brand font-bold tracking-tight">LogicLot</span>
        </div>
        <h1 className="mb-4 text-6xl font-heading font-bold">404</h1>
        <p className="mb-8 text-xl text-muted-foreground">Oops! Page not found</p>
        <Link to="/">
          <Button size="lg" className="btn-glow">
            Return to Home
          </Button>
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
