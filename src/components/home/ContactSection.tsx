import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Mail, Phone as PhoneIcon, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { logger, getErrorMessage } from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE_LENGTH = 10;
const RATE_LIMIT_MS = 30_000;

const smoothEase = [0.16, 1, 0.3, 1] as const;

const log = logger('ContactSection');

const ContactSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lastSubmitRef = useRef(0);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; message?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Full name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_REGEX.test(email)) next.email = "Enter a valid email address.";
    if (phone.trim() && !/^[\d\s\-\+\(\)]{7,20}$/.test(phone.trim())) next.phone = "Enter a valid phone number.";
    if (!message.trim()) next.message = "Message is required.";
    else if (message.trim().length < MIN_MESSAGE_LENGTH)
      next.message = `Message must be at least ${MIN_MESSAGE_LENGTH} characters.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    if (!validate()) return;
    const now = Date.now();
    if (now - lastSubmitRef.current < RATE_LIMIT_MS) {
      toast.error("You've already submitted recently. Please wait.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("contact-form", {
        body: { name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim(), pageUrl: window.location.href },
      });
      if (error) throw error;
      lastSubmitRef.current = Date.now();
      setSubmitted(true);
      setName(""); setEmail(""); setPhone(""); setMessage(""); setErrors({});
    } catch (err: any) {
      log.error('Contact form submission failed', err);
      toast.error('Something went wrong. Please try again or email us directly at info@logiclot.ai');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="section-padding relative" ref={sectionRef}>
      <div className="section-container max-w-2xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: smoothEase }}
        >
          <h2 className="font-heading text-3xl md:text-[44px] font-bold tracking-[-0.02em] mb-4 leading-tight text-white">
            Contact Us
          </h2>
          <p className="text-lg max-w-md mx-auto text-white/80">
            Have a question or want to learn more? Drop us a line.
          </p>
          <div className="flex items-center justify-center mt-6">
            <a
              href="mailto:info@logiclot.ai"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              <Mail className="h-4 w-4" />
              info@logiclot.ai
            </a>
          </div>
        </motion.div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="landing-card-blue text-center py-12 px-6"
          >
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-400" />
            <h3 className="font-heading text-2xl font-semibold mb-2 text-white">Thank you for submitting!</h3>
            <p className="text-white/70">We'll get back to you as soon as we can.</p>
            <Button className="mt-6" variant="outline" onClick={() => setSubmitted(false)}>
              Send another message
            </Button>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
            onSubmit={handleSubmit}
            className="landing-card-blue p-8 space-y-5"
            noValidate
          >
            {/* Honeypot */}
            <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>

            <div>
              <label htmlFor="contactName" className="block text-sm font-medium text-white/70 mb-1.5">Full Name</label>
              <Input id="contactName" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} className={`bg-white/10 border-white/20 text-white placeholder:text-white/40 ${errors.name ? "border-destructive" : ""}`} disabled={submitting} />
              {errors.name && <p className="text-sm text-red-400 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-white/70 mb-1.5">Email Address</label>
              <Input id="contactEmail" type="email" placeholder="jane@dealership.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`bg-white/10 border-white/20 text-white placeholder:text-white/40 ${errors.email ? "border-destructive" : ""}`} disabled={submitting} />
              {errors.email && <p className="text-sm text-red-400 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="contactPhone" className="block text-sm font-medium text-white/70 mb-1.5">Phone Number <span className="text-white/40">(optional)</span></label>
              <Input id="contactPhone" type="tel" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} className={`bg-white/10 border-white/20 text-white placeholder:text-white/40 ${errors.phone ? "border-destructive" : ""}`} disabled={submitting} />
              {errors.phone && <p className="text-sm text-red-400 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label htmlFor="contactMessage" className="block text-sm font-medium text-white/70 mb-1.5">Message</label>
              <Textarea id="contactMessage" placeholder="Tell us how we can help…" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={`bg-white/10 border-white/20 text-white placeholder:text-white/40 ${errors.message ? "border-destructive" : ""}`} disabled={submitting} />
              {errors.message && <p className="text-sm text-red-400 mt-1">{errors.message}</p>}
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={submitting}>
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Sending…</>) : (<><Send className="h-4 w-4" />Send Message</>)}
            </Button>
          </motion.form>
        )}
      </div>
    </section>
  );
};

export default ContactSection;
