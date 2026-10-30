import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";

import HeroCounterPhase from "./HeroCounterPhase";
import HeroLogoReveal from "./HeroLogoReveal";

const smoothEase = [0.16, 1, 0.3, 1] as const;
const MORPH_DURATION = "1.2s";
const MORPH_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const PHASE_TIMES = {
  text: 4000,
  counter: 5000,
  logos: 7000,
};

type Phase = "text" | "counter" | "logos";
const PHASE_ORDER: Phase[] = ["text", "counter", "logos"];

const HeroCTA = () => (
  <div
    className="relative z-10 flex flex-col sm:flex-row gap-4 justify-center"
    style={{ transform: "translateZ(0)", willChange: "transform" }}
  >
    <Link to="/get-started">
      <button className="btn-primary-arrow text-base">
        Get Started
        <span className="arrow-circle">
          <ArrowUpRight className="h-4 w-4 text-primary-foreground" />
        </span>
      </button>
    </Link>
    <Link to="/demo">
      <button className="btn-secondary text-base inline-flex items-center gap-2">
        View Demo Dashboard
        <ArrowRight className="h-4 w-4" />
      </button>
    </Link>
  </div>
);

const HeroSection = () => {
  const [phase, setPhase] = useState<Phase>("text");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    setPrefersReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const duration = PHASE_TIMES[phase];
    const id = setTimeout(() => {
      const idx = PHASE_ORDER.indexOf(phase);
      setPhase(PHASE_ORDER[(idx + 1) % PHASE_ORDER.length]);
    }, duration);
    return () => clearTimeout(id);
  }, [prefersReducedMotion, phase]);

  const isText = phase === "text" || prefersReducedMotion;
  const isCounter = phase === "counter" && !prefersReducedMotion;
  const isLogos = phase === "logos" && !prefersReducedMotion;

  const layerStyle = (active: boolean) => ({
    transition: `opacity ${MORPH_DURATION} ${MORPH_EASING}, filter ${MORPH_DURATION} ${MORPH_EASING}, transform ${MORPH_DURATION} ${MORPH_EASING}`,
    opacity: active ? 1 : 0,
    filter: active ? "blur(0px)" : "blur(14px)",
    transform: active ? "scale(1)" : "scale(0.96)",
    willChange: "opacity, filter, transform" as const,
  });

  return (
    <section className="relative min-h-[85vh] flex flex-col overflow-hidden">
      <div
        className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(220 60% 30% / 0.3) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center pt-4 pb-4 md:pt-8 md:pb-6">
        <div className="section-container w-full">
          <div className="text-center max-w-4xl mx-auto">
            {/* MORPH CONTAINER */}
            <div
              className="relative mx-auto overflow-hidden"
              style={{ height: "clamp(260px, 30vw, 340px)" }}
            >
              {/* Layer A: Headline */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={layerStyle(isText)}
              >
                <motion.h1
                  className="font-heading leading-[0.95] tracking-[-0.03em] text-center"
                  style={{
                    fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
                    fontWeight: 800,
                    lineHeight: 1.15,
                    color: "hsl(0 0% 100%)",
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: smoothEase }}
                >
                  Find Profitable Auction Cars
                  <br />
                  <span style={{ color: "hsl(210 100% 80%)" }}>
                    in Seconds with AI.
                  </span>
                </motion.h1>
              </div>

              {/* Layer B: Counter */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={layerStyle(isCounter)}
              >
                <HeroCounterPhase isActive={isCounter} />
              </div>

              {/* Layer C: Logo Reveal */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={layerStyle(isLogos)}
              >
                <HeroLogoReveal isActive={isLogos} />
              </div>
            </div>

            {/* SUBTITLE */}
            <motion.p
              className="text-base md:text-lg leading-relaxed mb-8 mt-6 text-center mx-auto"
              style={{ color: "hsl(220 30% 85%)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: smoothEase }}
            >
              LogicLot analyzes auction run lists and tells dealers what to buy,
              what to skip, and how much to bid.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: smoothEase }}
            >
              <HeroCTA />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
