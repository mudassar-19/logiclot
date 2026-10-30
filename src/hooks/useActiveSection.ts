import { useState, useEffect } from "react";

const SECTION_IDS = ["top", "how-it-works", "learn-more", "pricing", "contact"];

export function useActiveSection() {
  const [active, setActive] = useState("top");

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY < 200) {
        setActive("top");
        return;
      }

      let current = "top";
      for (const id of SECTION_IDS) {
        if (id === "top") continue;
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Section is considered active when its top is within the upper 60% of viewport
          if (rect.top <= window.innerHeight * 0.45) {
            current = id;
          }
        }
      }
      setActive(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return active;
}
