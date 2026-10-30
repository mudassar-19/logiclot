import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  Upload,
  Sparkles,
  CheckCircle,
  DollarSign,
  Layers,
  ArrowUpRight,
  Shield,
  FileSpreadsheet,
  Play,
  Activity,
  Calculator,
  ChevronRight,
  HelpCircle,
  Clock,
  TrendingUp,
  Globe,
  Database,
  Smartphone,
  Cpu,
  Code,
  Settings,
  Check,
  Zap,
  Server,
  AlertCircle,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import HomeFooter from "@/components/home/HomeFooter";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Runlist auction provider logos
import adesaImg from "@/assets/logos/adesa.jpg";
import carmaxImg from "@/assets/logos/carmax-auctions.jpg";
import manheimImg from "@/assets/logos/manheim.webp";
import iaaLogo from "@/assets/logos/iaa-color.svg";

// Color logos for the marquee compatibility cards
import adesaColorLogo from "@/assets/logos/adesa-color.png";
import carmaxColorLogo from "@/assets/logos/carmax-color.png";
import manheimColorLogo from "@/assets/logos/manheim-color.png";
import iaaColorLogo from "@/assets/logos/iaa-color.svg";

/* ─── Animated Counter Hook ─────────────────────────────────── */
function useAnimatedCounter(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return { ref, count };
}

/* ─── Words Rotation ─────────────────────────────────────────── */
const WordsRotation = () => {
  const phrases = [
    "Know your max bid before you raise your hand.",
    "Spot the profit before the lane opens.",
    "Walk in with a buy list, not a guess.",
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  return (
    <div className="relative inline-block text-2xl sm:text-3xl md:text-4xl lg:text-5xl min-h-[6rem] sm:min-h-[6.5rem] md:min-h-[5rem] lg:min-h-[6rem] w-full text-[#5A5AFF] font-black py-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
          transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
          className="absolute left-0 top-0 w-full h-full flex flex-wrap justify-center sm:justify-start items-center gap-x-2 md:gap-x-2.5 leading-[1.1] pb-1"
        >
          {phrases[index].split(" ").map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="inline-block"
            >
              {word}
            </motion.span>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/* ─── Floating Orb ───────────────────────────────────────────── */
const FloatingOrb = ({
  className,
  delay = 0,
}: {
  className: string;
  delay?: number;
}) => (
  <motion.div
    className={`absolute rounded-full pointer-events-none ${className}`}
    animate={{
      y: [0, -30, 10, -20, 0],
      x: [0, 15, -10, 20, 0],
      scale: [1, 1.08, 0.95, 1.05, 1],
    }}
    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay }}
  />
);

/* ─── Tilt Card ──────────────────────────────────────────────── */
const TiltCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-50, 50], [6, -6]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(x, [-50, 50], [-6, 6]), {
    stiffness: 150,
    damping: 20,
  });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ─── CAR DATA ───────────────────────────────────────────────── */
const CAR_DATA = [
  {
    id: "accord",
    name: "2019 Honda Accord LX",
    retail: 21500,
    recon: 1200,
    fee: 500,
    specs: "1HGCV1F40JA171388 • 65,509 mi • 3.8 CR",
    image: "/images/cars/sedan.png",
  },
  {
    id: "sequoia",
    name: "2020 Toyota Sequoia Platinum",
    retail: 54000,
    recon: 1800,
    fee: 900,
    specs: "5TDDY5G11BS042263 • 127,394 mi • 4.2 CR",
    image: "/images/cars/suv.png",
  },
  {
    id: "f150",
    name: "2021 Ford F-150 XLT",
    retail: 38200,
    recon: 1500,
    fee: 600,
    specs: "1FTFW1E51MKD82914 • 48,120 mi • 3.5 CR",
    image: "/images/cars/truck.png",
  },
  {
    id: "model3",
    name: "2022 Tesla Model 3 LR",
    retail: 31000,
    recon: 1100,
    fee: 600,
    specs: "5YJ3E1EB6NF291845 • 32,450 mi • 4.1 CR",
    image: "/images/cars/ev.png",
  },
];

const HISTORY_FLAGS = [
  {
    id: "salvage",
    label: "Salvage Title",
    penalty: -0.3,
    desc: "-30% retail value penalty",
  },
  {
    id: "rebuilt",
    label: "Rebuilt Title",
    penalty: -0.25,
    desc: "-25% retail value penalty",
  },
  {
    id: "accident",
    label: "Major Accident Flag",
    penalty: -0.1,
    desc: "-10% retail value penalty",
  },
  {
    id: "lemon",
    label: "Lemon Buyback Title",
    penalty: -0.15,
    desc: "-15% retail value penalty",
  },
  {
    id: "tmu",
    label: "TMU (True Mileage Unknown)",
    penalty: -0.25,
    desc: "-25% retail value penalty",
  },
];

/* ─── Framer Variants ────────────────────────────────────────── */
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.215, 0.61, 0.355, 1] },
  },
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.215, 0.61, 0.355, 1] },
  },
};

const fadeInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.215, 0.61, 0.355, 1] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.13, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.215, 0.61, 0.355, 1] },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.65, ease: [0.215, 0.61, 0.355, 1] },
  },
};

/* ─── Runlist Showcase ───────────────────────────────────────── */
const RUNLIST_PROVIDERS = [
  {
    name: "Manheim",
    tagline: "Largest wholesale auto auction network",
    img: manheimImg,
    accent: "#5A5AFF",
    badge: "MANHEIM",
  },
  {
    name: "ADESA",
    tagline: "National physical & digital auction platform",
    img: adesaImg,
    accent: "#3B82F6",
    badge: "ADESA",
  },
  {
    name: "CarMax Auctions",
    tagline: "Quality dealer-only auction marketplace",
    img: carmaxImg,
    accent: "#6366F1",
    badge: "CARMAX",
  },
  {
    name: "IAA",
    tagline: "Insurance Auto Auctions",
    img: iaaLogo,
    accent: "#D32F2F",
    badge: "IAA",
  },
];

