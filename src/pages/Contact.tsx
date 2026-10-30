import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { logger, getErrorMessage } from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import MovingBackground from "@/components/MovingBackground";

const log = logger('Contact');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE_LENGTH = 10;
const RATE_LIMIT_MS = 30_000;

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lastSubmitRef = useRef(0);

  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Full name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_REGEX.test(email)) next.email = "Enter a valid email address.";
    if (!message.trim()) next.message = "Message is required.";
    else if (message.trim().length < MIN_MESSAGE_LENGTH) next.message = `Message must be at least ${MIN_MESSAGE_LENGTH} characters.`;
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
        body: { name: name.trim(), email: email.trim(), message: message.trim(), pageUrl: window.location.href },
      });
      if (error) throw error;
      lastSubmitRef.current = Date.now();
      setSubmitted(true);
      setName(""); setEmail(""); setMessage(""); setErrors({});
    } catch (err: unknown) {
      log.error('Contact form submission failed', err);
      const msg = getErrorMessage(err);
      toast.error(
        msg === 'An unexpected error occurred'
          ? 'Please try again or email us directly at info@logiclot.ai'
          : msg
      );
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen relative">
      <MovingBackground />
      <SiteHeader />
      <div className="section-container max-w-2xl py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <h1 className="font-heading text-slate-200 text-4xl md:text-[48px] font-bold tracking-[-0.02em] mb-4">
            Contact Us
          </h1>
          <p className="text-slate-400 text-lg max-w-md mx-auto">
            Have a question or want to learn more? Drop us a line.
          </p>
          <a href="mailto:info@logiclot.ai" className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-slate-400 hover:text-foreground transition-colors">
            <Mail className="h-4 w-4" />info@logiclot.ai
          </a>
        </motion.div>

        {submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card-elevated text-center py-12 px-6">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--data-green))]" />
            <h2 className="font-heading text-2xl font-semibold mb-2">Thank you for submitting!</h2>
            <p className="text-slate-400">We'll get back to you as soon as we can.</p>
            <Button className="mt-6" variant="outline" onClick={() => setSubmitted(false)}>Send another message</Button>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={handleSubmit}
            className="card-elevated space-y-5"
            noValidate
          >
            <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>

            <div>
              <label htmlFor="fullName" className="label-text">Full Name</label>
              <Input id="fullName" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} className={errors.name ? "border-destructive" : ""} disabled={submitting} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className="label-text">Email Address</label>
              <Input id="email" type="email" placeholder="jane@dealership.com" value={email} onChange={(e) => setEmail(e.target.value)} className={errors.email ? "border-destructive" : ""} disabled={submitting} />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="message" className="label-text">Message</label>
              <Textarea id="message" placeholder="Tell us how we can help…" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={errors.message ? "border-destructive" : ""} disabled={submitting} />
              {errors.message && <p className="text-sm text-destructive mt-1">{errors.message}</p>}
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={submitting}>
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Sending…</>) : (<><Send className="h-4 w-4" />Send Message</>)}
            </Button>
          </motion.form>
        )}
      </div>
    </div>
  );
};

export default Contact;
