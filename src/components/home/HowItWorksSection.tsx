import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  { step: "01", title: "Sign Up", desc: "Create your account and enter your dealership info" },
  { step: "02", title: "Add Channels", desc: "Set up your marketing channels (defaults preloaded)" },
  { step: "03", title: "Enter Data", desc: "Log monthly spend, leads, and sales per channel" },
  { step: "04", title: "Get Insights", desc: "View AI recommendations and optimize spend" },
];

const smoothEase = [0.16, 1, 0.3, 1] as const;

const HowItWorksSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="section-padding relative" ref={ref}>
      <div className="section-container">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: smoothEase }}
        >
          <h2 className="font-heading text-3xl md:text-[44px] font-bold tracking-[-0.02em] mb-4 leading-tight">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Get started in minutes, see insights in days
          </p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-6 md:gap-8 relative">
          {/* Connecting line */}
          <motion.div 
            className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-border"
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 1, delay: 0.3, ease: smoothEase }}
            style={{ transformOrigin: "left" }}
          />
          
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: smoothEase }}
              className="text-center relative"
            >
              <motion.div 
                className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground font-heading font-bold text-lg flex items-center justify-center mx-auto mb-6 relative z-10"
                style={{ boxShadow: '0 8px 24px -4px hsl(224 100% 52% / 0.25)' }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                {item.step}
              </motion.div>
              <h3 className="font-heading text-lg font-semibold mb-2 tracking-tight">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
