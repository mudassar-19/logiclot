import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";

const smoothEase = [0.16, 1, 0.3, 1] as const;

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="section-padding relative" ref={ref}>
      <div className="section-container">
        <motion.div
          className="landing-card-blue p-12 md:p-16 text-center relative overflow-hidden"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: smoothEase }}
        >
          {/* Faint grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `
                linear-gradient(hsl(0 0% 100%) 1px, transparent 1px),
                linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
            }}
          />

          <div className="relative z-10">
            <h2 className="font-heading text-3xl md:text-[44px] font-bold mb-5 text-primary-foreground tracking-[-0.02em] leading-tight">
              Ready to stop missing profitable auction opportunities?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join dealers using LogicLot to find the best vehicles and build smarter bidding strategies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/get-started">
                <button className="inline-flex items-center gap-3 pl-7 pr-2.5 py-2.5 rounded-full font-semibold bg-primary-foreground text-primary transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                  Get Started
                  <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10">
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                  </span>
                </button>
              </Link>
              <Link to="/contact">
                <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold bg-transparent border border-primary-foreground/30 text-primary-foreground transition-all duration-300 hover:bg-primary-foreground/10 hover:-translate-y-0.5">
                  Contact Us
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
