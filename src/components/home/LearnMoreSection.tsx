import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const smoothEase = [0.16, 1, 0.3, 1] as const;

const LearnMoreSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} id="learn-more" className="section-padding">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.div
          className="landing-card-blue px-6 py-12 md:px-12 md:py-16 relative overflow-hidden"
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
          <div className="max-w-3xl mx-auto relative z-10">
            <span
              className="font-heading text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "hsl(224 100% 82%)" }}
            >
              About LogicLot
            </span>

            <h2
              className="font-heading text-2xl md:text-[34px] font-extrabold tracking-[-0.02em] leading-[1.2] mt-4 mb-6"
              style={{ color: "hsl(0 0% 100%)" }}
            >
              Built by Dealers, for Dealers
            </h2>

            <div
              className="space-y-4 text-[15px] md:text-base leading-relaxed font-medium"
              style={{ color: "hsl(224 100% 92%)" }}
            >
              <p>
                Buying inventory at auction has become one of the most
                time-consuming parts of running a dealership. Every week, dealers
                sift through massive run lists, jumping between lanes, condition
                reports, and pricing data trying to identify the few vehicles
                that are actually worth buying.
              </p>
              <p>
                Great opportunities are often buried in thousands of listings —
                and missing the right cars can mean missing thousands in
                potential profit.
              </p>
              <p className="font-bold" style={{ color: "hsl(0 0% 100%)" }}>
                LogicLot was built by dealers who understand this challenge
                firsthand.
              </p>
              <p>
                Our platform helps dealerships across the country analyze auction
                run lists in seconds, surface the most profitable vehicles, and
                build a clear bidding strategy before the auction even starts.
              </p>
              <p>
                By combining dealer expertise with AI-powered analysis, LogicLot
                makes it easy to filter massive run lists, prioritize the best
                inventory opportunities, and follow a structured bidding plan
                during the auction.
              </p>
              <p className="font-bold" style={{ color: "hsl(0 0% 100%)" }}>
                With LogicLot, dealers spend less time searching through
                spreadsheets and more time focusing on what matters: buying the
                right cars.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-6">
              <Link to="/get-started">
                <Button
                  size="lg"
                  className="gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg"
                >
                  Get Started Today
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link
                to="/demo"
                className="text-sm font-semibold hover:underline underline-offset-4 transition-colors"
                style={{ color: "hsl(224 100% 82%)" }}
              >
                View Demo Dashboard →
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LearnMoreSection;
