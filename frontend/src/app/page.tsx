import React from "react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div 
      className="relative flex min-h-screen w-full flex-col font-body text-slate-100 overflow-x-hidden selection:bg-[#00F0FF]/30 selection:text-white"
      style={{ 
        backgroundImage: "linear-gradient(to bottom, rgba(10, 10, 22, 0.6), rgba(10, 10, 22, 0.9)), url('/background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed"
      }}
    >

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-24">
        {/* Subtle glow overlay for extra depth */}
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #00F0FF22 0%, transparent 40%), radial-gradient(circle at 80% 70%, #FF00E511 0%, transparent 40%)" }}></div>
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/20 bg-[#00F0FF]/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#00F0FF]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F0FF] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00F0FF]"></span>
            </span>
            Infrastructure Redefined
          </div>
          <h1 className="font-display text-5xl font-black leading-tight tracking-tighter md:text-7xl lg:text-8xl">
            <span style={{ background: "linear-gradient(to right, #00F0FF, #ffffff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              The Midnight Gate:
            </span> <br />
            <span className="text-slate-100">Survive the Strike</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-400 md:text-xl">
            High-performance resilient infrastructure engineered to withstand 100x traffic spikes. Deep space glassmorphism meets mission-critical reliability.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link href="/simulation" className="flex items-center justify-center h-14 min-w-[200px] rounded-xl bg-[#00F0FF] px-8 text-lg font-bold text-[#0A0A16] shadow-lg shadow-[#00F0FF]/20 hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all active:scale-95">
              Start Simulation
            </Link>
            <Link href="/admin" className="flex items-center justify-center h-14 min-w-[200px] rounded-xl px-8 text-lg font-bold text-slate-100 bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] hover:bg-[#00F0FF]/10 transition-colors">
              War Room Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Architecture Funnel Section */}
      <section id="architecture" className="py-24 lg:px-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white">The Resilience Stack</h2>
          <p className="mt-4 text-slate-400">Multi-layered defensive architecture for extreme availability</p>
          
          <div className="mt-20 flex flex-col items-center">
            {/* Layer 1 */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] flex w-full max-w-2xl items-center gap-6 rounded-2xl p-6 transition-all hover:bg-[#00F0FF]/5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#00F0FF]/20 text-[#00F0FF]">
                <span className="material-symbols-outlined text-3xl">public</span>
              </div>
              <div className="text-left">
                <h3 className="font-display text-xl font-bold text-white">CDN Edge</h3>
                <p className="text-sm text-slate-400">Layer 1: Global distribution and static asset offloading</p>
              </div>
            </div>
            <div className="h-12 w-px bg-gradient-to-b from-[#00F0FF] to-transparent opacity-50" style={{ boxShadow: "0 0 15px rgba(0,240,255,0.4)" }}></div>
            
            {/* Layer 2 */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] flex w-full max-w-xl items-center gap-6 rounded-2xl p-6 transition-all hover:bg-[#00F0FF]/5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#00F0FF]/20 text-[#00F0FF]">
                <span className="material-symbols-outlined text-3xl">speed</span>
              </div>
              <div className="text-left">
                <h3 className="font-display text-xl font-bold text-white">Rate Limiter</h3>
                <p className="text-sm text-slate-400">Layer 2: Adaptive traffic throttling and WAF filtering</p>
              </div>
            </div>
            <div className="h-12 w-px bg-gradient-to-b from-[#00F0FF] to-transparent opacity-50" style={{ boxShadow: "0 0 15px rgba(0,240,255,0.4)" }}></div>
            
            {/* Layer 3 */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] flex w-full max-w-lg items-center gap-6 rounded-2xl p-6 transition-all hover:bg-[#00F0FF]/5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#00F0FF]/20 text-[#00F0FF]">
                <span className="material-symbols-outlined text-3xl">key</span>
              </div>
              <div className="text-left">
                <h3 className="font-display text-xl font-bold text-white">Redis Gate</h3>
                <p className="text-sm text-slate-400">Layer 3: Sub-millisecond session validation via Atomic Lua</p>
              </div>
            </div>
            <div className="h-12 w-px bg-gradient-to-b from-[#00F0FF] to-transparent opacity-50" style={{ boxShadow: "0 0 15px rgba(0,240,255,0.4)" }}></div>
            
            {/* Layer 4 */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] flex w-full max-w-md items-center gap-6 rounded-2xl p-6 transition-all hover:bg-[#00F0FF]/5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#00F0FF]/20 text-[#00F0FF]">
                <span className="material-symbols-outlined text-3xl">reorder</span>
              </div>
              <div className="text-left">
                <h3 className="font-display text-xl font-bold text-white">BullMQ Task Queue</h3>
                <p className="text-sm text-slate-400">Layer 4: Decoupled asynchronous job processing</p>
              </div>
            </div>
            <div className="h-12 w-px bg-gradient-to-b from-[#00F0FF] to-transparent opacity-50" style={{ boxShadow: "0 0 15px rgba(0,240,255,0.4)" }}></div>
            
            {/* Layer 5 */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] flex w-full max-w-sm items-center gap-6 rounded-2xl p-6 transition-all hover:bg-[#00F0FF]/5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#00F0FF]/20 text-[#00F0FF]">
                <span className="material-symbols-outlined text-3xl">database</span>
              </div>
              <div className="text-left">
                <h3 className="font-display text-xl font-bold text-white">Postgres Core</h3>
                <p className="text-sm text-slate-400">Layer 5: High-availability relational persistence</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Innovations Bento Grid */}
      <section id="innovations" className="py-24 lg:px-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16">
            <h2 className="font-display text-4xl font-bold text-white">System Innovations</h2>
            <p className="mt-4 text-slate-400">Proprietary protocols for the next era of infrastructure.</p>
          </div>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-2">
            {/* Heartbeat */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] col-span-1 flex flex-col justify-between overflow-hidden rounded-3xl p-8 md:col-span-2 relative">
              <div className="relative z-10">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#00F0FF]/10 text-[#00F0FF]">
                  <span className="material-symbols-outlined">favorite</span>
                </div>
                <h3 className="font-display text-2xl font-bold text-white">Reactive Heartbeat</h3>
                <p className="mt-4 max-w-md text-slate-400">Continuous health telemetry with sub-millisecond precision. Automatically releasing locked inventory the moment a WebSocket connection drops (tab closed).</p>
              </div>
              <div className="mt-8 flex gap-2 relative z-10">
                <span className="rounded-full bg-[#00F0FF]/10 px-3 py-1 text-xs text-[#00F0FF]">Active Monitoring</span>
                <span className="rounded-full bg-[#00F0FF]/10 px-3 py-1 text-xs text-[#00F0FF]">0.5ms Latency</span>
              </div>
              <div className="absolute -right-10 -top-10 size-48 rounded-full bg-[#00F0FF]/10 blur-3xl z-0"></div>
            </div>
            
            {/* Load Shedding */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] col-span-1 rounded-3xl p-8 hover:bg-[#00F0FF]/5 transition-colors">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#FF00E5]/10 text-[#FF00E5] shadow-[0_0_15px_rgba(255,0,229,0.3)]">
                <span className="material-symbols-outlined">filter_list</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white">Load Shedding</h3>
              <p className="mt-4 text-slate-400">Graceful degradation under extreme duress. Throws instant 503s when the queue depth hits critical thresholds.</p>
              <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-2/3 bg-[#FF00E5] shadow-[0_0_10px_rgba(255,0,229,0.5)]"></div>
              </div>
            </div>
            
            {/* Lua Scripts */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] col-span-1 rounded-3xl p-8 hover:bg-[#00F0FF]/5 transition-colors">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#00F0FF]/10 text-[#00F0FF]">
                <span className="material-symbols-outlined">code</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white">Atomic Lua</h3>
              <p className="mt-4 text-slate-400">High-performance database logic executed directly at the storage edge for zero-latency, unbreakable state transitions preventing TOCTOU.</p>
            </div>
            
            {/* Distribution */}
            <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] col-span-1 flex flex-col justify-between rounded-3xl p-8 md:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold text-white">Extremely High Throughput</h3>
                  <p className="mt-4 max-w-md text-slate-400">Engineered to absorb 50,000 requests per second and elegantly reject the herd without breaking a sweat.</p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-xl bg-[#00F0FF]/10 text-[#00F0FF]">
                  <span className="material-symbols-outlined">speed</span>
                </div>
              </div>
              <div className="mt-12 flex items-center justify-between border-t border-[#00F0FF]/10 pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">100%</div>
                  <div className="text-xs text-slate-500 uppercase">Consistent State</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">&lt;5ms</div>
                  <div className="text-xs text-slate-500 uppercase">Avg. Latency</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">0</div>
                  <div className="text-xs text-slate-500 uppercase">Database Crashes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <footer id="benchmarks" className="fixed bottom-6 left-1/2 z-50 w-full max-w-5xl -translate-x-1/2 px-6">
        <div className="bg-[rgba(0,240,255,0.03)] backdrop-blur-[12px] border border-[rgba(0,240,255,0.1)] flex items-center justify-between rounded-2xl p-4 shadow-2xl shadow-[#00F0FF]/10">
          <div className="flex gap-12 px-6">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]"></span>
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">System Status</p>
                <p className="text-sm font-bold text-[#22C55E]">Operational</p>
              </div>
            </div>
            <div className="hidden md:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Protection Layer</p>
              <p className="text-sm font-bold text-white">Active (Lua + BullMQ)</p>
            </div>
            <div className="hidden md:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">P99 Latency</p>
              <p className="text-sm font-bold text-white">8.4 ms</p>
            </div>
          </div>
          <Link href="/admin" className="flex items-center gap-2 rounded-lg bg-[#00F0FF]/10 px-4 py-2 text-sm font-bold text-[#00F0FF] transition-colors hover:bg-[#00F0FF]/20">
            <span className="material-symbols-outlined text-lg">terminal</span>
            Live Logs
          </Link>
        </div>
      </footer>

      {/* Spacer for footer */}
      <div className="h-32"></div>
    </div>
  );
}
