"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Loader2, Timer, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function DropPage() {
  const socketRef = useRef<Socket | null>(null);
  const [userId] = useState(() => `user-${Math.random().toString(36).substring(2, 10)}`);
  const [stock, setStock] = useState<number | null>(null);
  const [reservedCount, setReservedCount] = useState(0);
  const [phase, setPhase] = useState<"IDLE" | "RESERVING" | "RESERVED" | "PAYING" | "CONFIRMED" | "FAILED">("IDLE");
  const [message, setMessage] = useState("");
  const [latency, setLatency] = useState(0);
  const [checkoutToken, setCheckoutToken] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [connected, setConnected] = useState(false);
  const [loadShedding, setLoadShedding] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Socket connection
  useEffect(() => {
    const socket = io(API);
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("inventoryUpdate", (data) => {
      setStock(data.remainingStock);
      setReservedCount(data.reservedCount || 0);
    });

    socket.on("soldOut", () => {
      if (phase === "IDLE") {
        setPhase("FAILED");
        setMessage("Every item has been claimed.");
      }
    });

    socket.on("loadShedding", (data) => {
      setLoadShedding(data.active);
    });

    return () => { socket.disconnect(); };
  }, [phase]);

  // Fetch initial inventory
  useEffect(() => {
    fetch(`${API}/api/inventory/1`)
      .then(r => r.json())
      .then(data => {
        setStock(data.stock);
        setReservedCount(data.reservedCount || 0);
      })
      .catch(() => {});
  }, []);

  // Reservation countdown timer
  useEffect(() => {
    if (phase === "RESERVED") {
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            setPhase("FAILED");
            setMessage("Reservation expired. Item released to the pool.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [phase]);

  // ---- STEP 1: RESERVE ----
  const handleReserve = useCallback(async () => {
    setPhase("RESERVING");
    setMessage("Acquiring atomic lock...");

    try {
      const t0 = performance.now();
      const res = await fetch(`${API}/api/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          productId: 1, 
          userId, 
          socketId: socketRef.current?.id 
        }),
      });
      const data = await res.json();
      const t1 = performance.now();
      setLatency(Math.round(t1 - t0));

      if (res.ok) {
        setPhase("RESERVED");
        setCheckoutToken(data.checkoutToken);
        setMessage(`Locked in ${Math.round(t1 - t0)}ms`);
      } else {
        setPhase("FAILED");
        setMessage(data.error || "Reservation rejected.");
        if (data.recommendations && data.recommendations.length > 0) {
            setRecommendations(data.recommendations);
        }
      }
    } catch {
      setPhase("FAILED");
      setMessage("Connection lost.");
    }
  }, [userId]);

  // ---- STEP 2: CONFIRM (Simulate Payment) ----
  const handleConfirm = useCallback(async () => {
    setPhase("PAYING");
    setMessage("Processing payment...");

    try {
      const res = await fetch(`${API}/api/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: 1, userId, checkoutToken }),
      });
      const data = await res.json();

      if (res.ok) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setPhase("CONFIRMED");
        setMessage("Order confirmed. It's yours.");
      } else {
        setPhase("FAILED");
        setMessage(data.error);
      }
    } catch {
      setPhase("FAILED");
      setMessage("Payment failed.");
    }
  }, [userId, checkoutToken]);

  return (
    <div className="bg-[#0A0A16] min-h-screen flex flex-col relative font-body text-white selection:bg-[#00F0FF]/30 selection:text-white overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-screen h-screen pointer-events-none z-0" style={{ background: "radial-gradient(circle at center, rgba(45, 11, 89, 0.4) 0%, rgba(10, 10, 22, 1) 70%)" }}></div>
      
      {/* Compact Status Bar */}
      <div className="w-full flex items-center justify-between px-6 py-3 lg:px-12 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] z-10 mt-16">
        <h2 className="font-display font-bold text-lg tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#F8F9FA]">
          Live Drop Simulator
        </h2>
        
        {/* Heartbeat Indicator */}
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-[#00F0FF]/20 shadow-[0_0_10px_rgba(0,240,255,0.1)]">
          {connected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-[pulseAlert_2s_infinite]"></div>
              <span className="font-mono text-[12px] text-[#00F0FF] tracking-wider uppercase">Connection: ACTIVE</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-[#FF00E5]"></div>
              <span className="font-mono text-[12px] text-[#FF00E5] tracking-wider uppercase">Connection: LOST</span>
            </>
          )}
        </div>
      </div>

      {/* Main Content Split Screen */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 lg:p-12 z-0 relative">
        
        {/* Left: Product Showcase */}
        <section className="flex flex-col justify-center items-center relative min-h-[50vh] lg:min-h-0">
          <div className="w-full max-w-md aspect-[4/5] rounded-xl bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] shadow-[0_20px_60px_-10px_rgba(45,11,89,0.6)] p-8 flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] opacity-50 z-0"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[#2D0B59] blur-[80px] rounded-full z-0 opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
            
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              {/* Product Image Placeholder */}
              <img 
                src="https://images.unsplash.com/photo-1608231387042-66d1773070a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="Sneaker" 
                className="w-full h-auto object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)] mix-blend-screen scale-110 group-hover:scale-125 transition-transform duration-700 ease-out rounded-lg"
              />
            </div>
            
            <div className="absolute bottom-6 left-6 right-6 z-10 flex justify-between items-end">
              <div>
                <p className="font-mono text-[#00F0FF] text-sm mb-1 uppercase tracking-widest">Drop 01</p>
                <h2 className="font-display font-bold text-2xl text-white">Collector's Edition</h2>
              </div>
              <div className="text-right">
                <p className="font-mono text-[#8F9BB3] text-sm line-through">$350</p>
                <p className="font-display font-bold text-xl text-white">$299</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Action Panel */}
        <section className="flex flex-col justify-center">
          <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 lg:p-12 shadow-[0_4px_30px_rgba(0,0,0,0.5)] max-w-xl w-full mx-auto lg:mx-0 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00F0FF]/50 to-transparent"></div>
            
            <div className="space-y-8 relative z-10">
              {/* Header */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#FF00E5]/10 border border-[#FF00E5]/20 text-[#FF00E5] font-mono text-xs uppercase tracking-wider mb-4 shadow-[0_0_10px_rgba(255,0,229,0.1)]">
                  <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                  High Demand
                </div>
                <h1 className="font-display font-bold text-4xl lg:text-5xl text-white leading-tight mb-2">Midnight Sneaker</h1>
                <p className="text-[#8F9BB3] text-lg">Forged in the void. Limited allocations available for this cycle.</p>
              </div>

              {/* Load Shedding Warning */}
              {loadShedding && (
                <div className="w-full p-4 bg-[#EAB308]/10 border border-[#EAB308]/30 rounded-lg text-center flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined text-[#EAB308] animate-pulse">warning</span>
                  <span className="text-[#EAB308] text-sm font-mono tracking-wide">SYSTEM UNDER PRESSURE. REQUESTS THROTTLED.</span>
                </div>
              )}

              {/* Live Stock Counter */}
              <div className="bg-black/40 border border-[rgba(255,255,255,0.1)] rounded-xl p-6 relative overflow-hidden group">
                <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:16px_16px]"></div>
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <p className="font-mono text-[#8F9BB3] text-sm uppercase tracking-widest mb-2">Live Inventory</p>
                  <div className="font-mono text-[80px] lg:text-[100px] font-bold text-[#00F0FF] leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all">
                    {stock !== null ? stock : "—"}
                  </div>
                  <p className="text-[11px] text-[#8F9BB3] mt-2 tracking-widest uppercase font-mono">
                    {reservedCount > 0 ? (
                      <span className="text-[#EAB308]">{reservedCount} locks active globally</span>
                    ) : (
                      "Atomic Locks Available"
                    )}
                  </p>
                </div>
              </div>

              {/* Dynamic Interaction Area based on Phase */}
              <div className="min-h-[120px] flex flex-col justify-end">
                {/* IDLE */}
                {phase === "IDLE" && stock !== null && stock > 0 && (
                  <button 
                    onClick={handleReserve} 
                    disabled={loadShedding || !connected}
                    className="w-full h-[64px] rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#00B8FF] text-[#0A0A16] font-display font-bold text-[18px] uppercase tracking-wider hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    <span>Reserve Item</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                )}

                {/* SOLD OUT */}
                {phase === "IDLE" && stock === 0 && (
                  <div className="w-full h-[64px] rounded-lg bg-[#FF00E5]/10 border border-[#FF00E5]/30 flex items-center justify-center gap-3 text-[#FF00E5]">
                    <XCircle size={24} />
                    <span className="font-display font-bold text-[18px] uppercase tracking-wider">SOLD OUT</span>
                  </div>
                )}

                {/* RESERVING & PAYING */}
                {(phase === "RESERVING" || phase === "PAYING") && (
                  <div className="w-full h-[64px] rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center gap-3 text-[#00F0FF]">
                    <Loader2 size={24} className="animate-spin" />
                    <span className="font-mono text-sm uppercase tracking-widest">{message}</span>
                  </div>
                )}

                {/* RESERVED (Awaiting Payment) */}
                {phase === "RESERVED" && (
                  <div className="w-full space-y-4 animate-slide-up">
                    <div className="flex items-center justify-between p-4 bg-black/40 border border-[#00F0FF]/30 rounded-lg shadow-[inset_0_0_20px_rgba(0,240,255,0.05)]">
                      <div className="flex items-center gap-2">
                        <Timer size={18} className="text-[#00F0FF]" />
                        <span className="text-sm text-[#F8F9FA] font-mono">Time to confirm</span>
                      </div>
                      <span className={`text-2xl font-black tabular-nums font-mono ${countdown <= 10 ? 'text-[#FF00E5] animate-pulse drop-shadow-[0_0_8px_rgba(255,0,229,0.8)]' : 'text-[#00F0FF]'}`}>
                        {countdown}s
                      </span>
                    </div>
                    
                    <button 
                      onClick={handleConfirm}
                      className="w-full h-[64px] rounded-lg bg-gradient-to-r from-[#22C55E] to-[#16a34a] text-[#0A0A16] font-display font-bold text-[18px] uppercase tracking-wider hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all duration-200 flex items-center justify-center gap-2 group"
                    >
                      <ShieldCheck size={20} />
                      <span>Confirm Purchase</span>
                    </button>
                    
                    <p className="text-center font-mono text-[10px] text-[#8F9BB3]">
                      Locked in {latency}ms via Reactive Heartbeat.
                    </p>
                  </div>
                )}

                {/* CONFIRMED */}
                {phase === "CONFIRMED" && (
                  <div className="w-full p-6 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 flex flex-col items-center justify-center text-center gap-2 animate-slide-up">
                    <ShieldCheck size={36} className="text-[#22C55E]" />
                    <span className="font-display font-bold text-[20px] text-[#22C55E] uppercase tracking-wider">Purchase Confirmed</span>
                    <span className="font-mono text-[12px] text-[#F8F9FA]">{message}</span>
                  </div>
                )}

                {/* FAILED / SOFT LANDING */}
                {phase === "FAILED" && (
                  <div className="w-full flex md:flex-row flex-col gap-4 animate-slide-up">
                    <div className="flex-1 p-6 rounded-lg bg-[#FF00E5]/10 border border-[#FF00E5]/30 flex flex-col items-center justify-center text-center gap-2">
                      <XCircle size={36} className="text-[#FF00E5]" />
                      <span className="font-display font-bold text-[20px] text-[#FF00E5] uppercase tracking-wider">Transaction Rejected</span>
                      <span className="font-mono text-[12px] text-[#F8F9FA]">{message}</span>
                    </div>
                    {recommendations.length > 0 && (
                      <div className="flex-1 p-4 rounded-lg bg-[rgba(0,240,255,0.05)] border border-[#00F0FF]/30 flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[#00F0FF] text-sm">auto_awesome</span>
                          <span className="font-mono text-[11px] text-[#00F0FF] uppercase tracking-widest">AI Top Alternatives (In Stock)</span>
                        </div>
                        {recommendations.map((rec) => (
                          <div key={rec.id} className="flex justify-between items-center p-2 rounded bg-black/40 border border-[rgba(255,255,255,0.05)] hover:border-[#00F0FF]/40 transition-colors cursor-pointer group">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-white group-hover:text-[#00F0FF] transition-colors truncate max-w-[150px]">{rec.title}</span>
                              <span className="font-mono text-[10px] text-[#8F9BB3]">Stock: {rec.inventory}</span>
                            </div>
                            <span className="font-mono text-xs text-white bg-[#00F0FF]/20 px-2 py-1 rounded">${rec.price}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t border-[rgba(255,255,255,0.1)]">
                <p className="text-center text-[#8F9BB3] font-mono text-xs uppercase tracking-widest">Secured by The Midnight Gate 5-Layer Defense</p>
                <p className="text-center text-[#8F9BB3]/50 font-mono text-[10px] uppercase tracking-widest mt-2 px-4 truncate">
                  Session Token: {checkoutToken || userId}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
