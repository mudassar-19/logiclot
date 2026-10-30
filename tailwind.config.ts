import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "#FAFBFF",
        input: "#FAFBFF",
        ring: "#5A5AFF",
        background: "#FAFBFF",
        foreground: "#000000",

        primary: {
          DEFAULT: "#5A5AFF",
          foreground: "#FAFBFF",
        },

        secondary: {
          DEFAULT: "#FAFBFF",
          foreground: "#000000",
        },

        destructive: {
          DEFAULT: "#000000",
          foreground: "#FAFBFF",
        },

        muted: {
          DEFAULT: "#FAFBFF",
          foreground: "#000000",
        },

        accent: {
          DEFAULT: "#5A5AFF",
          foreground: "#FAFBFF",
        },

        popover: {
          DEFAULT: "#FAFBFF",
          foreground: "#000000",
        },

        card: {
          DEFAULT: "#FAFBFF",
          foreground: "#000000",
        },

        surface: {
          elevated: "#FAFBFF",
        },

        subtle: "#000000",

        data: {
          blue: "#5A5AFF",
          green: "#5A5AFF",
          cyan: "#5A5AFF",
        },

        charcoal: "#000000",

        slate: {
          DEFAULT: "#000000",
          light: "#FAFBFF",
        },
      },

      fontFamily: {
        heading: ["Minigap", "sans-serif"],
        body: ["Minigap", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        sans: ["Minigap", "sans-serif"],
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        elevated: "var(--shadow-elevated)",
        glow: "var(--shadow-glow)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-up": "slide-up 0.6s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "count-up": "count-up 0.8s ease-out forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        marquee: "marquee 30s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config; 