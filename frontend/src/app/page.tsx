"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { ShieldCheck, XCircle, Loader2, Clock, Wifi, WifiOff, Zap, Timer } from "lucide-react";

const API = "http://localhost:4000";

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
        setMessage("Every item has been claimed. />");
      }
    });

    socket.on("loadShedding", (data) => {
      setLoadShedding(data.active);
    });

    return () => { socket.disconnect(); };
  }, []);

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
        setMessage(data.error);
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
    <main className="min-h-screen bg-[var(--color-acm-pure)] text-white relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Grid Background */}
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      
      {/* Giant Background Text */}
      <h1 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[18vw] font-black tracking-tighter text-white/[0.015] whitespace-nowrap pointer-events-none select-none">
        MIDNIGHT
      </h1>

      {/* Connection indicator */}
      <div className="absolute top-6 right-6 flex items-center gap-2 text-xs font-mono z-20">
        {connected ? (
          <><div className="h-2 w-2 rounded-full bg-[var(--color-acm-green)] animate-pulse-glow" /><span className="text-gray-500">LINKED</span></>
        ) : (
          <><WifiOff size={12} className="text-[var(--color-acm-red)]" /><span className="text-[var(--color-acm-red)]">OFFLINE</span></>
        )}
      </div>

      {/* Main Card */}
      <div className="z-10 w-full max-w-lg glass-card p-8 flex flex-col items-center space-y-6 animate-slide-up">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-[0.2em] text-[var(--color-acm-blue)] border border-[var(--color-acm-blue)]/20 bg-[var(--color-acm-blue)]/5 rounded-full">
            <Zap size={10} />
            LIVE EVENT /&gt;
          </div>
          <h2 className="text-3xl font-bold tracking-tight">The Midnight Gate</h2>
          <p className="text-gray-500 text-xs font-mono">Reactive Heartbeat Reservation System</p>
        </div>

        {/* Inventory Display */}
        <div className="w-full p-5 bg-black/40 border border-white/[0.06] rounded-xl flex flex-col items-center space-y-1">
          <p className="text-[9px] text-gray-600 font-mono tracking-[0.3em] uppercase">Atomic Inventory Lock</p>
          <div className="text-5xl font-black tabular-nums tracking-tighter text-white animate-count-pulse">
            {stock !== null ? stock : "—"}
          </div>
          <p className="text-[11px] text-gray-500">
            {reservedCount > 0 && <span className="text-[var(--color-acm-yellow)]">{reservedCount} in checkout</span>}
            {reservedCount === 0 && "Available worldwide"}
          </p>
        </div>

        {/* Load Shedding Banner */}
        {loadShedding && (
          <div className="w-full p-3 bg-[var(--color-acm-yellow)]/10 border border-[var(--color-acm-yellow)]/30 rounded-lg text-center text-[var(--color-acm-yellow)] text-xs font-mono animate-pulse">
            ⚠️ System under pressure. Requests throttled.
          </div>
        )}

        {/* ---- PHASE: IDLE ---- */}
        {phase === "IDLE" && stock !== null && stock > 0 && (
          <button onClick={handleReserve} disabled={loadShedding}
            className="w-full py-4 bg-[var(--color-acm-blue)] hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 active:scale-[0.97] glow-blue text-sm tracking-wide">
            SECURE TICKET /&gt;
          </button>
        )}

        {phase === "IDLE" && stock === 0 && (
          <div className="flex flex-col items-center text-[var(--color-acm-red)] font-mono gap-2">
            <XCircle size={28} />
            <span className="text-sm font-bold">SOLD OUT</span>
          </div>
        )}

        {/* ---- PHASE: RESERVING ---- */}
        {phase === "RESERVING" && (
          <div className="flex flex-col items-center gap-2 text-[var(--color-acm-blue)] font-mono text-sm">
            <Loader2 size={24} className="animate-spin" />
            {message}
          </div>
        )}

        {/* ---- PHASE: RESERVED (Pending Payment) ---- */}
        {phase === "RESERVED" && (
          <div className="w-full space-y-4 animate-slide-up">
            {/* Heartbeat Warning */}
            <div className="flex items-center gap-2 p-3 bg-[var(--color-acm-cyan)]/5 border border-[var(--color-acm-cyan)]/20 rounded-lg text-[var(--color-acm-cyan)] text-[10px] font-mono">
              <Wifi size={12} className="animate-pulse-glow shrink-0" />
              <span>Heartbeat active. Closing this tab releases your item instantly.</span>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-between p-4 bg-black/40 border border-white/[0.06] rounded-xl">
              <div className="flex items-center gap-2">
                <Timer size={16} className="text-[var(--color-acm-yellow)]" />
                <span className="text-xs text-gray-400 font-mono">Time to pay</span>
              </div>
              <span className={`text-2xl font-black tabular-nums ${countdown <= 10 ? 'text-[var(--color-acm-red)] animate-pulse' : 'text-white'}`}>
                {countdown}s
              </span>
            </div>

            {/* Latency badge */}
            <div className="text-center text-[10px] text-gray-600 font-mono">
              Reserved in {latency}ms · Token: {checkoutToken.substring(0, 8)}
            </div>

            {/* Pay Button */}
            <button onClick={handleConfirm}
              className="w-full py-4 bg-[var(--color-acm-green)] hover:bg-green-500 text-black font-bold rounded-xl transition-all duration-200 active:scale-[0.97] glow-green text-sm tracking-wide">
              CONFIRM PAYMENT /&gt;
            </button>
          </div>
        )}

        {/* ---- PHASE: PAYING ---- */}
        {phase === "PAYING" && (
          <div className="flex flex-col items-center gap-2 text-[var(--color-acm-green)] font-mono text-sm">
            <Loader2 size={24} className="animate-spin" />
            {message}
          </div>
        )}

        {/* ---- PHASE: CONFIRMED ---- */}
        {phase === "CONFIRMED" && (
          <div className="w-full text-center space-y-3 animate-slide-up">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-acm-green)]/10 border border-[var(--color-acm-green)]/30">
              <ShieldCheck size={28} className="text-[var(--color-acm-green)]" />
            </div>
            <p className="text-[var(--color-acm-green)] font-bold text-lg">CONFIRMED</p>
            <p className="text-gray-500 text-xs font-mono">{message}</p>
          </div>
        )}

        {/* ---- PHASE: FAILED ---- */}
        {phase === "FAILED" && (
          <div className="w-full text-center space-y-3 animate-slide-up">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-acm-red)]/10 border border-[var(--color-acm-red)]/30">
              <XCircle size={28} className="text-[var(--color-acm-red)]" />
            </div>
            <p className="text-[var(--color-acm-red)] font-bold">REJECTED</p>
            <p className="text-gray-500 text-xs font-mono">{message}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-[10px] font-mono text-gray-700 z-10">
        session: {userId} · socket: {socketRef.current?.id?.substring(0, 6) || "..."}
      </div>
    </main>
  );
}
