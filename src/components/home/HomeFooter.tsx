import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, Github, Twitter, Linkedin, ExternalLink, Instagram, Facebook } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const HomeFooter = () => {
  const [email, setEmail] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    toast.success("Subscribed! We'll send you sourcing tips and list hacks weekly.");
    setEmail("");
  };

  return (
    <footer id="contact" className="bg-[#020813] border-t border-white/5 pt-20 pb-12 text-slate-300 relative z-20">
      <div className="max-w-[1200px] mx-auto px-6">
        
        {/* Top Section: Newsletter Sign-up */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-12 border-b border-white/5 mb-16 gap-8">
          <div className="max-w-md">
            <h4 className="text-lg font-bold text-white mb-2">Sign up for sourcing tips & list hacks</h4>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed">
              Get weekly strategies, updates on local comp radiuses, and wholesale parsing tips delivered to your inbox.
            </p>
          </div>
          <form onSubmit={handleSubscribe} className="w-full lg:w-auto flex items-center gap-2">
            <input 
              type="email" 
              placeholder="Enter your email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#5A5AFF] focus:ring-1 focus:ring-[#5A5AFF] rounded-full px-5 py-3 text-sm text-white placeholder:text-slate-500 outline-none w-full lg:w-80 transition-all"
              required
            />
            <button 
              type="submit" 
              className="bg-[#5A5AFF] hover:bg-[#4646ff] text-white p-3 rounded-full flex items-center justify-center transition-all flex-shrink-0"
              aria-label="Subscribe"
            >
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
          </form>
        </div>

        {/* Middle Section: 4-Column Directory Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          {/* Column 1: Platform */}
          <div>
            <h4 className="text-xs font-black uppercase text-white tracking-widest mb-6">Platform</h4>
            <ul className="space-y-3.5 text-xs font-semibold">
              <li><Link to="/get-started" className="hover:text-[#5A5AFF] transition-colors">Universal Parser</Link></li>
              <li><Link to="/get-started" className="hover:text-[#5A5AFF] transition-colors">Dynamic Buy Lists</Link></li>
              <li><Link to="/get-started" className="hover:text-[#5A5AFF] transition-colors">Bidding Lanes Companion</Link></li>
              <li><Link to="/get-started" className="hover:text-[#5A5AFF] transition-colors">MMR Fallback Math</Link></li>
              <li><Link to="/get-started" className="hover:text-[#5A5AFF] transition-colors">Dealership Dashboard</Link></li>
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div>
            <h4 className="text-xs font-black uppercase text-white tracking-widest mb-6">Resources</h4>
            <ul className="space-y-3.5 text-xs font-semibold">
              <li><a href="https://logiclot.dev" target="_blank" rel="noopener noreferrer" className="hover:text-[#5A5AFF] transition-colors inline-flex items-center gap-1">API Documentation <ExternalLink className="h-3 w-3" /></a></li>
              <li><Link to="/pricing" className="hover:text-[#5A5AFF] transition-colors">Pricing Options</Link></li>
              <li><Link to="/learn-more" className="hover:text-[#5A5AFF] transition-colors">How Sourcing Works</Link></li>
              <li><a href="#faq" className="hover:text-[#5A5AFF] transition-colors">Support FAQs</a></li>
              <li><Link to="/demo" className="hover:text-[#5A5AFF] transition-colors">Interactive Demo</Link></li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h4 className="text-xs font-black uppercase text-white tracking-widest mb-6">Company</h4>
            <ul className="space-y-3.5 text-xs font-semibold">
              <li><Link to="/learn-more" className="hover:text-[#5A5AFF] transition-colors">About LogicLot</Link></li>
              <li><a href="mailto:info@logiclot.ai" className="hover:text-[#5A5AFF] transition-colors">Contact Support</a></li>
              <li><span className="text-slate-500 cursor-default">Careers (We're hiring!)</span></li>
              <li><span className="text-slate-500 cursor-default">Press Kit</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase text-white tracking-widest mb-6">Direct Sourcing</h4>
            <ul className="space-y-3.5 text-xs font-semibold text-slate-400 leading-normal">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#5A5AFF] flex-shrink-0" />
                <a href="mailto:info@logiclot.ai" className="hover:text-white transition-colors">info@logiclot.ai</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section: Branding, Copyright & Socials */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-10 border-t border-white/5 gap-6 text-xs text-slate-500 font-semibold">
          <div className="flex items-center gap-3">
            <img src={logo} alt="LogicLot" className="h-7 w-7 opacity-80" />
            <span className="text-white font-heading font-extrabold text-xl tracking-tight">
              Logic<span className="text-[#5A5AFF]">Lot</span>
            </span>
            <span className="ml-2 font-normal">© {new Date().getFullYear()} LogicLot Inc. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-white transition-colors">Cookies Settings</Link>
          </div>

          <div className="flex gap-4">
            <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 hover:text-white transition-all">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 hover:text-white transition-all">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 hover:text-white transition-all">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 hover:text-white transition-all">
              <Facebook className="h-4 w-4" />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default HomeFooter;
