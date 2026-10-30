import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, User, Menu, X, ArrowUpRight } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useActiveSection } from "@/hooks/useActiveSection";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const SiteHeader = () => {
  const { user, organization, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = useActiveSection();

  const [isScrolled, setIsScrolled] = useState(false);

  // Contact modal state
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [submittingContact, setSubmittingContact] = useState(false);

  // Monitor scroll height to make navbar transparent over the video hero
  useEffect(() => {
    if (location.pathname !== "/") {
      setIsScrolled(true);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Trigger initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  const isTransparent = location.pathname === "/" && !isScrolled;

  const scrollToSection = useCallback((sectionId: string) => {
    setMobileOpen(false);

    const doScroll = () => {
      if (sectionId === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const el = document.getElementById(sectionId);
      if (el) {
        const navHeight = 72;
        const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top, behavior: "smooth" });
      }
    };

    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(doScroll, 400);
    } else {
      doScroll();
    }
  }, [location.pathname, navigate]);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingContact(true);
    setTimeout(() => {
      toast.success("Message sent! We will contact you at " + contactEmail + " shortly.");
      setSubmittingContact(false);
      setContactOpen(false);
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setContactMessage("");
    }, 800);
  };

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 px-6 transition-all duration-300 ${
          isTransparent ? "py-5 bg-transparent border-b border-transparent" : "py-3 bg-[#020813]/90 backdrop-blur-xl border-b border-white/5 shadow-lg"
        }`}
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          {/* Left: Logo (no pill style) */}
          <button
            onClick={() => scrollToSection("top")}
            className="flex items-center gap-2.5 group flex-shrink-0"
          >
            <img src={logo} alt="LogicLot" className="h-8 w-8 transition-transform group-hover:scale-105" />
            <span className="font-heading font-bold text-xl tracking-tight text-white">
              Logic<span className="text-[#5A5AFF]">Lot</span>
            </span>
          </button>

          {/* Center: Nav links floating freely */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("top")}
              className={`text-[14px] font-bold transition-all duration-300 ${
                location.pathname === "/" && activeSection === "top" ? "text-[#5A5AFF]" : "text-slate-300 hover:text-white"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection("why-logiclot")}
              className={`text-[14px] font-bold transition-all duration-300 ${
                location.pathname === "/" && activeSection === "why-logiclot" ? "text-[#5A5AFF]" : "text-slate-300 hover:text-white"
              }`}
            >
              Why LogicLot
            </button>
            <Link
              to="/pricing"
              className={`text-[14px] font-bold transition-all duration-300 ${
                location.pathname === "/pricing" ? "text-[#5A5AFF]" : "text-slate-300 hover:text-white"
              }`}
            >
              Pricing
            </Link>
            <button
              onClick={() => setContactOpen(true)}
              className="text-[14px] font-bold text-slate-300 hover:text-white transition-all duration-300"
            >
              Contact
            </button>
          </nav>

          {/* Right: Auth / CTA standalone pill */}
          <div className="hidden md:flex items-center gap-4">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : user ? (
              <>
                <Link to="/account" className="px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 text-slate-300 hover:text-white">
                  <User className="h-4 w-4 text-[#5A5AFF]" />
                  Account
                </Link>
                <Link to={organization?.onboarding_completed ? "/app/dashboard" : "/get-started?step=2"}>
                  <button className="relative inline-flex items-center gap-2.5 pl-6 pr-2 py-2 rounded-full font-bold text-slate-200 bg-[#5A5AFF] hover:bg-[#4646ff] hover:shadow-[0_0_20px_rgba(54,244,164,0.35)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0">
                    {organization?.onboarding_completed ? "Dashboard" : "Continue"}
                    <span className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-950/15">
                      <ArrowUpRight className="h-4 w-4 text-slate-200" />
                    </span>
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth?tab=login" className="text-sm font-bold text-slate-350 hover:text-white transition-colors duration-200">
                  Sign In
                </Link>
                <Link to="/get-started">
                  <button className="relative inline-flex items-center gap-2.5 pl-6 pr-2 py-2 rounded-full font-bold text-slate-200 bg-[#5A5AFF] hover:bg-[#4646ff] hover:shadow-[0_0_20px_rgba(54,244,164,0.35)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0">
                    Get Started
                    <span className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-950/15">
                      <ArrowUpRight className="h-4 w-4 text-slate-200" />
                    </span>
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger toggle */}
          <button
            className="md:hidden p-2 -mr-2 transition-colors duration-300 text-white hover:text-slate-300"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mt-3 bg-[#020813]/98 backdrop-blur-xl border border-white/5 rounded-3xl px-6 py-5 flex flex-col gap-1 shadow-2xl"
            >
              <button
                className="text-left py-3 text-sm font-bold text-slate-300 hover:text-white border-b border-white/5"
                onClick={() => scrollToSection("top")}
              >
                Home
              </button>
              <button
                className="text-left py-3 text-sm font-bold text-slate-300 hover:text-white border-b border-white/5"
                onClick={() => scrollToSection("why-logiclot")}
              >
                Why LogicLot
              </button>
              <Link
                to="/pricing"
                className="text-left py-3 text-sm font-bold text-slate-300 hover:text-white border-b border-white/5 block"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </Link>
              <button
                className="text-left py-3 text-sm font-bold text-slate-300 hover:text-white border-b border-white/5"
                onClick={() => {
                  setMobileOpen(false);
                  setContactOpen(true);
                }}
              >
                Contact
              </button>

              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto mt-4" />
              ) : user ? (
                <>
                  <Link to="/account" className="flex items-center gap-1.5 text-sm py-3 text-slate-300 border-b border-white/5" onClick={() => setMobileOpen(false)}>
                    <User className="h-4 w-4 text-[#5A5AFF]" /> Account
                  </Link>
                  <Link to={organization?.onboarding_completed ? "/app/dashboard" : "/get-started?step=2"} onClick={() => setMobileOpen(false)}>
                    <Button size="sm" className="w-full rounded-full bg-[#5A5AFF] hover:bg-[#4646ff] text-slate-950 font-bold mt-4 h-11">
                      Dashboard
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/auth?tab=login"
                    className="text-left py-3 text-sm font-bold text-slate-300 hover:text-white border-b border-white/5 block"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link to="/get-started" onClick={() => setMobileOpen(false)}>
                    <Button size="sm" className="w-full rounded-full bg-[#5A5AFF] hover:bg-[#4646ff] text-slate-200 font-bold mt-4 h-11">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Contact Modal Pop-up */}
      <AnimatePresence>
        {contactOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setContactOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#070d19] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-md relative z-10 shadow-2xl"
            >
              <button
                onClick={() => setContactOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 text-left">
                <span className="text-xs text-[#5A5AFF] font-bold uppercase tracking-wider block">CONTACT US</span>
                <h3 className="text-xl font-bold text-white mt-1">Get in touch with LogicLot</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Fill out the form below and our team will get back to you shortly.
                </p>
              </div>

              <form onSubmit={handleContactSubmit} className="space-y-4 text-left">
                <div>
                  <label htmlFor="contact-name" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Full Name</label>
                  <input
                    type="text"
                    id="contact-name"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-[#020813] border border-white/10 focus:border-[#5A5AFF] focus:ring-1 focus:ring-[#5A5AFF] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Email Address</label>
                  <input
                    type="email"
                    id="contact-email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@dealership.com"
                    className="w-full bg-[#020813] border border-white/10 focus:border-[#5A5AFF] focus:ring-1 focus:ring-[#5A5AFF] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    id="contact-phone"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(512) 555-0199"
                    className="w-full bg-[#020813] border border-white/10 focus:border-[#5A5AFF] focus:ring-1 focus:ring-[#5A5AFF] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Message</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Tell us about your dealership inventory needs..."
                    className="w-full bg-[#020813] border border-white/10 focus:border-[#5A5AFF] focus:ring-1 focus:ring-[#5A5AFF] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingContact}
                  className="w-full bg-[#5A5AFF] hover:bg-[#4646ff] text-slate-200 font-bold py-3 rounded-full flex items-center justify-center transition-all duration-300 hover:shadow-lg hover:shadow-[#5A5AFF]/25 disabled:opacity-50 text-xs gap-1.5"
                >
                  {submittingContact ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SiteHeader;
