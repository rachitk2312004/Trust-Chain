import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Gavel,
  Lock,
  ShieldCheck,
  Sparkles,
  Store,
  Workflow,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { Moon, Sun } from "lucide-react";

const features = [
  {
    title: "Certificates",
    description: "Issue verifiable credentials with cryptographic integrity and elegant templates.",
    icon: Award,
  },
  {
    title: "Enterprise",
    description: "SSO, SCIM, tenancy, and policy controls designed for regulated organizations.",
    icon: Building2,
  },
  {
    title: "Governance",
    description: "Risk, controls, and audit-ready evidence trails across every trust event.",
    icon: Gavel,
  },
  {
    title: "Marketplace",
    description: "Connectors and extensions that plug TrustChain into your existing stack.",
    icon: Store,
  },
];

const stats = [
  { label: "Verifications / day", value: "2.4M+" },
  { label: "Uptime SLA", value: "99.99%" },
  { label: "Regions", value: "12" },
  { label: "Integrations", value: "40+" },
];

const testimonials = [
  {
    quote: "TrustChain replaced three internal systems with one verifiable source of truth.",
    name: "Priya N.",
    role: "Head of Compliance",
  },
  {
    quote: "The developer experience feels like Stripe — crisp APIs, clear audit events.",
    name: "Marcus L.",
    role: "Platform Engineering",
  },
  {
    quote: "Our auditors finally stop asking for screenshots. The evidence is the product.",
    name: "Elena V.",
    role: "CISO",
  },
];

export function HomePage() {
  const { resolved, toggle } = useTheme();

  return (
    <div className="relative min-h-screen overflow-hidden bg-tc-canvas text-tc-fg">
      <div className="pointer-events-none absolute inset-0 tc-grid-bg opacity-50" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[640px] w-[980px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-40 h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </span>
          TrustChain
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="tc-focus inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-tc-border text-tc-muted hover:bg-tc-surface"
            aria-label="Toggle theme"
          >
            {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            to="/login"
            className="hidden rounded-xl px-3 py-2 text-sm font-medium text-tc-muted hover:text-tc-fg sm:inline"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-emerald-700"
          >
            Start building
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <p className="inline-flex items-center gap-2 rounded-full border border-tc-border bg-tc-surface/80 px-3 py-1 text-xs font-medium text-tc-muted shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            Enterprise trust infrastructure
          </p>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            <span className="tc-gradient-text">TRUSTCHAIN</span>
          </h1>
          <p className="mt-5 max-w-xl text-xl font-medium tracking-tight text-tc-fg md:text-2xl">
            Enterprise trust infrastructure for the modern world.
          </p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-tc-muted">
            Issue, verify, govern, and secure digital trust at global scale.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-emerald-700"
            >
              Start building
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-tc-border bg-tc-surface px-5 py-3 text-sm font-semibold text-tc-fg shadow-soft transition hover:bg-tc-surface-2"
            >
              View dashboard
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-tc-border bg-tc-surface/80 p-4 shadow-soft">
                <p className="font-display text-2xl font-bold tracking-tight text-tc-fg">{s.value}</p>
                <p className="mt-1 text-xs text-tc-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-[28px] border border-tc-border bg-slate-950 p-6 shadow-elevated">
            <div className="absolute inset-0 opacity-40 tc-grid-bg" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Live trust graph</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Verified
                </span>
              </div>
              <div className="grid gap-3">
                {[
                  { label: "Document sealed", meta: "SHA-256 · Merkle anchored" },
                  { label: "Certificate issued", meta: "Template · Employer · Batch #482" },
                  { label: "Policy evaluated", meta: "Retention · Legal hold clear" },
                  { label: "Webhook delivered", meta: "certificate.issued · 201" },
                ].map((row, i) => (
                  <motion.div
                    key={row.label}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{row.label}</p>
                      <p className="text-xs text-slate-400">{row.meta}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-blue-500/10 p-4">
                <div className="flex items-center gap-2 text-emerald-200">
                  <Lock className="h-4 w-4" />
                  <p className="text-sm font-semibold">Cryptographic chain of custody</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Every issuance, signature, and verification event is linked, signed, and exportable for audit.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight">Built for operators who ship trust</h2>
          <p className="mt-3 text-tc-muted">
            A complete platform — from issuance and verification to governance, marketplace, and developer APIs.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-tc-border bg-tc-surface p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-tc-accent-soft text-tc-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-tc-muted">{f.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <div className="overflow-hidden rounded-[28px] border border-tc-border bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-8 text-white shadow-elevated md:p-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Certificates</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Issue once. Verify everywhere.</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Templates, bulk issuance, public verification, and analytics — without sacrificing cryptographic guarantees.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Template designer", "Bulk pipelines", "Public verify", "Revocation"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium">
                  <Workflow className="mb-2 h-4 w-4 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-3xl font-bold tracking-tight">Trusted by teams that cannot guess</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <blockquote
              key={t.name}
              className="rounded-2xl border border-tc-border bg-tc-surface p-6 shadow-soft"
            >
              <p className="text-sm leading-relaxed text-tc-fg">“{t.quote}”</p>
              <footer className="mt-4 text-xs text-tc-muted">
                <span className="font-semibold text-tc-fg">{t.name}</span> · {t.role}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-[28px] border border-tc-border bg-tc-surface p-8 text-center shadow-card md:p-12">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Ready to operationalize trust?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-tc-muted">
            Start with the portal, then graduate to APIs, webhooks, and enterprise controls.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Start building
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-tc-border px-5 py-3 text-sm font-semibold text-tc-fg hover:bg-tc-surface-2"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-tc-border bg-tc-surface/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-tc-muted">
          <p>© {new Date().getFullYear()} TrustChain</p>
          <div className="flex gap-4">
            <Link to="/verification/public" className="hover:text-tc-fg">
              Public verify
            </Link>
            <Link to="/login" className="hover:text-tc-fg">
              Sign in
            </Link>
            <Link to="/developer/docs" className="hover:text-tc-fg">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