const RunlistShowcase = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % RUNLIST_PROVIDERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="relative py-20 bg-[#020813] border-y border-white/5 overflow-hidden"
      data-section-name="runlist-showcase"
    >
      <FloatingOrb
        className="w-[500px] h-[500px] bg-[#5A5AFF]/6 blur-[140px] top-[-30%] left-[20%]"
        delay={3}
      />

      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeInUp}
          className="text-center mb-14"
        >
          <Badge className="bg-[#5A5AFF]/15 text-[#5A5AFF] border-none px-3.5 py-1 text-xs font-bold rounded-full mb-3">
            SUPPORTED RUN LISTS
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
            Parse run lists from all major auctions
          </h2>
          <p className="text-slate-400 text-sm md:text-base font-semibold max-w-xl mx-auto leading-relaxed">
            Upload PDFs, CSVs, or Excel sheets directly from Manheim, ADESA,
            CarMax, and IAA. LogicLot reads any format instantly.
          </p>
        </motion.div>

        {/* Main showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Large preview card */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scaleIn}
            className="lg:col-span-7 relative"
          >
            <div
              className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#070d19] shadow-2xl"
              style={{ minHeight: 320 }}
            >
              {/* Animated glow behind image */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                }}
                style={{
                  background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${RUNLIST_PROVIDERS[active].accent}18, transparent 80%)`,
                }}
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.6, ease: [0.215, 0.61, 0.355, 1] }}
                  className="relative z-10 flex flex-col items-center justify-center p-10 text-center"
                  style={{ minHeight: 320 }}
                >
                  <div className="relative mb-6">
                    <div
                      className="rounded-2xl overflow-hidden border border-white/10 shadow-xl"
                      style={{
                        width: 220,
                        height: 110,
                        background: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto",
                      }}
                    >
                      <img
                        src={RUNLIST_PROVIDERS[active].img}
                        alt={RUNLIST_PROVIDERS[active].name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          padding: "12px",
                        }}
                        loading="lazy"
                      />
                    </div>
                    <motion.div
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-emerald-500 border-2 border-[#070d19] flex items-center justify-center shadow-lg"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <CheckCircle className="h-4 w-4 text-white" />
                    </motion.div>
                  </div>
                  <h3 className="text-xl font-black text-white mb-1">
                    {RUNLIST_PROVIDERS[active].name}
                  </h3>
                  <p className="text-sm text-slate-400 font-semibold">
                    {RUNLIST_PROVIDERS[active].tagline}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-none text-[10px] font-bold px-2.5 py-1">
                      FULLY SUPPORTED
                    </Badge>
                    <Badge className="bg-[#5A5AFF]/15 text-[#5A5AFF] border-none text-[10px] font-bold px-2.5 py-1">
                      AUTO-PARSE
                    </Badge>
                  </div>
                </motion.div>
              </AnimatePresence>
              {/* Bottom progress dots */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                {RUNLIST_PROVIDERS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${i === active ? "w-8 bg-[#5A5AFF]" : "w-2 bg-white/20 hover:bg-white/40"}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Side list of providers */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="lg:col-span-5 flex flex-col gap-3"
          >
            {RUNLIST_PROVIDERS.map((p, i) => (
              <motion.button
                key={i}
                variants={staggerItem}
                onClick={() => setActive(i)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300 w-full group ${
                  i === active
                    ? "border-[#5A5AFF]/40 bg-[#5A5AFF]/8 shadow-lg shadow-[#5A5AFF]/10"
                    : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15"
                }`}
              >
                <div
                  className="w-14 h-10 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 flex items-center justify-center"
                  style={{ background: "#fff" }}
                >
                  <img
                    src={p.img}
                    alt={p.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      padding: "4px",
                    }}
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-white block">
                    {p.name}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium truncate block">
                    {p.tagline}
                  </span>
                </div>
                {i === active && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0"
                  >
                    <CheckCircle className="h-3 w-3 text-emerald-400" />
                  </motion.div>
                )}
              </motion.button>
            ))}

            <div className="mt-2 p-4 rounded-2xl border border-white/8 bg-[#070d19]">
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                <span className="text-white font-bold">+ More supported:</span>{" "}
                Adesa Canada, Manheim Express, and custom CSV/Excel formats.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* ─── Marquee Compatibility Brands ───────────────────────────── */
const MARQUEE_BRANDS = [
  { name: "MANHEIM", logo: manheimColorLogo },
  { name: "ADESA", logo: adesaColorLogo },
  { name: "CARMAX", logo: carmaxColorLogo },
  { name: "IAA", logo: iaaColorLogo },
  { name: "ADESA CANADA", logo: adesaColorLogo },
  { name: "MANHEIM EXPRESS", logo: manheimColorLogo },
];

