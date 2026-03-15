"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import { 
  ShieldAlert, 
  RotateCcw, 
  Wifi, 
  Box, 
  Layers, 
  CheckCircle2, 
  TerminalSquare, 
  AlertTriangle, 
  Server, 
  Activity 
} from "lucide-react";

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

  const isQueueCritical = queueLength > 20;
  // Calculate system capacity logic for the gauge (if queue gets full)
  const capacityPct = Math.min(100, Math.round(((queueLength + activeUsers) / 5000) * 100) || 5);

  const eventLabel: Record<string, { text: string; color: string }> = {
    RESERVED: { text: "ITEM RESERVED", color: "text-[#00F0FF]" },
    CONFIRMED: { text: "ORDER CONFIRMED", color: "text-[#22C55E]" },
    HEARTBEAT_RELEASE: { text: "HEARTBEAT DROP", color: "text-[#8F9BB3]" },
    TTL_RELEASE: { text: "TTL EXPIRED", color: "text-[#EAB308]" },
    LOAD_SHEDDING_ON: { text: "LOAD SHEDDING", color: "text-[#FF00E5] font-bold animate-pulse" },
    LOAD_SHEDDING_OFF: { text: "LIMITER OFF", color: "text-[#22C55E]" },
    SYSTEM_RESET: { text: "SYSTEM RESET", color: "text-[#A855F7]" },
  };

  return (
    <div className="bg-[#0A0A16] text-[#F8F9FA] font-body min-h-screen overflow-x-hidden relative selection:bg-[#00F0FF]/30 selection:text-white">
      {/* Background Gradient */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(45,11,89,0.5)_0%,rgba(10,10,22,1)_70%)] z-0"></div>
      
      {/* Alert Border Overlay (Simulated Under Load State) */}
      {loadShedding && (
        <div className="fixed inset-0 pointer-events-none border-[3px] border-[#FF00E5] animate-[pulseAlert_2s_infinite] opacity-50 z-50"></div>
      )}

      <div className="relative z-10 flex flex-col h-full min-h-screen">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-8 py-4 backdrop-blur-[16px] bg-[#0A0A16]/50 sticky top-0 z-40 gap-4">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="size-8 text-[#00F0FF] flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[32px]">security</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#F8F9FA]">
              Midnight Gate War Room
            </h1>
          </Link>
          
          <div className="flex items-center gap-6">
            {loadShedding ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF00E5] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF00E5]"></span>
                </span>
                <span className="font-mono text-[13px] text-[#FF00E5] font-medium tracking-wide">LOAD SHEDDING ACTIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
                <span className="font-mono text-[13px] text-gray-500 tracking-wide uppercase">System Secure</span>
              </div>
            )}
            
            <nav className="hidden md:flex gap-6 font-display text-sm font-medium text-[#8F9BB3]">
              <Link href="/drop" className="hover:text-[#00F0FF] transition-colors rounded py-1 px-3 border border-transparent hover:border-[#00F0FF]/30">Live Drop Simulator</Link>
            </nav>
          </div>
        </header>

        {/* Main Content Grid */}
        <main className="flex-1 p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
          
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric 1 */}
            <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[#00F0FF]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <p className="text-[#8F9BB3] text-sm font-medium flex items-center gap-2">
                <Wifi size={16} /> Active WS Connections
              </p>
              <p className="font-mono text-[32px] font-bold text-[#00F0FF] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
                {activeUsers}
              </p>
              <div className="h-1 w-full bg-[rgba(255,255,255,0.1)] mt-2 rounded-full overflow-hidden">
                <div className="h-full bg-[#00F0FF] rounded-full shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all duration-500" style={{ width: `${Math.min(100, (activeUsers / 5000) * 100)}%` }}></div>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-2">
              <p className="text-[#8F9BB3] text-sm font-medium flex items-center gap-2">
                <Box size={16} /> Available Inventory
              </p>
              <p className="font-mono text-[32px] font-bold text-[#00F0FF] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
                {stock !== null ? stock : "—"}
              </p>
              <p className="font-mono text-[12px] text-[#A855F7]">Atomic Lua Gate Active</p>
            </div>

            {/* Metric 3 (Alert State) */}
            <div className={`bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-2 relative overflow-hidden ${isQueueCritical ? 'border-[#FF00E5]/50 shadow-[0_0_30px_rgba(255,0,229,0.3)]' : 'border-[rgba(255,255,255,0.1)]'}`}>
              {isQueueCritical && <div className="absolute inset-0 bg-[#FF00E5]/10 animate-pulse"></div>}
              <p className="text-[#8F9BB3] text-sm font-medium flex items-center gap-2 relative z-10">
                <Layers size={16} className={isQueueCritical ? "text-[#FF00E5]" : ""} /> BullMQ Queue Depth
              </p>
              <p className={`font-mono text-[32px] font-bold relative z-10 ${isQueueCritical ? 'text-[#FF00E5] drop-shadow-[0_0_10px_rgba(255,0,229,0.5)]' : 'text-white'}`}>
                {queueLength}
              </p>
              <p className={`font-mono text-[12px] relative z-10 ${isQueueCritical ? 'text-[#FF00E5]' : 'text-[#8F9BB3]'}`}>
                {isQueueCritical ? "> 20 Threshold Exceeded" : "Healthy. Under 20 threshold."}
              </p>
            </div>

            {/* Metric 4 */}
            <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-2">
              <p className="text-[#8F9BB3] text-sm font-medium flex items-center gap-2">
                <CheckCircle2 size={16} /> Total Processed
              </p>
              <p className="font-mono text-[32px] font-bold text-[#00F0FF] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
                {confirmedCount + reservedCount}
              </p>
              <p className="font-mono text-[12px] text-[#8F9BB3]">{rps} Requests per Second (RPS)</p>
            </div>
          </div>

          {/* Lower Split Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
            
            {/* Terminal Logs (Left 2/3) */}
            <div className="lg:col-span-2 bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
              <div className="bg-black/40 border-b border-[rgba(255,255,255,0.1)] px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TerminalSquare size={16} className="text-[#8F9BB3]" />
                  <span className="font-mono text-[12px] text-[#8F9BB3] tracking-wider">gate-worker-node-01.log</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="size-2.5 rounded-full bg-[rgba(255,255,255,0.1)]"></div>
                  <div className="size-2.5 rounded-full bg-[rgba(255,255,255,0.1)]"></div>
                  <div className="size-2.5 rounded-full bg-[#FF00E5]"></div>
                </div>
              </div>
              
              <div className="flex-1 bg-[#05050A] p-4 font-mono text-[13px] leading-relaxed overflow-hidden relative flex flex-col">
                <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-[#05050A] to-transparent z-10 pointer-events-none"></div>
                <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#05050A] to-transparent z-10 pointer-events-none"></div>
                
                <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar h-full justify-end pr-2 pb-2">
                  {activityLog.length === 0 && (
                    <div className="text-[#8F9BB3] text-center my-auto">Awaiting traffic spikes...</div>
                  )}
                  {activityLog.slice().reverse().map((event) => {
                    const label = eventLabel[event.type] || { text: event.type, color: "text-[#8F9BB3]" };
                    const time = new Date(event.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
                    
                    if (event.type.includes("LOAD_SHEDDING")) {
                      return (
                         <div key={event.id} className="text-[#FF00E5] font-bold drop-shadow-[0_0_10px_rgba(255,0,229,0.5)] mt-1 animate-slide-up">
                           [{time}] ALERT {label.text}. Limiter active.
                         </div>
                      );
                    }
                    
                    return (
                      <div key={event.id} className="flex gap-3 text-sm animate-slide-up">
                        <span className="text-[#8F9BB3]/70 shrink-0">[{time}]</span>
                        <span className={`shrink-0 ${label.color}`}>{label.text}</span>
                        <span className="text-[#8F9BB3] truncate">
                          {event.userId && `(user: ${event.userId}) `}
                          {event.latency && `locked in ${event.latency}ms`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Side Panels */}
            <div className="flex flex-col gap-6">
              
              {/* Gauge Card */}
              <div className={`bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border rounded-xl shadow-glass p-6 flex-1 flex flex-col items-center justify-center relative ${loadShedding ? 'border-[#FF00E5]/30 shadow-[0_0_30px_rgba(255,0,229,0.3)]' : 'border-[rgba(255,255,255,0.1)]'}`}>
                <h3 className="font-display text-lg font-bold text-[#F8F9FA] absolute top-6 left-6">Capacity Status</h3>
                
                <div className="relative size-48 mt-8 flex items-center justify-center">
                  <svg className="absolute inset-0 size-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" fill="none" r="45" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeDasharray="283" strokeLinecap="round"></circle>
                    <circle 
                      cx="50" cy="50" fill="none" r="45" 
                      stroke={loadShedding ? "#FF00E5" : "#00F0FF"} 
                      strokeWidth="8" strokeDasharray="283" 
                      strokeDashoffset={283 - (283 * capacityPct) / 100} 
                      strokeLinecap="round"
                      className={`transition-all duration-1000 ${loadShedding ? 'drop-shadow-[0_0_8px_rgba(255,0,229,0.8)]' : 'drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]'}`}
                    ></circle>
                  </svg>
                  <div className="flex flex-col items-center justify-center text-center">
                    {loadShedding ? (
                      <AlertTriangle size={32} className="text-[#FF00E5] mb-1 animate-[pulseAlert_2s_infinite]" />
                    ) : (
                      <Activity size={32} className="text-[#00F0FF] mb-1" />
                    )}
                    <span className={`font-mono text-3xl font-bold ${loadShedding ? 'text-[#FF00E5]' : 'text-white'}`}>{capacityPct}%</span>
                    <span className="font-mono text-[10px] text-[#8F9BB3] uppercase tracking-widest mt-1">Load</span>
                  </div>
                </div>

                {loadShedding ? (
                  <div className="mt-8 w-full bg-[#FF00E5]/10 border border-[#FF00E5]/30 rounded p-3 flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#FF00E5] text-[20px] shrink-0">info</span>
                    <div className="flex flex-col">
                      <span className="font-mono text-[12px] text-[#FF00E5] font-bold">SHEDDING ACTIVE</span>
                      <span className="font-mono text-[11px] text-[#8F9BB3] mt-1">Rejecting ~{rps} req/sec at Edge to protect database consistency.</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 w-full border border-[rgba(255,255,255,0.1)] rounded p-3 flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#22C55E] text-[20px] shrink-0">check_circle</span>
                    <div className="flex flex-col">
                      <span className="font-mono text-[12px] text-[#22C55E] font-bold">SYSTEM NOMINAL</span>
                      <span className="font-mono text-[11px] text-[#8F9BB3] mt-1">Infrastructure ready to absorb high-velocity connection spikes.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls and DB Info Card */}
              <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-5 h-auto">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-display text-sm font-bold text-[#F8F9FA] flex items-center gap-2"><Server size={14}/> Node Controls</h4>
                  <span className="font-mono text-[12px] text-[#22C55E]">Healthy</span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-[#8F9BB3] shrink-0 font-mono">Restock:</label>
                    <input 
                      type="number" 
                      value={initialInventory} 
                      onChange={e => setInitialInventory(parseInt(e.target.value) || 10)}
                      className="w-full px-3 py-1.5 bg-black/40 border border-[rgba(255,255,255,0.1)] rounded text-white text-sm font-mono focus:outline-none focus:border-[#00F0FF]/50" 
                    />
                    <button 
                      onClick={handleReset}
                      className="shrink-0 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 p-1.5 rounded transition-colors"
                      title="Reset Database"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#8F9BB3]">PostgreSQL-Core</span>
                      <span className="font-mono text-[10px] text-[#F8F9FA]">{(latencyDelay("pg"))}ms</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-[10px] text-[#8F9BB3]">Redis-In-Memory-Gate</span>
                      <span className="font-mono text-[10px] text-[#00F0FF]">{(latencyDelay("redis"))}ms</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Just for visual effect to mimic constant DB latency flux
function latencyDelay(db: string) {
  if (db === "pg") return Math.floor(Math.random() * 5) + 12;
  return Math.floor(Math.random() * 2) + 1; // redis is extremely fast 1-3ms
}
