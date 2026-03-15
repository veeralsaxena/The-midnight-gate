"use client";
import React, { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Zap,
  Target,
  Brain,
  Database,
  Cpu,
  Share2,
  MousePointer2,
  Activity,
  History,
  Lock,
  Globe2,
  AlertTriangle,
  Network,
  Timer,
  RefreshCcw,
  TrendingUp,
  CheckCircle2,
  Gauge,
  Server,
  Github,
  Layers,
  CircleDot,
  Search,
  Users,
  TerminalSquare,
  Flame,
  Clock,
  Shield,
  Lightbulb
} from "lucide-react";
import { SplineScene } from "@/components/ui/SplineScene";
import { GooeyText } from "@/components/ui/GooeyText";
import { Spotlight } from "@/components/ui/Spotlight";
import { SparklesCore } from "@/components/ui/SparklesCore";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

/* ─── Helper: Glassmorphism Stat Card ─── */
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-xl border border-${color}-500/20 p-5 group hover:border-${color}-500/40 transition-all duration-300`}>
      <div className={`absolute -right-6 -top-6 w-20 h-20 bg-${color}-500/10 blur-[40px] rounded-full group-hover:bg-${color}-500/20 transition-colors`} />
      <div className="relative z-10 flex items-center gap-4">
        <div className={`p-2.5 rounded-xl bg-${color}-500/10 border border-${color}-500/20`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl md:text-3xl font-black text-white">{value}</p>
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function PitchDeck() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className="fixed inset-0 -z-50 pointer-events-none bg-black">
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
      </div>

      <div
        ref={scrollRef}
        className="flex flex-col lg:flex-row overflow-y-auto lg:overflow-y-hidden lg:overflow-x-auto scroll-smooth w-full h-[100dvh] hide-scrollbar relative z-10"
        style={{ scrollbarWidth: "none" }}
      >
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}} />

      {/* ═══════════════ SLIDE 1: The Problem (Thundering Herd) ═══════════════ */}
      <section className="flex-none min-h-[100dvh] lg:min-h-0 min-w-full lg:min-w-[100vw] lg:h-full relative flex items-center py-16 lg:py-0 pr-0 lg:pr-24">
        <div className="absolute inset-0 w-full h-full -z-10 overflow-hidden">
          <SparklesCore
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={30}
            className="w-full h-full"
            particleColor="#3b82f6"
          />
        </div>

        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20 z-[1]" fill="#3b82f6" />

        <div className="relative z-20 container mx-auto px-6 md:px-12 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <motion.div
              className="flex flex-col justify-center space-y-6 relative z-10"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
            >
              <motion.div custom={0} variants={fadeUp}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wider uppercase">
                  <Flame className="w-3.5 h-3.5" /> The Problem: The Thundering Herd
                </div>
              </motion.div>

              <motion.div custom={2} variants={fadeUp} className="mt-2 text-white">
                <div className="min-h-[80px] md:min-h-[100px] w-full flex justify-start items-center overflow-visible">
                  <GooeyText
                    texts={["The Midnight Gate", "Survive the Strike", "Atomic. Secure. Fast."]}
                    morphTime={1.4}
                    cooldownTime={1.5}
                    className="h-full"
                    textClassName="text-white text-[28px] sm:text-4xl md:text-[4rem] font-black tracking-tighter leading-tight whitespace-nowrap"
                  />
                </div>
              </motion.div>

              <motion.p custom={3} variants={fadeUp} className="text-base md:text-lg text-neutral-400 max-w-xl leading-relaxed">
                When thousands of users hit "Buy" at the exact same millisecond, systems crash. Inventory goes negative. Ghost orders are placed. We built a commerce gate that <span className="text-blue-400 font-semibold">guarantees zero race conditions, sub-5ms rejections, and absolute consistency.</span>
              </motion.p>

              <motion.div custom={4} variants={fadeUp} className="flex gap-4 pt-4">
                <Link href="/drop" className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors flex items-center gap-2">
                  Enter The Drop <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/admin" className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-colors flex items-center gap-2">
                  <Activity className="w-4 h-4" /> View War Room
                </Link>
              </motion.div>

              <motion.div custom={5} variants={fadeUp} className="flex flex-wrap gap-4 md:gap-8 py-4 border-t border-white/[0.06] mt-4">
                {[
                  { value: "50,000", label: "Simulated Users" },
                  { value: "0", label: "Race Conditions" },
                  { value: "< 5ms", label: "Rejection Latency" },
                ].map((stat, i) => (
                  <div key={i} className="min-w-[120px]">
                    <p className="text-xl md:text-2xl font-black text-white">{stat.value}</p>
                    <p className="text-[10px] md:text-[11px] text-neutral-500 uppercase tracking-wider">{stat.label}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              className="absolute inset-0 lg:relative h-[600px] lg:h-[550px] lg:translate-x-12 xl:translate-x-20 opacity-30 lg:opacity-100 pointer-events-none lg:pointer-events-auto -z-0 lg:z-10"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <div className="absolute inset-0 z-0 pointer-events-none" style={{
                background: "radial-gradient(ellipse 50% 60% at 50% 55%, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)"
              }} />
            </motion.div>
          </div>
        </div>

        <motion.div
          className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-neutral-600"
          animate={{ x: [0, 12, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase">Scroll →</span>
          <ArrowRight className="w-4 h-4" />
        </motion.div>
      </section>

      {/* ═══════════════ SLIDE 2: Solution Architecture ═══════════════ */}
      <section className="flex-none min-h-[100dvh] lg:min-h-0 min-w-full lg:min-w-[85vw] lg:h-full relative flex items-center justify-center p-6 md:p-8 lg:pr-24 py-16 lg:py-0">
        <div className="max-w-7xl w-full relative z-10 flex flex-col lg:flex-row gap-12 items-center">
          <div className="space-y-6 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wider uppercase">
              <Layers className="w-3 h-3" /> Architecture
            </div>
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent leading-tight">
              The 5-Layer Defense Funnel.
            </h2>
            <p className="text-neutral-400 leading-relaxed text-sm md:text-base max-w-xl">
              You cannot let 50,000 users touch your database simultaneously. We filter traffic at each increasingly stricter layer, stopping the herd before it arrives.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              {[
                { title: "Layer 1: Edge & CDN", desc: "Next.js frontends served statically from the edge. Heavy static load absorbed entirely.", icon: <Globe2 className="w-5 h-5 text-blue-400"/> },
                { title: "Layer 2: Limiter", desc: "Express.js middleware blocks bad actors and standardizes request flow before the core.", icon: <Shield className="w-5 h-5 text-cyan-400"/> },
                { title: "Layer 3: The Redis Gate", desc: "In-memory atomic Lua scripts. Checks stock and decrements in an unbreakable transaction.", icon: <Database className="w-5 h-5 text-emerald-400"/> },
                { title: "Layer 4: BullMQ Queue", desc: "The successful users are queued. Protects the database from simultaneous write spikes.", icon: <Layers className="w-5 h-5 text-amber-400"/> },
              ].map((item, i) => (
                <motion.div key={i} custom={i} variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex gap-4 items-start p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-white/[0.06] hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition-all duration-300 group">
                  <div className="mt-0.5 p-2 bg-white/[0.04] rounded-lg border border-white/[0.04]">{item.icon}</div>
                  <div>
                    <h4 className="font-bold text-neutral-200 text-sm mb-1">{item.title}</h4>
                    <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex-1 w-full max-w-[500px]">
             {/* Visual representation of the funnel instead of AgentNetwork */}
             <div className="flex flex-col items-center gap-4">
                <div className="w-[100%] h-16 bg-blue-500/20 border border-blue-500/50 rounded-xl flex items-center justify-center font-bold text-blue-400">50,000 Requests</div>
                <ArrowRight className="w-6 h-6 text-neutral-600 rotate-90" />
                <div className="w-[80%] h-16 bg-cyan-500/20 border border-cyan-500/50 rounded-xl flex items-center justify-center font-bold text-cyan-400">Rate Limiter</div>
                <ArrowRight className="w-6 h-6 text-neutral-600 rotate-90" />
                <div className="w-[60%] h-20 bg-emerald-500/20 border border-emerald-500/50 rounded-xl flex items-center justify-center font-black text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">THE REDIS GATE</div>
                <div className="flex w-[60%] justify-between mt-2">
                    <div className="flex flex-col items-center gap-2">
                        <ArrowRight className="w-6 h-6 text-red-500/50 rotate-[-135deg]" />
                        <span className="text-red-400 text-xs font-bold">49,990 Rejected</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <ArrowRight className="w-6 h-6 text-green-500/50 rotate-90" />
                        <span className="text-emerald-400 text-xs font-bold">10 Accepted</span>
                    </div>
                </div>
                <div className="w-[40%] h-16 bg-amber-500/20 border border-amber-500/50 rounded-xl flex items-center justify-center font-bold text-amber-400 mt-2">BullMQ Queue</div>
                <ArrowRight className="w-6 h-6 text-neutral-600 rotate-90" />
                <div className="w-[20%] h-16 bg-purple-500/20 border border-purple-500/50 rounded-xl flex items-center justify-center font-bold text-purple-400">PostgreSQL Database</div>
             </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SLIDE 3: Key Innovations ═══════════════ */}
      <section className="flex-none min-h-[100dvh] lg:min-h-0 min-w-full lg:min-w-[85vw] lg:h-full relative flex items-center justify-center p-6 md:p-8 lg:pr-24 py-16 lg:py-0">
        <motion.div
          className="max-w-6xl w-full relative z-10 space-y-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
        >
          <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold tracking-wider uppercase mb-4">
              <Lightbulb className="w-3 h-3" /> 3 Industry Innovations
            </div>
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent leading-tight">
              Beyond Enterprise Standards.
            </h2>
            <p className="text-neutral-400 mt-4 max-w-lg mx-auto">How we built a smarter, faster, and more resilient drop system.</p>
          </motion.div>

          <motion.div variants={fadeUp} className="w-full">
            <BentoGrid className="lg:grid-rows-2">
            {[
              {
                name: "Reactive Heartbeat",
                description: "Standard drops lock abandoned items for 15 minutes. We linked the Redis reservation to the WebSocket heartbeat. Tab closed? Item instantly released.",
                Icon: Activity,
                href: "/drop",
                cta: "Try it out",
                className: "lg:col-start-1 lg:col-end-3 lg:row-start-1 lg:row-end-2",
                background: <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent" />
              },
              {
                name: "Load Shedding",
                description: "Pressure-adaptive rejection. If the internal BullMQ queue exceeds 20 jobs, the API instantly returns 503s instead of crashing from the inside out.",
                Icon: Shield,
                href: "/admin",
                cta: "View Metrics",
                className: "lg:col-start-3 lg:col-end-4 lg:row-start-1 lg:row-end-2",
                background: <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-transparent" />
              },
              {
                name: "Atomic Lua Scripts",
                description: "3 separate Lua scripts (Reserve, Release, Confirm) process inventory checks and decrements as a single, uninterruptible transaction. Zero TOCTOU vulnerabilities.",
                Icon: TerminalSquare,
                href: "https://github.com/veeralsaxena/The-midnight-gate",
                cta: "View Code",
                className: "lg:col-start-1 lg:col-end-2 lg:row-start-2 lg:row-end-3",
                background: <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent" />
              },
              {
                name: "Real-Time War Room",
                description: "Full observability built-in. Watch the herd arrive natively with live RPS metrics, dynamic queue depth, and a scrolling activity feed powered by WebSockets.",
                Icon: Target,
                href: "/admin",
                cta: "Enter War Room",
                className: "lg:col-start-2 lg:col-end-4 lg:row-start-2 lg:row-end-3",
                background: <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent" />
              },
            ].map((tech, i) => (
              <BentoCard
                key={i}
                {...tech}
              />
            ))}
          </BentoGrid>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════ SLIDE 4: Call to Action ═══════════════ */}
      <section className="flex-none min-h-[100dvh] lg:min-h-0 min-w-full lg:min-w-[50vw] lg:h-full relative flex items-center justify-center p-6 md:p-8 py-16 lg:py-0">
        <motion.div
            className="flex flex-col items-center justify-center relative z-10 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
             <motion.div variants={fadeUp} className="mb-8">
                <Lock className="w-16 h-16 text-blue-500 mx-auto mb-6 opacity-80" />
                <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                The Gate Is Ready.
                </h2>
                <p className="text-neutral-400 mt-4 max-w-md mx-auto">
                Ready to witness the system handle 5,000 connections without breaking a sweat?
                </p>
             </motion.div>

             <motion.div variants={fadeUp} className="flex flex-col gap-4 w-full max-w-sm">
                <Link href="/drop" className="w-full px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] flex justify-center items-center gap-2">
                  Launch User Drop <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/admin" className="w-full px-6 py-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white font-bold transition-all flex justify-center items-center gap-2 mt-2">
                  Open War Room <Activity className="w-4 h-4" />
                </Link>
             </motion.div>
        </motion.div>
      </section>

      </div>
    </>
  );
}
