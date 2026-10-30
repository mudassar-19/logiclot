import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, MapPin } from "lucide-react";

const smoothEase = [0.16, 1, 0.3, 1] as const;

const FileChip = ({ name }: { name: string }) => (
  <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground">
    <Upload className="h-3 w-3 text-primary-foreground/70" />
    {name}
  </div>
);

const TagPill = ({ label, variant }: { label: string; variant: "scale" | "fix" | "cut" }) => {
  const styles = {
    scale: "bg-primary-foreground/15 text-primary-foreground border-primary-foreground/20",
    fix: "bg-primary-foreground/10 text-primary-foreground/80 border-primary-foreground/15",
    cut: "bg-destructive/20 text-primary-foreground border-destructive/30",
  };
  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${styles[variant]}`}>
      {label}
    </span>
  );
};

const steps = [
  { num: "01", title: "Upload Your Auction Run List", desc: "Upload auction run lists from Manheim, ADESA, SmartAuction, and more. LogicLot automatically parses the file and extracts VIN, mileage, run order, lane information, and condition report scores.", visual: "upload" },
  { num: "02", title: "AI Finds Profitable Vehicles", desc: "LogicLot analyzes every vehicle using the dealership's buying preferences including price range, mileage limits, CR score requirements, preferred brands, and target profit. The AI estimates retail value, recon cost, expected profit, and recommends a max bid.", visual: "dashboard" },
  { num: "03", title: "Build Your Buy List", desc: "LogicLot filters thousands of vehicles into a buy list that matches the dealership's inventory strategy. Dealers can remove vehicles, adjust max bids, and prioritize opportunities.", visual: "actions" },
  { num: "04", title: "Follow Your Lane Strategy", desc: "LogicLot builds a chronological lane strategy showing dealers which lane to go to, what vehicle is coming up, recommended max bids, and estimated time between lanes. Dealers can follow the strategy while bidding in lane or online.", visual: "campaign" },
];

const StepVisual = ({ type }: { type: string }) => {
  switch (type) {
    case "upload":
      return (
        <div className="flex flex-col gap-1.5 mt-4">
          <FileChip name="Manheim_Run_List.csv" />
          <FileChip name="Dallas_Auction_RunList.xlsx" />
          <FileChip name="Tuesday_Lanes_RunList.csv" />
        </div>
      );
    case "dashboard":
      return (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[{ l: "Max Bid", v: "$17,200" }, { l: "Est Profit", v: "$3,900" }, { l: "CR Score", v: "4.2" }].map((d) => (
            <div key={d.l} className="rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-2 text-center">
              <div className="text-[10px] font-semibold uppercase text-primary-foreground/60">{d.l}</div>
              <div className="font-heading text-sm font-bold text-primary-foreground">{d.v}</div>
            </div>
          ))}
          <div className="col-span-3 mt-1">
            <svg viewBox="0 0 200 32" className="w-full" fill="none">
              <polyline points="0,28 33,22 66,15 100,18 133,8 166,12 200,5" stroke="hsl(210 100% 80%)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      );
    case "actions":
      return (
        <div className="flex flex-col gap-2 mt-4">
          <TagPill label="Strong Buy" variant="scale" />
          <TagPill label="High Demand" variant="fix" />
          <TagPill label="Verify Condition" variant="cut" />
        </div>
      );
    case "campaign":
      return (
        <div className="mt-4 rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary-foreground/10 flex items-center justify-center">
              <MapPin className="h-3 w-3 text-primary-foreground/70" />
            </div>
            <span className="text-[11px] font-bold text-primary-foreground">Lane 2 — Run 184</span>
          </div>
          <div className="rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-2 text-[12px] font-semibold text-primary-foreground">
            2021 Toyota Camry
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-primary-foreground">Max Bid $17,200</span>
            <span className="text-[10px] text-primary-foreground/60">Starts in 4 minutes</span>
          </div>
        </div>
      );
    default:
      return null;
  }
};

const HowItWorksStandalone = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} id="how-it-works" className="section-padding">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: smoothEase }}>
          <h2 className="font-heading text-3xl md:text-[42px] font-extrabold tracking-[-0.02em] leading-tight text-white">
            How LogicLot Works
          </h2>
          <p className="mt-3 text-base md:text-lg font-medium max-w-xl mx-auto" style={{ color: "hsl(220 30% 85%)" }}>
            From auction run lists to profitable buying decisions — in seconds, not hours.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
          <motion.div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px" style={{ background: "hsl(224 100% 52% / 0.2)" }} initial={{ scaleX: 0 }} animate={isInView ? { scaleX: 1 } : {}} transition={{ duration: 1, delay: 0.3, ease: smoothEase }} />
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 36 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: smoothEase }}
              className="landing-card-blue p-5 relative"
            >
              <div
                className="h-10 w-10 rounded-xl bg-primary-foreground text-primary font-heading text-sm font-bold flex items-center justify-center mb-4 relative z-10"
                style={{ boxShadow: "0 4px 12px -2px hsl(0 0% 100% / 0.15)" }}
              >
                {step.num}
              </div>
              <h3 className="font-heading text-base font-bold tracking-tight mb-2 text-primary-foreground">{step.title}</h3>
              <p className="text-[13px] leading-relaxed font-medium text-primary-foreground/70">{step.desc}</p>
              <StepVisual type={step.visual} />
            </motion.div>
          ))}
        </div>

        <motion.p className="text-center mt-10 font-heading text-base md:text-lg font-bold max-w-3xl mx-auto text-white" initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.6, ease: smoothEase }}>
          Don't let great deals get buried in long, complex run lists. LogicLot surfaces the best opportunities and builds your bidding strategy instantly.
        </motion.p>

        <motion.div className="flex flex-wrap items-center justify-center gap-4 mt-8" initial={{ opacity: 0, y: 16 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.7, ease: smoothEase }}>
          <Link to="/get-started"><Button size="lg" className="gap-2 shadow-glow">Get Started Today<ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/contact" className="text-sm font-semibold text-primary-foreground hover:underline underline-offset-4 transition-colors">Contact Sales</Link>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksStandalone;
