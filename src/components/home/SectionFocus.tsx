import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface SectionFocusProps {
  children: ReactNode;
  className?: string;
  fullScreen?: boolean;
}

const SectionFocus = ({ children, className = "", fullScreen = false }: SectionFocusProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.25, margin: "-40px 0px -40px 0px" });

  return (
    <motion.div
      ref={ref}
      className={`${fullScreen ? "min-h-[100dvh] flex flex-col justify-center" : ""} ${className}`}
      animate={{
        opacity: isInView ? 1 : 0.3,
        scale: isInView ? 1 : 0.95,
        filter: isInView ? "blur(0px)" : "blur(2.5px)",
      }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default SectionFocus;
