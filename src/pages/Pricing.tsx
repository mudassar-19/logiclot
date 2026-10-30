import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, ArrowUpRight, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SiteHeader from "@/components/SiteHeader";
import MovingBackground from "@/components/MovingBackground";
import HomeFooter from "@/components/home/HomeFooter";

const tiers = [
  {
    name: "Independent",
    price: "$199",
    billing: "Billed monthly",
    allowance: "2 uploads / day",
    valueLine: "For small independent dealerships.",
    features: [
      "1 User account",
      "Check-digit VIN validation",
      "MarketCheck retail comp matching",
      "Chronological lane strategy",
      "Email support"
    ],
    cta: "Get Started",
    popular: false,
    gradient: "from-slate-900 to-slate-950"
  },
  {
    name: "Midsize",
    price: "$399",
    billing: "Billed monthly",
    allowance: "5 uploads / day",
    valueLine: "For growing midsize operations.",
    features: [
      "Up to 3 Users",
      "Check-digit VIN validation",
      "MarketCheck retail comp matching",
      "Chronological lane strategy",
      "Custom reconditioning rules",
      "Priority email support"
    ],
    cta: "Get Started",
    popular: true,
    gradient: "from-indigo-950/40 via-slate-950 to-indigo-950/20"
  },
  {
    name: "Franchise",
    price: "$799",
    billing: "Billed monthly",
    allowance: "Unlimited uploads",
    valueLine: "For multi-state franchise networks.",
    features: [
      "Unlimited Users",
      "Check-digit VIN validation",
      "MarketCheck retail comp matching",
      "Chronological lane strategy",
      "Custom reconditioning rules",
      "Dedicated account manager",
      "24/7 Phone & Email support"
    ],
    cta: "Get Started",
    popular: false,
    gradient: "from-slate-900 to-slate-950"
  }
];

const comparisonTable = [
  {
    feature: "Monthly Price",
    independent: "$199",
    midsize: "$399",
    franchise: "$799"
  },
  {
    feature: "Upload Allowance",
    independent: "2 run lists / day",
    midsize: "5 run lists / day",
    franchise: "Unlimited uploads"
  },
  {
    feature: "User Limits",
    independent: "1 User",
    midsize: "Up to 3 Users",
    franchise: "Unlimited Users"
  },
  {
    feature: "Wholesale Auctions supported",
    independent: true,
    midsize: true,
    franchise: true
  },
  {
    feature: "Universal PDF/CSV/Excel parser",
    independent: true,
    midsize: true,
    franchise: true
  },
  {
    feature: "Check-digit VIN validation",
    independent: true,
    midsize: true,
    franchise: true
  },
  {
    feature: "MarketCheck retail comp matching",
    independent: true,
    midsize: true,
    franchise: true
  },
  {
    feature: "Chronological lane strategy list",
    independent: true,
    midsize: true,
    franchise: true
  },
  {
    feature: "Custom reconditioning adjustment rules",
    independent: false,
    midsize: true,
    franchise: true
  },
  {
    feature: "Dedicated account manager",
    independent: false,
    midsize: false,
    franchise: true
  },
  {
    feature: "Support SLA",
    independent: "Email support (24h)",
    midsize: "Priority email (12h)",
    franchise: "24/7 Phone & Email (Instant)"
  }
];

const faqs = [
  { question: "Are there any hidden setup fees?", answer: "No. LogicLot does not charge setup fees. You can subscribe and begin uploading wholesale run lists immediately." },
  { question: "How does the daily upload limit work?", answer: "For the Independent and Midsize plans, your upload limit resets daily at midnight. For example, a Midsize account can process up to 5 individual wholesale sheets per calendar day." },
  { question: "Can we cancel our subscription at any time?", answer: "Yes. All LogicLot plans are billed month-to-month with no long-term contract lock-ins. You can upgrade, downgrade, or cancel directly from your Account settings at any time." }
];

const smoothEase = [0.16, 1, 0.3, 1] as const;

