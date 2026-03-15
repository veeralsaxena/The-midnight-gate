"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { ShieldAlert, Box, Users, DatabaseZap, Layers, Gauge, Activity, RotateCcw, Zap, Wifi, Timer, ArrowUpRight, ArrowDownRight } from "lucide-react";

const API = "http://localhost:4000";

interface ActivityEvent {
  id: number;
  type: string;
  userId?: string;
  timestamp: number;
  latency?: number;
}

export default function WarRoom() {
  const socketRef = useRef<Socket | null>(null);
  const [stock, setStock] = useState<number | null>(null);
  const [reservedCount, setReservedCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [queueLength, setQueueLength] = useState(0);
  const [rps, setRps] = useState(0);
  const [loadShedding, setLoadShedding] = useState(false);
  const [systemStatus, setSystemStatus] = useState("SECURE");
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [initialInventory, setInitialInventory] = useState(10);
  const eventIdRef = useRef(0);

  const addActivity = (event: Omit<ActivityEvent, "id">) => {
    eventIdRef.current++;
    setActivityLog(prev => [{ ...event, id: eventIdRef.current }, ...prev].slice(0, 50));
  };

  // Socket + Polling
  useEffect(() => {
    const socket = io(API);
    socketRef.current = socket;

    socket.on("inventoryUpdate", (data) => {
      setStock(data.remainingStock);
      setReservedCount(data.reservedCount || 0);
      setConfirmedCount(data.confirmedCount || 0);
    });

    socket.on("connectionUpdate", (data) => {
      setActiveUsers(data.activeUsers);
    });

    socket.on("activityEvent", (event) => {
      addActivity(event);

      // Flash status based on event type
      if (event.type === "RESERVED") setSystemStatus("HERD DETECTED");
      if (event.type === "HEARTBEAT_RELEASE") setSystemStatus("HEARTBEAT RECLAIM");
      if (event.type === "TTL_RELEASE") setSystemStatus("TTL RECLAIM");
      if (event.type === "SYSTEM_RESET") setSystemStatus("RESET");

      setTimeout(() => setSystemStatus("SECURE"), 1500);
    });

    socket.on("loadShedding", (data) => {
      setLoadShedding(data.active);
      if (data.active) setSystemStatus("LOAD SHEDDING");
      else setTimeout(() => setSystemStatus("SECURE"), 1000);
    });

    socket.on("soldOut", () => {
      setSystemStatus("INVENTORY DEPLETED");
    });

    // Poll metrics every second for RPS and queue depth
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/admin/metrics`);
        const data = await res.json();
        setRps(data.requestsPerSecond || 0);
        setQueueLength(data.queueLength || 0);
        if (data.stock !== undefined) setStock(data.stock);
        setReservedCount(data.reservedCount || 0);
        setConfirmedCount(data.confirmedCount || 0);
        setActiveUsers(data.activeConnections || 0);
      } catch {}
    }, 1000);

    return () => { socket.disconnect(); clearInterval(poll); };
  }, []);

  // INITIAL FETCH
  useEffect(() => {
    fetch(`${API}/api/inventory/1`).then(r => r.json()).then(d => {
      setStock(d.stock); setReservedCount(d.reservedCount || 0); setConfirmedCount(d.confirmedCount || 0);
    }).catch(() => {});
  }, []);

  const handleReset = async () => {
    await fetch(`${API}/api/admin/reset`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventory: initialInventory }),
    });
  };

  // Calculate inventory bar percentages
  const total = initialInventory || 10;
  const confirmedPct = (confirmedCount / total) * 100;
  const reservedPct = (reservedCount / total) * 100;
  const availablePct = Math.max(0, ((stock || 0) / total) * 100);

  const statusColor = 
    systemStatus === "SECURE" ? "text-[var(--color-acm-green)] border-[var(--color-acm-green)]/30 bg-[var(--color-acm-green)]/5" :
    systemStatus === "INVENTORY DEPLETED" ? "text-[var(--color-acm-red)] border-[var(--color-acm-red)]/30 bg-[var(--color-acm-red)]/5" :
    systemStatus === "LOAD SHEDDING" ? "text-[var(--color-acm-red)] border-[var(--color-acm-red)]/30 bg-[var(--color-acm-red)]/5 animate-pulse" :
    "text-[var(--color-acm-yellow)] border-[var(--color-acm-yellow)]/30 bg-[var(--color-acm-yellow)]/5";

  const eventLabel: Record<string, { text: string; color: string }> = {
    RESERVED: { text: "ITEM RESERVED", color: "text-[var(--color-acm-blue)]" },
    CONFIRMED: { text: "ORDER CONFIRMED", color: "text-[var(--color-acm-green)]" },
    HEARTBEAT_RELEASE: { text: "HEARTBEAT RELEASE", color: "text-[var(--color-acm-cyan)]" },
    TTL_RELEASE: { text: "TTL EXPIRED", color: "text-[var(--color-acm-yellow)]" },
    LOAD_SHEDDING_ON: { text: "LOAD SHEDDING ON", color: "text-[var(--color-acm-red)]" },
    LOAD_SHEDDING_OFF: { text: "LOAD SHEDDING OFF", color: "text-[var(--color-acm-green)]" },
    SYSTEM_RESET: { text: "SYSTEM RESET", color: "text-[var(--color-acm-purple)]" },
  };

  return (
    <div className="min-h-screen bg-[var(--color-acm-pure)] text-white font-mono relative">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
        
        {/* ===== HEADER ===== */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/[0.06] pb-5">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert size={20} className="text-[var(--color-acm-blue)]" />
              THE MIDNIGHT GATE: WAR ROOM /&gt;
            </h1>
            <p className="text-gray-600 text-xs mt-1">
              Reactive Heartbeat · Pressure-Adaptive Load Shedding · Atomic Lua Gate
            </p>
          </div>
          <div className={`px-4 py-2 rounded-full border text-[10px] font-bold tracking-[0.15em] ${statusColor}`}>
            {systemStatus}
          </div>
        </div>

        {/* ===== 6-CARD METRICS GRID ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* 1. Inventory */}
          <div className="metric-card">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] text-gray-500 tracking-[0.2em] uppercase">Available Stock</span>
              <Box size={16} className="text-gray-600" />
            </div>
            <div className="text-5xl font-black tabular-nums tracking-tighter text-[var(--color-acm-blue)]">
              {stock !== null ? stock : "—"}
            </div>
          </div>

          {/* 2. Reserved */}
          <div className="metric-card">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] text-gray-500 tracking-[0.2em] uppercase">In Checkout</span>
              <Timer size={16} className="text-gray-600" />
            </div>
            <div className="text-5xl font-black tabular-nums tracking-tighter text-[var(--color-acm-yellow)]">
              {reservedCount}
            </div>
          </div>

          {/* 3. Confirmed */}
          <div className="metric-card">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] text-gray-500 tracking-[0.2em] uppercase">Confirmed Orders</span>
              <Zap size={16} className="text-gray-600" />
            </div>
            <div className="text-5xl font-black tabular-nums tracking-tighter text-[var(--color-acm-green)]">
              {confirmedCount}
            </div>
          </div>

          {/* 4. Active Connections */}
          <div className="metric-card">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] text-gray-500 tracking-[0.2em] uppercase">Live Connections</span>
              <Users size={16} className="text-gray-600" />
            </div>
            <div className="text-5xl font-black tabular-nums tracking-tighter text-white">
              {activeUsers}
            </div>
          </div>

          {/* 5. Queue Depth */}
          <div className="metric-card">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] text-gray-500 tracking-[0.2em] uppercase">Queue Depth</span>
              <Layers size={16} className="text-gray-600" />
            </div>
            <div className={`text-5xl font-black tabular-nums tracking-tighter ${queueLength > 15 ? 'text-[var(--color-acm-red)]' : 'text-white'}`}>
              {queueLength}
            </div>
          </div>

          {/* 6. RPS */}
          <div className="metric-card">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] text-gray-500 tracking-[0.2em] uppercase">Requests/sec</span>
              <Gauge size={16} className="text-gray-600" />
            </div>
            <div className="text-5xl font-black tabular-nums tracking-tighter text-[var(--color-acm-cyan)]">
              {rps}
            </div>
          </div>
        </div>

        {/* ===== INVENTORY BAR ===== */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span className="tracking-[0.15em] uppercase">Inventory Distribution</span>
            <span>{total} total</span>
          </div>
          <div className="w-full h-6 rounded-lg bg-white/[0.03] border border-white/[0.06] flex overflow-hidden">
            <div className="bg-[var(--color-acm-green)] transition-all duration-500 ease-out" style={{ width: `${confirmedPct}%` }} />
            <div className="bg-[var(--color-acm-yellow)] transition-all duration-500 ease-out" style={{ width: `${reservedPct}%` }} />
            <div className="bg-[var(--color-acm-blue)]/30 transition-all duration-500 ease-out" style={{ width: `${availablePct}%` }} />
          </div>
          <div className="flex gap-6 text-[10px]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--color-acm-green)]" />Confirmed ({confirmedCount})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--color-acm-yellow)]" />Reserved ({reservedCount})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--color-acm-blue)]/50" />Available ({stock || 0})</span>
          </div>
        </div>

        {/* ===== BOTTOM ROW: ACTIVITY FEED + CONTROLS ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          
          {/* Activity Feed (3 cols) */}
          <div className="lg:col-span-3 glass-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 tracking-[0.15em] uppercase">
              <Activity size={14} />
              Live Activity Feed
            </div>
            <div className="space-y-1 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
              {activityLog.length === 0 && (
                <p className="text-gray-700 text-xs py-4 text-center">Waiting for events...</p>
              )}
              {activityLog.map((event) => {
                const label = eventLabel[event.type] || { text: event.type, color: "text-gray-400" };
                const time = new Date(event.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                return (
                  <div key={event.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-[11px] animate-slide-up">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600 tabular-nums">{time}</span>
                      <span className={`font-bold tracking-wide ${label.color}`}>{label.text}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      {event.userId && <span>user:{event.userId}</span>}
                      {event.latency && <span className="text-[var(--color-acm-cyan)]">{event.latency}ms</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controls Panel (2 cols) */}
          <div className="lg:col-span-2 glass-card p-5 space-y-4">
            <span className="text-xs text-gray-500 tracking-[0.15em] uppercase">Demo Controls</span>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 shrink-0">Inventory:</label>
                <input type="number" value={initialInventory} onChange={e => setInitialInventory(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.06] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[var(--color-acm-blue)]/50" />
              </div>

              <button onClick={handleReset}
                className="w-full py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                <RotateCcw size={14} />
                RESET SYSTEM
              </button>
            </div>

            <div className="p-3 bg-[var(--color-acm-blue)]/5 border border-[var(--color-acm-blue)]/20 rounded-lg text-[10px] text-[var(--color-acm-blue)] leading-relaxed">
              <span className="font-bold">Demo: </span>
              Run <code className="bg-black px-1.5 py-0.5 rounded text-white mx-0.5">node load-test/load.js</code> in another terminal to simulate 5000 concurrent users hitting the gate. Watch the metrics react in real-time.
            </div>

            {/* Load Shedding Status */}
            <div className={`p-3 rounded-lg border text-[10px] font-bold tracking-widest text-center ${
              loadShedding 
                ? "bg-[var(--color-acm-red)]/10 border-[var(--color-acm-red)]/30 text-[var(--color-acm-red)] animate-pulse" 
                : "bg-[var(--color-acm-green)]/5 border-[var(--color-acm-green)]/20 text-[var(--color-acm-green)]"
            }`}>
              {loadShedding ? "⚠️ LOAD SHEDDING ACTIVE" : "✅ SYSTEM NOMINAL"}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
