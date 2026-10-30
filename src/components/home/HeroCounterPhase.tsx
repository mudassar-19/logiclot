import { useEffect, useState, useRef } from "react";

interface HeroCounterPhaseProps {
  isActive: boolean;
}

const HeroCounterPhase = ({ isActive }: HeroCounterPhaseProps) => {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) {
      setCount(0);
      return;
    }

    const target = 480;
    const duration = 2800;
    startRef.current = performance.now();

    const step = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    const timeout = setTimeout(() => {
      frameRef.current = requestAnimationFrame(step);
    }, 600);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frameRef.current);
    };
  }, [isActive]);

  const fadeBase = "transition-all duration-700 ease-out";

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Top label — fades in first */}
      <span
        className={`font-heading font-bold uppercase tracking-[0.12em] text-center ${fadeBase}`}
        style={{
          fontSize: "clamp(1.2rem, 3vw, 1.8rem)",
          color: "hsl(210 100% 85% / 0.85)",
          opacity: isActive ? 1 : 0,
          transform: isActive ? "translateY(0)" : "translateY(8px)",
          transitionDelay: "0ms",
        }}
      >
        Currently Helping
      </span>

      {/* Big number — fades in second */}
      <div
        className={`relative ${fadeBase}`}
        style={{
          opacity: isActive ? 1 : 0,
          transform: isActive ? "scale(1)" : "scale(0.92)",
          transitionDelay: "200ms",
        }}
      >
        {/* Subtle glow behind */}
        <div
          className="absolute inset-0 -inset-x-8 -inset-y-4 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(224 100% 52% / 0.08) 0%, transparent 70%)",
          }}
        />
        <span
          className="relative font-heading font-extrabold tabular-nums"
          style={{
            fontSize: "clamp(4rem, 12vw, 8rem)",
            lineHeight: 1,
            color: "hsl(0 0% 100%)",
          }}
        >
          {count}+
        </span>
      </div>

      {/* Subtitle — fades in last */}
      <span
        className={`font-heading font-bold uppercase tracking-[0.12em] text-center ${fadeBase}`}
        style={{
          fontSize: "clamp(1.2rem, 3vw, 1.8rem)",
          color: "hsl(210 100% 85% / 0.85)",
          opacity: isActive ? 1 : 0,
          transform: isActive ? "translateY(0)" : "translateY(8px)",
          transitionDelay: "400ms",
        }}
      >
        Dealers Nationwide
      </span>

    </div>
  );
};

export default HeroCounterPhase;
