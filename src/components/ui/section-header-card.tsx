import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SectionHeaderCardProps {
  title: string;
  subtitle: string;
  isInView?: boolean;
  className?: string;
}

const SectionHeaderCard = ({ 
  title, 
  subtitle, 
  isInView = true,
  className 
}: SectionHeaderCardProps) => {
  return (
    <motion.div 
      className={cn("text-center mb-16", className)}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="font-heading text-3xl md:text-[44px] font-bold tracking-[-0.02em] mb-4 leading-tight">
        {title}
      </h2>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
        {subtitle}
      </p>
    </motion.div>
  );
};

export default SectionHeaderCard;
