// @ts-nocheck — Deno edge function; not checked by project TypeScript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const allowedOrigins = [
  "http://localhost:8080",
  "https://logiclot.vercel.app",
];

function buildCorsHeaders(requestOrigin: string | null) {
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : "https://logiclot.vercel.app";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

interface ContactPayload {
  name: string;
  email: string;
  message: string;
  pageUrl?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ContactPayload = await req.json();
    const { name, email, message, pageUrl } = body;

    // --- Server-side validation ---
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Name is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return new Response(JSON.stringify({ error: "Valid email is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Message must be at least 10 characters." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Cap lengths to prevent abuse
    const safeName = name.trim().slice(0, 200);
    const safeEmail = email.trim().slice(0, 320);
    const safeMessage = message.trim().slice(0, 5000);
    const safePageUrl = (pageUrl || "").slice(0, 500);
    const timestamp = new Date().toISOString();

    console.log(`Contact form submission from ${safeEmail} at ${timestamp}`);

    const { error } = await resend.emails.send({
      from: "LogicLot Contact <noreply@logiclot.ai>",
      to: ["info@logiclot.ai"],
      reply_to: safeEmail,
      subject: `New Contact Form Submission from ${safeName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr><td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(safeName)}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><a href="mailto:${escapeHtml(safeEmail)}">${escapeHtml(safeEmail)}</a></td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #eee;">Page URL</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(safePageUrl)}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #eee;">Submitted</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${timestamp}</td></tr>
        </table>
        <h3 style="margin-top:24px;">Message</h3>
        <p style="white-space:pre-wrap;background:#f9f9f9;padding:16px;border-radius:8px;">${escapeHtml(safeMessage)}</p>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: "Failed to send email." }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Contact email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Unexpected error in contact-form:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
