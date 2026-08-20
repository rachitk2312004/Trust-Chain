import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-tc-canvas">
      <div className="pointer-events-none absolute inset-0 tc-grid-bg opacity-60" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-emerald-500/20 blur-3xl"
        animate={{ x: [0, 24, 0], y: [0, 16, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-0 h-[380px] w-[380px] rounded-full bg-blue-500/15 blur-3xl"
        animate={{ x: [0, -20, 0], y: [0, -12, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.25) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.18) 0%, transparent 40%)",
          }}
        />
        <Link to="/" className="relative inline-flex items-center gap-3">
          <motion.span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300"
            animate={{ boxShadow: ["0 0 0 0 rgba(16,185,129,0.2)", "0 0 0 12px rgba(16,185,129,0)", "0 0 0 0 rgba(16,185,129,0.2)"] }}
            transition={{ duration: 2.8, repeat: Infinity }}
          >
            <ShieldCheck className="h-5 w-5" />
          </motion.span>
          <span className="font-display text-xl font-bold tracking-tight">TrustChain</span>
        </Link>
        <div className="relative">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-4xl font-bold tracking-tight"
          >
            Enterprise trust
            <br />
            <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
              infrastructure.
            </span>
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22 }}
            className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300"
          >
            Issue, verify, govern, and secure digital trust with cryptographic certainty — at global
            scale.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-6 h-px w-16 origin-left bg-gradient-to-r from-emerald-400/80 to-transparent"
          />
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="relative text-xs text-slate-500"
        >
          Trusted by operators who cannot afford ambiguity.
        </motion.p>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight text-tc-fg lg:hidden"
        >
          <ShieldCheck className="h-5 w-5 text-tc-accent" />
          TrustChain
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="w-full max-w-md"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
