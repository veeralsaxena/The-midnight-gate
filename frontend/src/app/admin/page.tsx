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
  Activity,
  History,
  Rocket,
  Clock
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ActivityEvent {
  id: number;
  type: string;
  userId?: string;
  timestamp: number;
  latency?: number;
}

interface SimulationRun {
  id: number;
  total_users: number;
  inventory: number;
  abandon_rate: string;
  reserved: number;
  confirmed: number;
  rejected: number;
  abandoned: number;
  heartbeat_released: number;
  duration_ms: number;
  created_at: string;
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
  
  // Simulation tracking
  const [simRunning, setSimRunning] = useState(false);
  const [simStats, setSimStats] = useState<{reserved: number, confirmed: number, rejected: number, abandoned: number} | null>(null);
  
  // Previous launches
  const [previousRuns, setPreviousRuns] = useState<SimulationRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Agentic AI Chat State
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState<{role: string, text: string}[]>([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  
  const eventIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, isAgentTyping]);

  const addActivity = (event: Omit<ActivityEvent, "id">) => {
    eventIdRef.current++;
    setActivityLog(prev => [{ ...event, id: eventIdRef.current }, ...prev].slice(0, 80));
  };

  // Fetch previous launches
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/api/simulate/history`);
      const data = await res.json();
      setPreviousRuns(data.runs || []);
    } catch {}
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

    socket.on("soldOut", () => { setSystemStatus("INVENTORY DEPLETED"); });

    // Listen for simulation events (from the simulator page)
    socket.on("simulationEvent", (event) => {
      switch (event.phase) {
        case "START":
          setSimRunning(true);
          setSystemStatus("HERD SIMULATION");
          setSimStats(null);
          addActivity({ type: "SIM_START", timestamp: Date.now() });
          break;
        case "PHASE_REDIS_GATE":
          addActivity({ type: "SIM_RESERVE", timestamp: Date.now(), latency: event.reserved });
          break;
        case "PHASE_POSTGRES":
          addActivity({ type: "SIM_CONFIRM", timestamp: Date.now(), latency: event.written });
          break;
        case "PHASE_HEARTBEAT_RELEASE":
          addActivity({ type: "SIM_HEARTBEAT", timestamp: Date.now(), latency: event.released });
          break;
        case "COMPLETE":
          setSimRunning(false);
          setSystemStatus("SIMULATION COMPLETE");
          if (event.stats) {
            setSimStats({
              reserved: event.stats.redisReserved,
              confirmed: event.stats.postgresWritten,
              rejected: event.stats.redisRejected,
              abandoned: event.stats.abandoned,
            });
          }
          addActivity({ type: "SIM_COMPLETE", timestamp: Date.now() });
          // Refresh history after a short delay (to let DB write complete)
          setTimeout(() => fetchHistory(), 1000);
          setTimeout(() => setSystemStatus("SECURE"), 3000);
          break;
        case "ERROR":
          setSimRunning(false);
          setSystemStatus("SIMULATION ERROR");
          addActivity({ type: "SIM_ERROR", timestamp: Date.now() });
          break;
      }
    });

    // Poll metrics
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

    // Fetch history on mount
    fetchHistory();

    return () => { socket.disconnect(); clearInterval(poll); };
  }, []);

  // Initial fetch
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

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isAgentTyping) return;
    
    setChatLog(prev => [...prev, { role: "user", text: prompt }]);
    const currentPrompt = prompt;
    setPrompt("");
    setIsAgentTyping(true);

    try {
      const res = await fetch(`${API}/api/admin/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt })
      });
      const data = await res.json();
      setChatLog(prev => [...prev, { role: "agent", text: data.reply || data.error }]);
    } catch (err) {
      setChatLog(prev => [...prev, { role: "agent", text: "Agent communication failed." }]);
    }
    setIsAgentTyping(false);
  };

  const isQueueCritical = queueLength > 20;
  const capacityPct = Math.min(100, Math.round(((queueLength + activeUsers) / 5000) * 100) || 5);

  const eventLabel: Record<string, { text: string; color: string }> = {
    RESERVED: { text: "ITEM RESERVED", color: "text-[#00F0FF]" },
    CONFIRMED: { text: "ORDER CONFIRMED", color: "text-[#22C55E]" },
    HEARTBEAT_RELEASE: { text: "HEARTBEAT DROP", color: "text-[#8F9BB3]" },
    TTL_RELEASE: { text: "TTL EXPIRED", color: "text-[#EAB308]" },
    LOAD_SHEDDING_ON: { text: "LOAD SHEDDING", color: "text-[#FF00E5] font-bold animate-pulse" },
    LOAD_SHEDDING_OFF: { text: "LIMITER OFF", color: "text-[#22C55E]" },
    SYSTEM_RESET: { text: "SYSTEM RESET", color: "text-[#A855F7]" },
    SIM_START: { text: "🚀 SIMULATION STARTED", color: "text-[#00F0FF] font-bold" },
    SIM_RESERVE: { text: "⚡ SIM RESERVE", color: "text-[#3B82F6]" },
    SIM_CONFIRM: { text: "✅ SIM CONFIRM", color: "text-[#22C55E]" },
    SIM_HEARTBEAT: { text: "💔 SIM RELEASE", color: "text-[#EAB308]" },
    SIM_COMPLETE: { text: "🏁 SIMULATION DONE", color: "text-[#22C55E] font-bold" },
    SIM_ERROR: { text: "❌ SIM ERROR", color: "text-[#EF4444] font-bold" },
  };

  return (
    <div className="bg-[#0A0A16] text-[#F8F9FA] font-body min-h-screen overflow-x-hidden relative selection:bg-[#00F0FF]/30 selection:text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(45,11,89,0.5)_0%,rgba(10,10,22,1)_70%)] z-0"></div>
      
      {loadShedding && (
        <div className="fixed inset-0 pointer-events-none border-[3px] border-[#FF00E5] animate-[pulseAlert_2s_infinite] opacity-50 z-50"></div>
      )}

      <div className="relative z-10 flex flex-col h-full min-h-screen pt-16">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-8 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#F8F9FA]">
              War Room
            </h2>
            {simRunning && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F0FF] opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00F0FF]" /></span>
                <span className="font-mono text-[10px] text-[#00F0FF] uppercase tracking-wider">Simulation Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[#8F9BB3] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-all font-mono text-[11px]"
            >
              <History size={14} /> Previous Launches
            </button>
            <Link
              href="/simulation"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-all font-mono text-[11px] font-bold"
            >
              <Rocket size={14} /> Open Simulator
            </Link>
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
                <span className="font-mono text-[13px] text-gray-500 tracking-wide uppercase">{systemStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Previous Launches Panel */}
        {showHistory && (
          <div className="px-8 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                <History size={16} className="text-[#A855F7]" /> Previous Simulation Launches
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-[#8F9BB3] hover:text-white text-sm">✕</button>
            </div>
            {previousRuns.length === 0 ? (
              <p className="text-[#8F9BB3] font-mono text-xs">No previous runs yet. Launch a simulation from the Simulator page.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-[11px]">
                  <thead>
                    <tr className="text-[#8F9BB3] border-b border-[rgba(255,255,255,0.06)]">
                      <th className="text-left py-2 pr-4">#</th>
                      <th className="text-left py-2 pr-4">Users</th>
                      <th className="text-left py-2 pr-4">Inventory</th>
                      <th className="text-left py-2 pr-4">Abandon</th>
                      <th className="text-left py-2 pr-4 text-[#3B82F6]">Reserved</th>
                      <th className="text-left py-2 pr-4 text-[#22C55E]">Confirmed</th>
                      <th className="text-left py-2 pr-4 text-[#FF00E5]">Rejected</th>
                      <th className="text-left py-2 pr-4 text-[#EAB308]">Released</th>
                      <th className="text-left py-2 pr-4">Duration</th>
                      <th className="text-left py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previousRuns.map((run) => (
                      <tr key={run.id} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="py-2 pr-4 text-[#8F9BB3]">{run.id}</td>
                        <td className="py-2 pr-4 text-white font-bold">{run.total_users.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-white">{run.inventory}</td>
                        <td className="py-2 pr-4 text-[#FF00E5]">{Math.round(parseFloat(run.abandon_rate) * 100)}%</td>
                        <td className="py-2 pr-4 text-[#3B82F6] font-bold">{run.reserved}</td>
                        <td className="py-2 pr-4 text-[#22C55E] font-bold">{run.confirmed}</td>
                        <td className="py-2 pr-4 text-[#FF00E5]">{run.rejected.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-[#EAB308]">{run.heartbeat_released}</td>
                        <td className="py-2 pr-4 text-[#8F9BB3]">{run.duration_ms}ms</td>
                        <td className="py-2 text-[#8F9BB3]">{new Date(run.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Simulation Stats Banner (when simulation completes) */}
        {simStats && (
          <div className="mx-8 mt-4 p-4 rounded-xl bg-[#22C55E]/5 border border-[#22C55E]/20 flex items-center gap-6 animate-slide-up">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-[#22C55E]" />
              <span className="font-display text-sm font-bold text-[#22C55E]">Last Simulation</span>
            </div>
            <div className="flex gap-4 ml-auto">
              <span className="font-mono text-xs"><span className="text-[#3B82F6] font-bold">{simStats.reserved}</span> reserved</span>
              <span className="font-mono text-xs"><span className="text-[#22C55E] font-bold">{simStats.confirmed}</span> confirmed</span>
              <span className="font-mono text-xs"><span className="text-[#FF00E5] font-bold">{simStats.rejected.toLocaleString()}</span> rejected</span>
              <span className="font-mono text-xs"><span className="text-[#EAB308] font-bold">{simStats.abandoned}</span> abandoned</span>
            </div>
            <button onClick={() => setSimStats(null)} className="text-[#8F9BB3] hover:text-white text-xs ml-4">✕</button>
          </div>
        )}

        {/* Main Content Grid */}
        <main className="flex-1 p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
          
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric 1: Active Connections */}
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
              <p className="font-mono text-[10px] text-[#8F9BB3]">Live WebSocket connections to the server</p>
            </div>

            {/* Metric 2: Inventory */}
            <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-2">
              <p className="text-[#8F9BB3] text-sm font-medium flex items-center gap-2">
                <Box size={16} /> Available Inventory (Redis)
              </p>
              <p className="font-mono text-[32px] font-bold text-[#00F0FF] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
                {stock !== null ? stock : "—"}
              </p>
              <div className="flex gap-3 font-mono text-[11px]">
                <span className="text-[#3B82F6]">Reserved: {reservedCount}</span>
                <span className="text-[#22C55E]">Confirmed: {confirmedCount}</span>
              </div>
              <p className="font-mono text-[10px] text-[#8F9BB3]">Live stock count from Redis atomic gate</p>
            </div>

            {/* Metric 3: Queue Depth */}
            <div className={`bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-2 relative overflow-hidden ${isQueueCritical ? 'border-[#FF00E5]/50 shadow-[0_0_30px_rgba(255,0,229,0.3)]' : 'border-[rgba(255,255,255,0.1)]'}`}>
              {isQueueCritical && <div className="absolute inset-0 bg-[#FF00E5]/10 animate-pulse"></div>}
              <p className="text-[#8F9BB3] text-sm font-medium flex items-center gap-2 relative z-10">
                <Layers size={16} className={isQueueCritical ? "text-[#FF00E5]" : ""} /> BullMQ Queue Depth
              </p>
              <p className={`font-mono text-[32px] font-bold relative z-10 ${isQueueCritical ? 'text-[#FF00E5] drop-shadow-[0_0_10px_rgba(255,0,229,0.5)]' : 'text-white'}`}>
                {queueLength}
              </p>
              <p className={`font-mono text-[10px] relative z-10 ${isQueueCritical ? 'text-[#FF00E5]' : 'text-[#8F9BB3]'}`}>
                {isQueueCritical ? "> 20 — Load shedding may activate" : "Healthy. Jobs waiting for PostgreSQL write."}
              </p>
            </div>

            {/* Metric 4: RPS */}
            <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-2">
              <p className="text-[#8F9BB3] text-sm font-medium flex items-center gap-2">
                <Activity size={16} /> Throughput
              </p>
              <p className="font-mono text-[32px] font-bold text-[#00F0FF] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
                {rps} <span className="text-base text-[#8F9BB3]">RPS</span>
              </p>
              <p className="font-mono text-[10px] text-[#8F9BB3]">Requests/second hitting the backend API</p>
            </div>
          </div>

          {/* Lower Split Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
            
            {/* Terminal Logs */}
            <div className="lg:col-span-2 bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
              <div className="bg-black/40 border-b border-[rgba(255,255,255,0.1)] px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TerminalSquare size={16} className="text-[#8F9BB3]" />
                  <span className="font-mono text-[12px] text-[#8F9BB3] tracking-wider">gate-worker-node-01.log</span>
                  {simRunning && <span className="font-mono text-[10px] text-[#00F0FF] bg-[#00F0FF]/10 px-2 py-0.5 rounded-full">SIM ACTIVE</span>}
                </div>
                <div className="flex gap-1.5">
                  <div className="size-2.5 rounded-full bg-[rgba(255,255,255,0.1)]"></div>
                  <div className="size-2.5 rounded-full bg-[rgba(255,255,255,0.1)]"></div>
                  <div className={`size-2.5 rounded-full ${simRunning ? 'bg-[#00F0FF] animate-pulse' : 'bg-[#FF00E5]'}`}></div>
                </div>
              </div>
              
              <div className="flex-1 bg-[#05050A] p-4 font-mono text-[13px] leading-relaxed overflow-hidden relative flex flex-col">
                <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-[#05050A] to-transparent z-10 pointer-events-none"></div>
                <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#05050A] to-transparent z-10 pointer-events-none"></div>
                
                <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar h-full justify-end pr-2 pb-2">
                  {activityLog.length === 0 && (
                    <div className="text-[#8F9BB3] text-center my-auto">
                      Awaiting traffic spikes... Open the <Link href="/simulation" className="text-[#00F0FF] hover:underline">Simulator</Link> to begin.
                    </div>
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
                          {event.latency !== undefined && (event.type.startsWith("SIM_") ? `count: ${event.latency}` : `locked in ${event.latency}ms`)}
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

              {/* Controls Card */}
              <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-5 h-auto">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-display text-sm font-bold text-[#F8F9FA] flex items-center gap-2"><Server size={14}/> Node Controls</h4>
                  <span className="font-mono text-[12px] text-[#22C55E]">Docker ✓</span>
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
                      title="Reset Inventory in Redis"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#8F9BB3]">PostgreSQL (port 5433)</span>
                      <span className="font-mono text-[10px] text-[#22C55E]">● Connected</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-[10px] text-[#8F9BB3]">Redis (port 6380)</span>
                      <span className="font-mono text-[10px] text-[#22C55E]">● Connected</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-[10px] text-[#8F9BB3]">BullMQ Workers</span>
                      <span className="font-mono text-[10px] text-[#22C55E]">● Active</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agent Chat */}
              <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] border border-[#00F0FF]/30 rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col flex-1 min-h-[300px] overflow-hidden group">
                <div className="bg-black/40 border-b border-[rgba(255,255,255,0.1)] px-4 py-2 flex items-center gap-2 relative">
                  <div className="absolute inset-0 bg-[#00F0FF]/10 animate-pulse pointer-events-none opacity-20"></div>
                  <span className="material-symbols-outlined text-[#00F0FF] text-[16px]">smart_toy</span>
                  <span className="font-mono text-[12px] text-[#00F0FF] tracking-wider font-bold">Midnight Commander (Agent AI)</span>
                </div>
                
                <div className="flex-1 bg-[#05050A] p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar flex flex-col gap-3">
                  <div className="text-[#8F9BB3] mb-2 italic">&gt; Neural Link Established. Try: &quot;Reset inventory to 100&quot; or &quot;What is the queue depth?&quot;</div>
                  {chatLog.map((chat, idx) => (
                    <div key={idx} className={`flex flex-col ${chat.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`p-2 rounded-lg max-w-[90%] whitespace-pre-wrap ${chat.role === "user" ? "bg-[rgba(255,255,255,0.1)] text-[#F8F9FA]" : "bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30"}`}>
                        {chat.text}
                      </div>
                    </div>
                  ))}
                  {isAgentTyping && (
                    <div className="flex items-start">
                      <div className="p-2 rounded-lg bg-[#00F0FF]/5 text-[#00F0FF] border border-[#00F0FF]/10 animate-pulse">
                        Analyzing system matrix...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef}></div>
                </div>
                
                <form onSubmit={handleChatSubmit} className="p-2 border-t border-[rgba(255,255,255,0.1)] bg-black/60 flex gap-2">
                  <input 
                    type="text" 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Command the AI agent..."
                    className="flex-1 bg-transparent text-white font-mono text-[12px] px-2 py-1 outline-none focus:bg-[rgba(255,255,255,0.05)] rounded transition-all"
                    disabled={isAgentTyping}
                  />
                  <button 
                    type="submit" 
                    disabled={isAgentTyping || !prompt.trim()}
                    className="bg-[#00F0FF]/20 text-[#00F0FF] hover:bg-[#00F0FF]/30 px-3 rounded font-mono text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    EXEC
                  </button>
                </form>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
