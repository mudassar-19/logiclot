import { useEffect, useState } from "react";

import manheim from "@/assets/logos/manheim-color.png";
import adesa from "@/assets/logos/adesa-color.png";
import carmax from "@/assets/logos/carmax-color.png";
import copart from "@/assets/logos/copart-color.png";

interface HeroLogoRevealProps {
  isActive: boolean;
}

const LOGOS = [
  { src: manheim, alt: "Manheim", name: "Manheim" },
  { src: adesa, alt: "ADESA", name: "ADESA" },
  { src: carmax, alt: "CarMax Auctions", name: "CarMax Auctions" },
  { src: copart, alt: "Copart", name: "Copart" },
];

const STAGGER_MS = 600;
const TAGLINE_DELAY = LOGOS.length * STAGGER_MS + 400;

const HeroLogoReveal = ({ isActive }: HeroLogoRevealProps) => {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setVisibleCount(0);
      setShowTagline(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    LOGOS.forEach((_, i) => {
      timers.push(
        setTimeout(() => setVisibleCount(i + 1), 400 + i * STAGGER_MS)
      );
    });

    timers.push(setTimeout(() => setShowTagline(true), TAGLINE_DELAY));

    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {LOGOS.map((logo, i) => {
        const visible = i < visibleCount;
        return (
          <div
            key={logo.alt}
            className="flex items-center gap-3 transition-all duration-700 ease-out"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(18px)",
              transitionDelay: `${i * 80}ms`,
            }}
          >
            <img
              src={logo.src}
              alt={logo.alt}
              className="h-10 md:h-12 w-auto object-contain rounded-lg"
            />
            <span
              className="font-heading text-base md:text-lg font-bold tracking-tight"
              style={{ color: "hsl(0 0% 100%)" }}
            >
              {logo.name}
            </span>
          </div>
        );
      })}

      <span
        className="font-heading text-sm md:text-base font-medium text-center transition-all duration-700 ease-out"
        style={{
          color: "hsl(210 100% 85% / 0.8)",
          opacity: showTagline ? 1 : 0,
          transform: showTagline ? "translateY(0)" : "translateY(12px)",
        }}
      >
        + many more auction platforms our system can work with
      </span>
    </div>
  );
};

export default HeroLogoReveal;