/* ─── Home Component ─────────────────────────────────────────── */
const Home = () => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(CAR_DATA[0]);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [targetProfit, setTargetProfit] = useState(2500);
  const [animatedMaxBid, setAnimatedMaxBid] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  // Animated counters
  const counter1 = useAnimatedCounter(100);
  const counter2 = useAnimatedCounter(10);

  // Real-time calculation logic for max bid
  const totalPenaltyRate = selectedFlags.reduce((sum, flagId) => {
    const flag = HISTORY_FLAGS.find((f) => f.id === flagId);
    return sum + (flag ? flag.penalty : 0);
  }, 0);
  const cappedPenaltyRate = Math.max(-0.6, totalPenaltyRate);
  const adjustedRetail = Math.round(
    selectedCar.retail * (1 + cappedPenaltyRate),
  );
  const targetMaxBid = Math.max(
    0,
    adjustedRetail - targetProfit - selectedCar.recon - selectedCar.fee,
  );

  const handleToggleFlag = (flagId: string) => {
    setSelectedFlags((prev) => {
      // Salvage and rebuilt are mutually exclusive
      if (flagId === "salvage") {
        if (prev.includes("salvage"))
          return prev.filter((id) => id !== "salvage");
        return [...prev.filter((id) => id !== "rebuilt"), "salvage"];
      }
      if (flagId === "rebuilt") {
        if (prev.includes("rebuilt"))
          return prev.filter((id) => id !== "rebuilt");
        return [...prev.filter((id) => id !== "salvage"), "rebuilt"];
      }
      if (prev.includes(flagId)) return prev.filter((id) => id !== flagId);
      return [...prev, flagId];
    });
  };

  useEffect(() => {
    const start = animatedMaxBid;
    const end = targetMaxBid;
    if (start === end) return;
    const duration = 400;
    const step = (end - start) / (duration / 16);
    let current = start;
    const timer = setInterval(() => {
      current += step;
      if ((step > 0 && current >= end) || (step < 0 && current <= end)) {
        setAnimatedMaxBid(end);
        clearInterval(timer);
      } else {
        setAnimatedMaxBid(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [targetMaxBid]);

  return (
    <div className="min-h-screen bg-[#020813] text-white font-sans selection:bg-[#5A5AFF]/20 selection:text-[#5A5AFF] overflow-x-hidden">
      <SiteHeader />

      {/* ════════════════════════ HERO ════════════════════════ */}
      <section
        className="relative min-h-screen flex items-center pt-32 pb-20 md:pt-40 md:pb-28 bg-[#020813] overflow-hidden"
        data-section-name="hero"
      >
        {/* Floating background orbs */}
        <FloatingOrb
          className="w-[600px] h-[600px] bg-[#5A5AFF]/8 blur-[120px] top-[-10%] left-[-15%]"
          delay={0}
        />
        <FloatingOrb
          className="w-[400px] h-[400px] bg-blue-600/6 blur-[100px] top-[30%] right-[-10%]"
          delay={4}
        />
        <FloatingOrb
          className="w-[300px] h-[300px] bg-indigo-500/8 blur-[90px] bottom-[-5%] left-[30%]"
          delay={8}
        />

        {/* Video / poster background */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000"
            style={{
              backgroundImage: "url(/images/hero-poster.jpg)",
              opacity: videoLoaded ? 0.15 : 0.45,
            }}
          />
          <video
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
            onLoadedMetadata={() => setVideoLoaded(true)}
            onCanPlay={() => setVideoLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none brightness-[0.95] contrast-110 transition-opacity duration-1000 ${videoLoaded ? "opacity-75" : "opacity-0"}`}
            preload="auto"
          >
            <source src="/videos/hero-bg.mp4" type="video/mp4" />
            <source
              src="https://assets.mixkit.co/videos/preview/mixkit-car-headlights-in-the-rain-at-night-42211-large.mp4"
              type="video/mp4"
            />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-[#020813]/60 via-[#020813]/25 to-[#020813]/40 z-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020813]/20 to-[#020813] z-10" />
        </div>

        {/* Grid noise texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(90,90,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(90,90,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />

        <div className="max-w-[1200px] mx-auto px-6 relative z-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.1,
                ease: [0.215, 0.61, 0.355, 1],
              }}
              className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-bold uppercase tracking-wider mb-6 transition-all backdrop-blur-sm cursor-default"
              >
                <motion.span
                  animate={{ rotate: [0, 15, -10, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 3,
                    ease: "easeInOut",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#5A5AFF]" />
                </motion.span>
                Auction Buying, Simplified.
              </motion.div>

              <div className="w-full text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] mb-6">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-white"
                >
                  Stop guessing at auction.
                </motion.h1>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  <WordsRotation />
                </motion.div>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="text-base md:text-lg text-slate-400 max-w-xl mb-10 leading-relaxed font-medium"
              >
                Upload your auction run list and know exactly which cars to bid
                on — in minutes, not hours.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.75 }}
                className="w-full sm:w-auto flex flex-col sm:flex-row justify-center lg:justify-start gap-4"
              >
                <Link to="/get-started" className="w-full sm:w-auto">
                  <motion.button
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#5A5AFF] hover:bg-[#4646ff] text-white px-8 py-4 rounded-full font-bold transition-colors shadow-lg shadow-[#5A5AFF]/25 hover:shadow-xl hover:shadow-[#5A5AFF]/40"
                  >
                    Get Started
                    <Upload className="h-4 w-4" />
                  </motion.button>
                </Link>
                <div className="w-full sm:w-auto">
                  <motion.button
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setVideoOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-4 rounded-full font-bold transition-all backdrop-blur-md cursor-pointer"
                  >
                    <span className="h-6 w-6 border-2 border-white rounded-full flex items-center justify-center">
                      <Play className="h-3 w-3 fill-white text-white ml-0.5" />
                    </span>
                    Why we build LogicLot
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.4,
                ease: [0.215, 0.61, 0.355, 1],
              }}
              className="lg:col-span-5 hidden lg:block"
            >
              <TiltCard className="bg-[#070d19] rounded-3xl p-6 border border-white/10 shadow-2xl relative overflow-hidden cursor-default">
                <div className="absolute top-0 right-0 w-40 h-40 bg-[#5A5AFF]/8 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-600/5 rounded-full blur-xl pointer-events-none" />
                <h3 className="font-extrabold text-white text-sm mb-3 flex items-center gap-2">
                  <motion.span
                    className="h-2 w-2 rounded-full bg-[#5A5AFF]"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                  Today's Run List Activity
                </h3>
                <div className="space-y-3 font-semibold text-xs text-slate-300">
                  {[
                    {
                      label: "Parsed Vehicles",
                      value: "1,245 units",
                      color: "text-white",
                    },
                    {
                      label: "Run Lists Analyzed",
                      value: "18 lists",
                      color: "text-white",
                    },
                    {
                      label: "Vehicles Flagged as Buys",
                      value: "242 units",
                      color: "text-[#5A5AFF]",
                    },
                    {
                      label: "Est. Profit Identified",
                      value: "$214,300",
                      color: "text-emerald-400 font-bold",
                    },
                  ].map((row, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.12 }}
                      className="flex justify-between py-2 border-b border-white/10"
                    >
                      <span>{row.label}</span>
                      <span className={row.color}>{row.value}</span>
                    </motion.div>
                  ))}
                </div>
              </TiltCard>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-2 rounded-full bg-[#5A5AFF]" />
          </motion.div>
        </motion.div>
      </section>

      {/* ════════════════ RUNLIST PROVIDERS SHOWCASE ════════════════ */}
      <RunlistShowcase />

      {/* ════════════════ WHY LOGICLOT ════════════════ */}
      <section
        id="why-logiclot"
        className="py-24 bg-[#020813] border-t border-white/10 relative overflow-hidden"
        data-section-name="why-logiclot"
      >
        <FloatingOrb
          className="w-[500px] h-[500px] bg-[#5A5AFF]/7 blur-[140px] top-[-10%] right-[-5%]"
          delay={2}
        />
        <FloatingOrb
          className="w-[350px] h-[350px] bg-blue-600/5 blur-[100px] bottom-[5%] left-[-5%]"
          delay={7}
        />

        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16 max-w-2xl mx-auto"
          >
            <Badge className="bg-[#5A5AFF]/15 text-[#5A5AFF] border-none px-3.5 py-1 text-xs font-bold rounded-full mb-3">
              WHY LOGICLOT
            </Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Stop guessing at auctions.
              <br />
              Start buying with certainty.
            </h2>
            <p className="text-slate-400 text-sm md:text-base font-semibold leading-relaxed">
              Most dealers walk into auction lanes with gut feelings. LogicLot
              gives you a data-driven ceiling bid for every car on the run list
              — before the gavel drops.
            </p>
          </motion.div>

          {/* Big contrast cards */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10"
          >
            {/* Without LogicLot */}
            <motion.div
              variants={staggerItem}
              className="rounded-2xl border border-red-500/15 bg-red-950/10 p-6 md:p-8 space-y-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                  Without LogicLot
                </span>
              </div>
              <ul className="space-y-3 text-sm text-slate-400 font-semibold">
                {[
                  "Manually copying VINs into spreadsheets for hours",
                  "No idea what retail comps look like in your market",
                  "Guessing on recon costs and overbidding vehicles",
                  "Walking away empty-handed or overpaying",
                  "Missing salvage/TMU flags buried in run list PDFs",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 h-4 w-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 text-red-400 text-[10px] font-black">
                      ✕
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* With LogicLot */}
            <motion.div
              variants={staggerItem}
              className="rounded-2xl border border-[#5A5AFF]/25 bg-[#5A5AFF]/8 p-6 md:p-8 space-y-4 relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  ease: "easeInOut",
                }}
                style={{
                  background:
                    "radial-gradient(ellipse 70% 60% at 80% 20%, rgba(90,90,255,0.1), transparent 80%)",
                }}
              />
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <Zap className="h-5 w-5 text-[#5A5AFF]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5AFF]">
                  With LogicLot
                </span>
              </div>
              <ul className="space-y-3 text-sm text-slate-200 font-semibold relative z-10">
                {[
                  "Upload any run list PDF or CSV — parsed in seconds",
                  "Live retail comps pulled within your exact mileage radius",
                  "Recon, buyer fees, and profit margin factored into every bid",
                  "Walk into the lanes with a printed ceiling bid per vehicle",
                  "Salvage, TMU, and rebuilt flags auto-detected and penalized",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 h-4 w-4 rounded-full bg-[#5A5AFF]/25 border border-[#5A5AFF]/40 flex items-center justify-center flex-shrink-0 text-[#5A5AFF] text-[10px] font-black">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          {/* 4 stat/reason pills */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              {
                icon: <Clock className="h-5 w-5 text-[#5A5AFF]" />,
                stat: "< 60s",
                label: "Full run list parsed",
                sub: "Any format, any auction",
              },
              {
                icon: <DollarSign className="h-5 w-5 text-[#5A5AFF]" />,
                stat: "$0 guesswork",
                label: "Data-driven bids only",
                sub: "Live comps + your margin",
              },
              {
                icon: <Shield className="h-5 w-5 text-[#5A5AFF]" />,
                stat: "Auto-flag",
                label: "Title & history checks",
                sub: "Salvage, TMU, rebuilt",
              },
              {
                icon: <Smartphone className="h-5 w-5 text-[#5A5AFF]" />,
                stat: "Mobile-ready",
                label: "Lane sheets on your phone",
                sub: "Bid anywhere, anytime",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={staggerItem}
                whileHover={{ y: -4, borderColor: "rgba(90,90,255,0.3)" }}
                className="flex flex-col gap-2 p-5 rounded-2xl bg-[#070d19] border border-white/10 transition-all duration-300"
              >
                <div className="h-9 w-9 rounded-xl bg-[#5A5AFF]/12 border border-[#5A5AFF]/20 flex items-center justify-center">
                  {item.icon}
                </div>
                <span className="text-lg font-black text-white">
                  {item.stat}
                </span>
                <span className="text-xs font-bold text-slate-200 leading-tight">
                  {item.label}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  {item.sub}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════ SECTION 3: Buy List / Showroom ════════════════ */}
      <section
        id="showroom"
        className="py-24 bg-[#020813] border-t border-white/10 relative overflow-hidden"
        data-section-name="online-and-in-person"
      >
        <FloatingOrb
          className="w-[350px] h-[350px] bg-indigo-600/5 blur-[100px] bottom-[10%] right-[5%]"
          delay={3}
        />

        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="pb-16"
          >
            <div className="flex flex-wrap md:flex-nowrap items-baseline justify-between gap-6">
              <div className="w-full md:w-2/3 lg:w-3/5">
                <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
                  Source more in more places
                </h3>
              </div>
              <div className="w-full md:w-1/3 lg:w-2/5">
                <p className="text-slate-450 text-sm leading-relaxed font-semibold">
                  Get a{" "}
                  <Link
                    to="/get-started"
                    className="text-[#5A5AFF] underline hover:no-underline font-bold"
                  >
                    wholesale buy list builder
                  </Link>{" "}
                  built to screen wholesale runs and export target bid limits
                  automatically.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Buy List Table */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scaleIn}
            className="mb-8"
          >
            <div className="bg-[linear-gradient(0deg,#070d19_20%,#0f1d3a)] rounded-2xl overflow-hidden flex flex-col justify-between border-t border-white/10 shadow-card p-6 md:p-8 relative">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-4 mb-6 gap-4">
                <div>
                  <span className="text-xs text-[#5A5AFF] font-bold uppercase tracking-wider block">
                    Auto-Generated Buy List
                  </span>
                  <h4 className="text-sm font-extrabold text-white mt-0.5">
                    Scored Auction Runs
                  </h4>
                </div>
                <Badge className="bg-blue-950 text-[#5A5AFF] border border-[#5A5AFF]/20 font-bold px-2.5 py-1">
                  Radius: 100mi radius
                </Badge>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/20 bg-[#020813]/50">
                <table
                  className="w-full text-left text-xs"
                  style={{ borderCollapse: "separate", borderSpacing: 0 }}
                >
                  <thead>
                    <tr className="bg-[#020813]/80 text-slate-400 font-bold border-b border-white/15">
                      <th className="p-3.5 border-r border-white/10">
                        Vehicle Details
                      </th>
                      <th className="p-3.5 border-r border-white/10">
                        Odometer
                      </th>
                      <th className="p-3.5 text-right border-r border-white/10">
                        Est. Recon
                      </th>
                      <th className="p-3.5 text-right border-r border-white/10">
                        Est. Profit
                      </th>
                      <th className="p-3.5 text-right border-r border-white/10">
                        Max Bid
                      </th>
                      <th className="p-3.5 text-center">AI Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium text-slate-200">
                    {[
                      {
                        car: "2019 Honda Accord LX",
                        vin: "1HGCV1F40JA171388",
                        odo: "65,509 mi",
                        recon: "$1,200",
                        profit: "+$2,450",
                        bid: "$15,100",
                        label: "Strong Buy",
                        color: "text-[#5A5AFF]",
                        bg: "bg-blue-950",
                        border: "border-[#5A5AFF]/20",
                      },
                      {
                        car: "2020 Toyota Sequoia Platinum",
                        vin: "5TDDY5G11BS042263",
                        odo: "127,394 mi",
                        recon: "$1,850",
                        profit: "+$1,950",
                        bid: "$12,050",
                        label: "Buy",
                        color: "text-blue-400",
                        bg: "bg-blue-950/55",
                        border: "border-blue-500/20",
                      },
                    ].map((row, i) => (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.15 }}
                        className="hover:bg-white/5 transition-colors border-b border-white/10 last:border-b-0"
                      >
                        <td className="p-3.5 font-bold text-white border-r border-white/10">
                          {row.car}
                          <span className="block text-[9.5px] text-slate-450 font-normal mt-0.5">
                            {row.vin}
                          </span>
                        </td>
                        <td className="p-3.5 border-r border-white/10">
                          {row.odo}
                        </td>
                        <td className="p-3.5 text-right border-r border-white/10">
                          {row.recon}
                        </td>
                        <td
                          className={`p-3.5 text-right border-r border-white/10 ${row.color} font-black`}
                        >
                          {row.profit}
                        </td>
                        <td className="p-3.5 text-right border-r border-white/10 font-black">
                          {row.bid}
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full ${row.bg} ${row.color} font-black text-[9.5px] uppercase tracking-wider border ${row.border}`}
                          >
                            {row.label}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>

          {/* 3-Column Grid */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              {
                title: "Scan on every format",
                desc: "Extract 17-char VINs and condition details from PDF, CSV, and Excel tables.",
                icon: <FileSpreadsheet className="h-10 w-10 text-[#5A5AFF]" />,
              },
              {
                title: "Printable lane sheets",
                desc: "Export clean, sorted lane strategizer grids to print or use on the move. Keep target bid bounds at your fingertips.",
                icon: <Activity className="h-10 w-10 text-[#5A5AFF]" />,
              },
              {
                title: "Benchmark live comps",
                desc: "Automatically overlay local dealer metrics. Reach hundreds of retail comparables in your mileage radius.",
                icon: <Globe className="h-10 w-10 text-[#5A5AFF]" />,
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={staggerItem}
                whileHover={{ y: -5 }}
                className="relative rounded-2xl overflow-hidden flex flex-col justify-between border-t border-white/10 bg-[#070d19] p-6 shadow-card min-h-[280px] group"
              >
                <div className="absolute inset-0 z-0 bg-[radial-gradient(#1e3a8a,#020813_70%)] opacity-20 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#5A5AFF]/0 group-hover:from-[#5A5AFF]/5 to-transparent transition-all duration-500 pointer-events-none z-0" />
                <div className="relative z-10 flex-grow flex items-center justify-center min-h-[140px] bg-black/30 rounded-xl border border-white/5 mb-6">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 3 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {card.icon}
                  </motion.div>
                </div>
                <div className="relative z-10">
                  <h4 className="text-base font-extrabold text-white mb-2">
                    {card.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════ SECTION 4: Marquee ════════════════ */}
      <section
        className="bg-[#070d19] border-y border-white/10 py-16 relative z-10 overflow-hidden"
        data-section-name="local-and-global"
      >
        <FloatingOrb
          className="w-[400px] h-[400px] bg-[#5A5AFF]/5 blur-[120px] top-[-50%] left-[20%]"
          delay={5}
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="max-w-[1200px] mx-auto px-6 mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#5A5AFF] flex items-center gap-1.5 mb-2">
              <Activity className="h-3.5 w-3.5 text-[#5A5AFF]" /> Compatibility
              Engine
            </span>
            <h3 className="text-3xl font-extrabold text-white">
              Buy locally or scan nationwide
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-semibold max-w-sm leading-relaxed">
            LogicLot takes the complexity out of auto bidding, from checking
            salvage damage to calculating target profit margins automatically.
          </span>
        </motion.div>

        <div className="w-full overflow-hidden relative py-5 bg-[#020813]/40 mb-10">
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#070d19] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#070d19] to-transparent z-10 pointer-events-none" />
          <div className="animate-marquee gap-8 md:gap-12 flex">
            {[...MARQUEE_BRANDS, ...MARQUEE_BRANDS].map((brand, i) => (
              <motion.div
                key={i}
                whileHover={{
                  scale: 1.04,
                  borderColor: "rgba(90,90,255,0.35)",
                  backgroundColor: "rgba(7,13,25,0.9)",
                }}
                className="flex items-center gap-4 px-5 py-3 bg-[#070d19]/80 rounded-2xl border border-white/5 shadow-sm hover:shadow-md transition-all duration-300 min-w-[260px] cursor-default group"
              >
                {brand.logo ? (
                  <div className="w-14 h-10 rounded-xl bg-white flex items-center justify-center p-1 shrink-0 overflow-hidden border border-white/10 shadow-inner">
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.08]"
                    />
                  </div>
                ) : (
                  <div
                    className={`w-14 h-10 rounded-xl bg-gradient-to-br ${brand.color} flex items-center justify-center text-white font-black text-[11px] shrink-0 tracking-wider shadow-inner`}
                  >
                    {brand.initials}
                  </div>
                )}
                <div className="flex flex-col text-left justify-center min-w-0">
                  <span className="font-black text-white text-xs tracking-wider block truncate whitespace-nowrap">
                    {brand.name}
                  </span>
                  <span className="text-[7.5px] uppercase text-[#5A5AFF] font-bold tracking-widest mt-0.5 block">
                    COMPATIBLE
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scaleIn}
            className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#5A5AFF]/5 rounded-full blur-2xl pointer-events-none" />
            <div className="max-w-xl relative z-10">
              <h4 className="text-lg font-bold text-white mb-2">
                Benchmark across markets
              </h4>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                Source vehicles nationwide. LogicLot automatically synchronizes
                title checks, odometer damage, damage loss factors, and regional
                auction fees to lock down accurate ceiling bids.
              </p>
            </div>
            <Link to="/get-started" className="relative z-10">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 bg-[#5A5AFF] hover:bg-[#4646ff] text-white px-6 py-3 rounded-full font-bold transition-colors shadow-md shadow-[#5A5AFF]/20"
              >
                Configure Markets <Globe className="h-4 w-4" />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ SECTION 5: For Everyone ════════════════ */}
      <section
        id="pricing"
        className="py-24 bg-[#020813] relative overflow-hidden"
        data-section-name="for-everyone"
      >
        <FloatingOrb
          className="w-[500px] h-[500px] bg-[#5A5AFF]/5 blur-[130px] bottom-[0%] right-[-10%]"
          delay={7}
        />

        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="pb-16 text-center max-w-2xl mx-auto"
          >
            <Badge className="bg-[#5A5AFF]/15 text-[#5A5AFF] border-none px-3.5 py-1 text-xs font-bold rounded-full mb-3">
              SCALABLE WORKFLOWS
            </Badge>
            <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
              For anyone from independent lots to enterprise
            </h3>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
          >
            {[
              {
                icon: <Zap className="h-8 w-8 text-[#5A5AFF]" />,
                title: "Get started fast",
                desc: (
                  <>
                    Sarah Miller launched <strong>Miller Auto Sales</strong> out
                    of a single local lot. Now LogicLot automates 100% of their
                    run list parsing.
                  </>
                ),
                accent: "#5A5AFF",
              },
              {
                icon: <TrendingUp className="h-8 w-8 text-[#5A5AFF]" />,
                title: "Grow as big as you want",
                desc: (
                  <>
                    <strong>Apex Auto Group</strong> grew from a small
                    neighborhood dealer into a massive multi-state dealership
                    network.
                  </>
                ),
                accent: "#5A5AFF",
              },
              {
                icon: <Layers className="h-8 w-8 text-[#5A5AFF]" />,
                title: "Raise the bar",
                desc: (
                  <>
                    Enterprise groups parse and bid concurrently across all
                    major auto auctions. All powered by{" "}
                    <strong>LogicLot</strong>.
                  </>
                ),
                accent: "#5A5AFF",
              },
            ].map((col, i) => (
              <motion.div
                key={i}
                variants={staggerItem}
                whileHover={{ y: -5 }}
                className="border border-white/10 bg-[#070d19]/50 rounded-2xl p-6 flex flex-col justify-between min-h-[320px] group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#5A5AFF]/0 group-hover:from-[#5A5AFF]/4 to-transparent transition-all duration-500 pointer-events-none" />
                <div className="h-28 rounded-xl bg-gradient-to-br from-blue-950/20 to-[#020813] mb-6 flex items-center justify-center border border-white/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(90,90,255,0.12),transparent)]" />
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    className="relative z-10"
                  >
                    {col.icon}
                  </motion.div>
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white mb-2">
                    {col.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    {col.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center"
          >
            <Link to="/get-started">
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-3.5 rounded-full font-bold transition-all"
              >
                Pick a plan that fits
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ SECTION 6: Calculator ════════════════ */}
      <section
        className="py-24 bg-gradient-to-b from-[#1E293B] from-[10.5%] to-[#020813] text-white relative overflow-hidden border-t border-white/10"
        data-section-name="sidekick"
      >
        <FloatingOrb
          className="w-[450px] h-[450px] bg-blue-600/10 blur-[130px] top-[20%] right-[-10%]"
          delay={2}
        />
        <FloatingOrb
          className="w-[300px] h-[300px] bg-[#5A5AFF]/8 blur-[100px] bottom-[10%] left-[-5%]"
          delay={9}
        />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="max-w-3xl mx-auto text-center mb-16"
          >
            <Badge className="bg-white/10 text-white border-white/20 border px-3.5 py-1 text-xs font-bold rounded-full mb-3">
              MARGIN PROTECTION
            </Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
              Real-Time Bid & Margin Calculator
            </h2>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed font-semibold">
              Select a vehicle, toggle history-report flags, and customize your
              profit margin to see how LogicLot calculates the Recommended Max
              Bid dynamically.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Left Column - Inputs */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeInLeft}
              className="lg:col-span-5 flex flex-col gap-6"
            >
              {/* Vehicle Selection */}
              <div className="space-y-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  1. Select Vehicle
                </span>
                <div className="flex flex-col gap-2">
                  {CAR_DATA.map((car) => (
                    <motion.button
                      key={car.id}
                      onClick={() => setSelectedCar(car)}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center justify-between w-full p-4 rounded-2xl border transition-all duration-300 font-medium group ${
                        selectedCar.id === car.id
                          ? "bg-[#5A5AFF] text-white border-[#5A5AFF] shadow-lg shadow-[#5A5AFF]/25 translate-x-1.5"
                          : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-bold">{car.name}</span>
                        <span className="text-[10px] opacity-75 mt-1 font-semibold">
                          {car.specs.split("•").slice(1).join("•").trim()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          className={`font-extrabold text-[10px] transition-colors border-none ${selectedCar.id === car.id ? "bg-white/25 text-white" : "bg-[#5A5AFF]/15 text-[#5A5AFF]"}`}
                        >
                          {car.specs.split("•")[0].trim()}
                        </Badge>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${selectedCar.id === car.id ? "translate-x-1" : "opacity-40 group-hover:opacity-100"}`}
                        />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* History-Report Flags Checkboxes */}
              <div className="space-y-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  2. Apply History-Report Flags
                </span>
                <div className="grid grid-cols-1 gap-2.5">
                  {HISTORY_FLAGS.map((flag) => {
                    const isChecked = selectedFlags.includes(flag.id);
                    return (
                      <label
                        key={flag.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                          isChecked
                            ? "border-[#5A5AFF] bg-[#5A5AFF]/15 text-white shadow-md shadow-[#5A5AFF]/5"
                            : "border-white/5 bg-white/5 text-slate-400 hover:border-white/15 hover:text-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFlag(flag.id)}
                          className="mt-0.5 rounded border-white/20 bg-transparent text-[#5A5AFF] focus:ring-[#5A5AFF]/30 accent-[#5A5AFF] cursor-pointer"
                        />
                        <div className="flex flex-col text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">
                              {flag.label}
                            </span>
                            <Badge className="bg-red-950/40 text-red-400 border border-red-500/10 text-[9px] font-black px-1.5 py-0">
                              {Math.round(flag.penalty * 100)}%
                            </Badge>
                          </div>
                          <span className="text-[10px] opacity-75 mt-0.5 leading-relaxed">
                            {flag.desc}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Right Column - Results */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeInRight}
              className="lg:col-span-7 flex flex-col justify-between gap-6"
            >
              <div className="relative h-44 flex items-center justify-center p-4 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm overflow-hidden group">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(90,90,255,0.08),transparent)] pointer-events-none" />
                <div className="absolute top-4 left-4 z-10">
                  <Badge className="bg-white/10 text-slate-100 border-white/10 font-bold text-[10px]">
                    {selectedCar.specs}
                  </Badge>
                </div>
                <div className="w-full h-full max-h-32 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity transform group-hover:scale-[1.03] duration-500">
                  <img
                    src={selectedCar.image}
                    alt={selectedCar.name}
                    className="w-60 h-32 object-contain rounded-xl"
                  />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-5 backdrop-blur-md flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h4 className="text-sm font-black tracking-wide text-slate-200 flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-[#5A5AFF]" />{" "}
                      Recommended Bid Calculation
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Dealer Pricing Formula
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs font-semibold">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">
                        Est. Retail Comp Average
                      </span>
                      <span className="text-white font-extrabold">
                        ${selectedCar.retail.toLocaleString()}
                      </span>
                    </div>

                    {/* History flag penalties display */}
                    <div className="space-y-2 border-b border-white/5 pb-3">
                      <div className="flex justify-between text-slate-450">
                        <span>History Adjustments</span>
                        <span>
                          {selectedFlags.length === 0
                            ? "Clean History (0%)"
                            : `${Math.round(totalPenaltyRate * 100)}%`}
                        </span>
                      </div>
                      {selectedFlags.map((flagId) => {
                        const flag = HISTORY_FLAGS.find((f) => f.id === flagId);
                        if (!flag) return null;
                        const flagPenaltyVal = Math.round(
                          selectedCar.retail * flag.penalty,
                        );
                        return (
                          <div
                            key={flagId}
                            className="flex justify-between text-red-400 pl-4 text-[11px]"
                          >
                            <span>
                              − {flag.label} ({Math.round(flag.penalty * 100)}%)
                            </span>
                            <span>
                              -${Math.abs(flagPenaltyVal).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                      {totalPenaltyRate < -0.6 && (
                        <div className="text-[10px] text-amber-400 bg-amber-950/20 border border-amber-500/10 rounded px-2.5 py-1 mt-1">
                          ⚠ Stacked penalty of{" "}
                          {Math.round(totalPenaltyRate * 100)}% capped at -60%
                          maximum safety threshold.
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between py-1 border-b border-white/5 text-slate-200 font-bold">
                      <span>Adjusted Retail Value</span>
                      <span>${adjustedRetail.toLocaleString()}</span>
                    </div>

                    {/* Profit Margin slider */}
                    <div className="space-y-2 py-1 border-b border-white/5">
                      <div className="flex justify-between text-red-400">
                        <span>− Dealer Profit Margin Reserve</span>
                        <span className="font-bold">
                          -${targetProfit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 pl-4 pt-1">
                        <input
                          type="range"
                          min="1000"
                          max="8000"
                          step="250"
                          value={targetProfit}
                          onChange={(e) =>
                            setTargetProfit(Number(e.target.value))
                          }
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#5A5AFF] focus:outline-none focus:ring-1 focus:ring-[#5A5AFF]"
                        />
                        <span className="text-[10px] text-slate-450 whitespace-nowrap">
                          Adj. target profit
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1 border-b border-white/5 text-red-400">
                      <span>− Est. Vehicle Reconditioning</span>
                      <span className="font-bold">
                        -${selectedCar.recon.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-white/5 text-red-400">
                      <span>− Est. Auction Buyer Fee</span>
                      <span className="font-bold">
                        -${selectedCar.fee.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedCar.id + animatedMaxBid + targetProfit}
                    className="flex justify-between py-4 border-t border-white/20 items-center font-black mt-4 bg-[#5A5AFF]/10 rounded-2xl px-4"
                  >
                    <div className="text-sm">
                      <span className="text-slate-300 block text-[9.5px] uppercase tracking-widest font-black">
                        Target Bid Ceiling
                      </span>
                      <span className="text-white font-bold text-base block">
                        Recommended Max Bid
                      </span>
                    </div>
                    <span className="text-2xl md:text-3xl text-[#5A5AFF] font-black tracking-tight">
                      ${animatedMaxBid.toLocaleString()}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════ SECTION 9: "No better place" ════════════════ */}
      <section
        className="py-24 bg-[#070d19] border-y border-white/10 relative z-10 overflow-hidden"
        data-section-name="no-better-place"
      >
        <FloatingOrb
          className="w-[600px] h-[300px] bg-[#5A5AFF]/6 blur-[120px] top-[0%] left-[20%]"
          delay={1}
        />

        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            There's no better place for you to source
          </motion.h2>
        </div>
      </section>

      {/* ════════════════ SECTION 10: Stats ════════════════ */}
      <section
        className="py-24 bg-[#070d19] text-white relative overflow-hidden border-b border-white/10"
        data-section-name="checkout-stats"
      >
        <FloatingOrb
          className="w-[400px] h-[400px] bg-blue-600/6 blur-[100px] top-[10%] right-[-5%]"
          delay={6}
        />

        <div className="max-w-[1200px] mx-auto px-6 relative z-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
          >
            <div className="lg:col-span-5 space-y-6">
              <h3 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                The industry's most accurate parsing engine
              </h3>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed font-semibold">
                LogicLot with Universal Parser and check-digit validation
                compiles wholesale listings up to 10x faster than manual
                spreadsheets and exposes target profits instantly.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-2 gap-6 md:gap-8 border-l border-white/5 pl-0 md:pl-10">
              <div className="border-t border-[#5A5AFF]/40 pt-4">
                <span className="text-[10px] uppercase font-bold text-[#5A5AFF] tracking-wider block">
                  VIN Accuracy
                </span>
                <span
                  ref={counter1.ref}
                  className="text-3xl md:text-4xl font-black text-white block mt-2"
                >
                  {counter1.count}%
                </span>
                <span className="text-xs text-slate-400 font-medium block mt-1">
                  Check-digit validated VIN lists
                </span>
              </div>
              <div className="border-t border-[#5A5AFF]/40 pt-4">
                <span className="text-[10px] uppercase font-bold text-[#5A5AFF] tracking-wider block">
                  Screening Speed
                </span>
                <span
                  ref={counter2.ref}
                  className="text-3xl md:text-4xl font-black text-white block mt-2"
                >
                  {counter2.count}x
                </span>
                <span className="text-xs text-slate-400 font-medium block mt-1">
                  Faster than manual spreadsheets
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ SECTION 11: Rock Steady ════════════════ */}
      <section
        className="py-24 bg-[#020813] border-t border-white/10 relative overflow-hidden"
        data-section-name="rock-steady"
      >
        <FloatingOrb
          className="w-[350px] h-[350px] bg-[#5A5AFF]/6 blur-[100px] top-[20%] left-[-5%]"
          delay={8}
        />

        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeInLeft} className="space-y-6">
              <h3 className="text-3xl font-extrabold text-white">
                Rock steady. Blazing fast.
              </h3>
              <p className="text-slate-450 text-sm md:text-base leading-relaxed font-semibold">
                LogicLot's serverless runners parse multi-page documents
                concurrently. Real-time comp lists cache automatically inside a
                cached radius layer, ensuring lane metrics update immediately
                without lagging.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInRight}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-bold"
            >
              {[
                {
                  title: "Concurrency",
                  desc: "Simultaneous multi-format lists parsing",
                  icon: <Server className="h-5 w-5 text-[#5A5AFF]" />,
                },
                {
                  title: "Redundancy",
                  desc: "Supabase stored fallback MMR equations",
                  icon: <Database className="h-5 w-5 text-[#5A5AFF]" />,
                },
                {
                  title: "Edge Network",
                  desc: "Global CDN-backed serverless runners",
                  icon: <Globe className="h-5 w-5 text-[#5A5AFF]" />,
                },
                {
                  title: "Uptime",
                  desc: "99.9% SLA for enterprise-grade parsing",
                  icon: <Shield className="h-5 w-5 text-[#5A5AFF]" />,
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -4, borderColor: "rgba(90,90,255,0.25)" }}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-white text-xs">{item.title}</span>
                  </div>
                  <span className="text-[#5A5AFF] text-xs">{item.desc}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ SECTION 12: Conversion Steps ════════════════ */}
      <section
        className="py-24 bg-gradient-to-b from-[#0f1d3a] to-[#020813] border-t border-white/10 relative overflow-hidden"
        data-section-name="conversion"
      >
        <FloatingOrb
          className="w-[500px] h-[500px] bg-[#5A5AFF]/6 blur-[130px] top-[10%] right-[-10%]"
          delay={0}
        />

        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
              Source fast on LogicLot
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={scaleIn}
              className="lg:col-span-5 h-[340px] rounded-2xl overflow-hidden relative border border-white/10 bg-black/45 flex items-center justify-center"
            >
              <div className="absolute inset-0 z-0 bg-[radial-gradient(#1e3a8a,#020813_80%)] opacity-20 pointer-events-none" />
              <AnimatePresence mode="wait">
                {[
                  {
                    key: "step0",
                    icon: <Upload className="h-8 w-8" />,
                    title: "Parser Console Preview",
                    desc: "Drop wholesale run sheets inside the upload box. The backend immediately matches text boxes and maps headers.",
                    color: "bg-[#5A5AFF]/15 text-[#5A5AFF] border-[#5A5AFF]/25",
                  },
                  {
                    key: "step1",
                    icon: <Settings className="h-8 w-8" />,
                    title: "Margin Calibrator Slider",
                    desc: "Adjust your target profits per car, mileage ceiling limits, and localized reconditioning estimates to secure bid margins.",
                    color: "bg-[#5A5AFF]/15 text-[#5A5AFF] border-[#5A5AFF]/25",
                  },
                  {
                    key: "step2",
                    icon: <CheckCircle className="h-8 w-8" />,
                    title: "Interactive Lane Guides",
                    desc: "Export compiled bidding books sorted chronologically by auction runs. Access interactive counters on your phone.",
                    color: "bg-[#5A5AFF]/15 text-[#5A5AFF] border-[#5A5AFF]/25",
                  },
                ]
                  .filter((_, i) => i === activeStep)
                  .map((step) => (
                    <motion.div
                      key={step.key}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      className="p-6 text-center space-y-4 relative z-10 w-full"
                    >
                      <div
                        className={`inline-flex items-center justify-center p-4 rounded-2xl border ${step.color}`}
                      >
                        {step.icon}
                      </div>
                      <h4 className="font-extrabold text-sm text-white">
                        {step.title}
                      </h4>
                      <p className="text-xs text-slate-400 font-semibold leading-relaxed max-w-xs mx-auto">
                        {step.desc}
                      </p>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInRight}
              className="lg:col-span-7 space-y-4"
            >
              {[
                {
                  step: "01",
                  title: "Upload your run lists",
                  desc: "Drop PDF or CSV wholesale run lists from Manheim, ADESA, CarMax, or IAA.",
                },
                {
                  step: "02",
                  title: "Calibrate margin requirements",
                  desc: "Specify target profit per vehicle, reconditioning caps, and maximum mileage limits.",
                },
                {
                  step: "03",
                  title: "Export bidding guides",
                  desc: "Download lane strategic grids ordered chronologically by lane and run numbers.",
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  onMouseEnter={() => setActiveStep(idx)}
                  whileHover={{ x: 4 }}
                  className={`p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${activeStep === idx ? "border-[#5A5AFF]/30 bg-white/5" : "border-transparent hover:bg-white/3"}`}
                >
                  <div className="flex gap-4">
                    <span
                      className={`text-base font-black tracking-widest ${activeStep === idx ? "text-[#5A5AFF]" : "text-slate-500"}`}
                    >
                      {item.step}
                    </span>
                    <div>
                      <h4 className="text-base font-extrabold text-white mb-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}

              <div className="pt-6">
                <Link to="/get-started">
                  <motion.button
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 bg-[#5A5AFF] hover:bg-[#4646ff] text-white px-10 py-5 rounded-full font-bold transition-colors shadow-xl shadow-[#5A5AFF]/25 text-base"
                  >
                    Take your shot <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════ SECTION 13: FAQ ════════════════ */}
      <section
        className="py-24 bg-[#020813] border-t border-white/10 relative overflow-hidden"
        id="faq"
      >
        <FloatingOrb
          className="w-[400px] h-[400px] bg-[#5A5AFF]/5 blur-[120px] top-[30%] right-[-5%]"
          delay={5}
        />

        <div className="max-w-[800px] mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16 flex flex-col items-center"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: 10 }}
              className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#5A5AFF] mb-3"
            >
              <HelpCircle className="h-5 w-5" />
            </motion.div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400 font-semibold text-sm">
              Everything you need to know about setting up and analyzing your
              run lists.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <Accordion type="single" collapsible className="w-full space-y-4">
              {[
                {
                  value: "faq-1",
                  q: "Which auction platforms do you support?",
                  a: "We support run lists from all major wholesale auction networks, including Manheim, ADESA, CarMax, and IAA. You can drop PDF, CSV, or Excel lists directly into the dashboard.",
                },
                {
                  value: "faq-2",
                  q: "How does the fallback pricing engine work?",
                  a: "If live MarketCheck API comparables are not available (e.g. because your monthly quota is exhausted or a VIN fails matching), LogicLot automatically falls back to either wholesale MMR-based pricing math (applying a calibrated tier-based markup) or segment-based estimates matching your target vehicle's age, make, and type.",
                },
                {
                  value: "faq-3",
                  q: "Can I customize recon and profit thresholds?",
                  a: "Yes! You can set your custom target profit margins, max recon tolerances, mileage limits, and brand preferences. The engine automatically recalculates and scores the entire run list based on your custom dealer profile.",
                },
                {
                  value: "faq-4",
                  q: "How does the Lane Strategy tool work on auction day?",
                  a: "Once you build your buy list, you can compile it into a print-friendly Bidding Map ordered chronologically by lane and run number. As the bidding starts, you can track win/loss outcomes and real-time acquired margins right from your mobile device.",
                },
              ].map((faq, i) => (
                <motion.div key={faq.value} variants={staggerItem}>
                  <AccordionItem
                    value={faq.value}
                    className="bg-[#070d19] border border-white/10 rounded-2xl px-5 py-2.5 transition-all hover:border-[#5A5AFF]/20"
                  >
                    <AccordionTrigger className="text-base font-bold hover:text-[#5A5AFF] transition-colors py-3 text-white hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-400 leading-relaxed pt-2 pb-4 font-semibold text-sm">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      <HomeFooter />

      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md">
          <DialogHeader className="sr-only">
            <DialogTitle>Why We Build LogicLot</DialogTitle>
          </DialogHeader>
<<<<<<< HEAD
          <div className="relative aspect-video w-full flex items-center justify-center bg-black">
            <video
              src="/videos/launch.mp4"
              controls
              autoPlay
              className="w-full h-full object-contain"
=======
          <div className="relative aspect-video w-full">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/54o2bSRkaqA?autoplay=1"
              title="Why We Build LogicLot"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
>>>>>>> 0f1c1fd68be7d4bc4245db7eb0a6931748b74723
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
