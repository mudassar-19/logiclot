import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, ArrowUpRight } from "lucide-react";

const smoothEase = [0.16, 1, 0.3, 1] as const;

const features = [
  "Unlimited auction run list uploads",
  "AI vehicle profit analysis",
  "Smart buy list generation",
  "Dealer preference filtering",
  "Condition report scoring insights",
  "AI bidding strategy builder",
  "Chronological lane strategy builder",
  "Printable lane strategies for auctions",
  "Unlimited dealership users",
];

const PricingSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="pricing" className="section-padding relative" ref={ref}>
      <div className="section-container">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: smoothEase }}
        >
          <h2 className="font-heading text-3xl md:text-[44px] font-bold tracking-[-0.02em] mb-4 leading-tight text-white">
            Simple, transparent pricing
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "hsl(220 30% 85%)" }}>
            One powerful tool to help dealers find profitable inventory faster.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Monthly */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: smoothEase }}
            className="landing-card-blue p-8"
          >
            <h3 className="font-heading text-xl font-semibold mb-1 text-primary-foreground">Monthly</h3>
            <p className="text-sm text-primary-foreground/60 mb-6">Billed monthly. Cancel anytime.</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-heading text-4xl font-bold text-primary-foreground">$199</span>
              <span className="text-primary-foreground/60">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary-foreground/70 flex-shrink-0" />
                  <span className="text-primary-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/get-started">
              <button className="w-full text-center justify-center inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground transition-all duration-300 hover:bg-primary-foreground/20 hover:-translate-y-0.5">
                Get Started
              </button>
            </Link>
          </motion.div>

          {/* Annual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2, ease: smoothEase }}
            className="landing-card-blue p-8 relative"
            style={{ boxShadow: "0 8px 40px -8px hsl(0 0% 100% / 0.1)" }}
          >
            <div className="absolute -top-3 right-6">
              <span className="bg-primary-foreground text-primary text-xs font-semibold px-3 py-1 rounded-full">Save 20%</span>
            </div>
            <h3 className="font-heading text-xl font-semibold mb-1 text-primary-foreground">Annual</h3>
            <p className="text-sm text-primary-foreground/60 mb-6">$1,910 billed annually</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-heading text-4xl font-bold text-primary-foreground">$159</span>
              <span className="text-primary-foreground/60">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary-foreground/70 flex-shrink-0" />
                  <span className="text-primary-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/get-started">
              <button className="w-full justify-center inline-flex items-center gap-3 pl-7 pr-2.5 py-2.5 rounded-full font-semibold bg-primary-foreground text-primary transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                Get Started
                <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10">
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </span>
              </button>
            </Link>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center text-sm mt-8"
          style={{ color: "hsl(220 30% 80%)" }}
        >
          One dealership license. Unlimited users. No hidden fees.
        </motion.p>
      </div>
    </section>
  );
};

export default PricingSection;