const Pricing = () => {
  return (
    <div className="min-h-screen bg-[#020813] text-white font-sans selection:bg-[#5A5AFF]/20 selection:text-[#5A5AFF] overflow-x-hidden relative">
      <MovingBackground />
      <SiteHeader />
      
      <main className="py-24 md:py-32 relative z-10">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: smoothEase }}
            className="text-center mb-20"
          >
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.08] mb-4 text-white">
              Flat, transparent pricing built for dealers
            </h1>
            <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto font-medium">
              Choose the tier that fits your lot size and scanning volume. No hidden fees, cancel anytime.
            </p>
          </motion.div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-28">
            {tiers.map((tier, idx) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1, ease: smoothEase }}
                className={`relative rounded-3xl p-8 border flex flex-col justify-between transition-all duration-300 bg-gradient-to-b ${tier.gradient} ${
                  tier.popular
                    ? "border-[#5A5AFF]/50 shadow-[0_0_30px_rgba(90,90,255,0.15)]"
                    : "border-white/10"
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#5A5AFF] text-slate-950 text-[10px] font-black tracking-wider uppercase">
                    MOST POPULAR
                  </span>
                )}

                <div>
                  <h3 className="text-xl font-extrabold text-white mb-1">{tier.name}</h3>
                  <p className="text-xs text-slate-400 font-semibold mb-6">{tier.valueLine}</p>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-black text-white">{tier.price}</span>
                    <span className="text-slate-400 text-xs font-semibold">/ month</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-black text-[#5A5AFF] bg-[#5A5AFF]/15 px-2.5 py-1 rounded-md inline-block mb-8">
                    {tier.allowance}
                  </span>

                  <ul className="space-y-4 mb-8">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-xs font-medium text-slate-300">
                        <Check className="h-4 w-4 text-[#5A5AFF] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link to="/get-started" className="w-full mt-4">
                  <button
                    className={`w-full py-3.5 rounded-full font-bold text-xs transition-all duration-300 flex items-center justify-center gap-1.5 ${
                      tier.popular
                        ? "bg-[#5A5AFF] hover:bg-[#4646ff] text-white shadow-lg shadow-[#5A5AFF]/20"
                        : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    }`}
                  >
                    {tier.cta} <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Comparison table */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: smoothEase }}
            className="max-w-4xl mx-auto mb-32 hidden md:block"
          >
            <h2 className="text-2xl font-extrabold text-white text-center mb-10">Compare Tier Features</h2>
            <div className="bg-[#070d19] border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-950/40 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4 w-1/3">Feature</th>
                    <th className="p-4 text-center">Independent</th>
                    <th className="p-4 text-center">Midsize</th>
                    <th className="p-4 text-center">Franchise</th>
                  </tr>
                </thead>
                <tbody className="font-semibold text-slate-300">
                  {comparisonTable.map((row, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="p-4 font-bold text-white">{row.feature}</td>
                      
                      {/* Independent column */}
                      <td className="p-4 text-center">
                        {typeof row.independent === "boolean" ? (
                          row.independent ? (
                            <Check className="h-4.5 w-4.5 text-[#5A5AFF] mx-auto" />
                          ) : (
                            <X className="h-4.5 w-4.5 text-slate-650 mx-auto" />
                          )
                        ) : (
                          <span className="text-slate-400">{row.independent}</span>
                        )}
                      </td>

                      {/* Midsize column */}
                      <td className="p-4 text-center">
                        {typeof row.midsize === "boolean" ? (
                          row.midsize ? (
                            <Check className="h-4.5 w-4.5 text-[#5A5AFF] mx-auto" />
                          ) : (
                            <X className="h-4.5 w-4.5 text-slate-650 mx-auto" />
                          )
                        ) : (
                          <span className="text-[#5A5AFF] font-bold">{row.midsize}</span>
                        )}
                      </td>

                      {/* Franchise column */}
                      <td className="p-4 text-center">
                        {typeof row.franchise === "boolean" ? (
                          row.franchise ? (
                            <Check className="h-4.5 w-4.5 text-[#5A5AFF] mx-auto" />
                          ) : (
                            <X className="h-4.5 w-4.5 text-slate-650 mx-auto" />
                          )
                        ) : (
                          <span className="text-[#5A5AFF] font-bold">{row.franchise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* FAQs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: smoothEase }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-2xl font-extrabold text-white text-center mb-10">Pricing FAQs</h2>
            <div className="grid gap-6">
              {faqs.map((faq) => (
                <Card key={faq.question} className="rounded-2xl bg-[#070d19] border border-white/10 p-6">
                  <CardHeader className="p-0 pb-3">
                    <CardTitle className="text-sm font-extrabold text-white flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-[#5A5AFF]" />
                      {faq.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-xs text-slate-400 leading-relaxed font-semibold">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
};

export default Pricing;
