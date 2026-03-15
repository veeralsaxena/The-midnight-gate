"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  MarkerType,
  Handle,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ════════════════════════════════════════════════════
// CUSTOM NODES
// ════════════════════════════════════════════════════
interface ArchNodeData {
  label: string;
  icon: string;
  subtitle: string;
  color: string;
  glowColor: string;
  entering: number;
  passed: number;
  blocked: number;
  active: boolean;
  pulse: boolean;
  extra?: string;
}

function ArchitectureNode({ data }: { data: ArchNodeData }) {
  return (
    <div
      className="relative rounded-2xl border backdrop-blur-[16px] p-4 transition-all duration-500"
      style={{
        minWidth: 190,
        background: data.active
          ? `linear-gradient(145deg, rgba(255,255,255,0.06), ${data.glowColor})`
          : "rgba(255,255,255,0.03)",
        borderColor: data.active ? `${data.color}66` : "rgba(255,255,255,0.1)",
        boxShadow: data.active
          ? `0 0 30px ${data.glowColor}, inset 0 0 15px ${data.glowColor}`
          : "0 4px 30px rgba(0,0,0,0.5)",
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="rejected" className="!bg-transparent !border-0 !w-3 !h-3" />

      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="flex size-9 items-center justify-center rounded-lg text-base"
          style={{ background: `${data.color}22`, color: data.color }}
        >
          <span className="material-symbols-outlined text-xl">{data.icon}</span>
        </div>
        <div>
          <h3 className="font-display font-bold text-white text-[13px] leading-tight">{data.label}</h3>
          <p className="text-[9px] text-[#8F9BB3] font-mono leading-tight">{data.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-black/30 rounded-lg px-1.5 py-1 text-center">
          <div className="font-mono text-[8px] text-[#8F9BB3] uppercase">In</div>
          <div className="font-mono text-xs font-bold" style={{ color: data.color }}>
            {data.entering.toLocaleString()}
          </div>
        </div>
        <div className="bg-black/30 rounded-lg px-1.5 py-1 text-center">
          <div className="font-mono text-[8px] text-[#22C55E] uppercase">Pass</div>
          <div className="font-mono text-xs font-bold text-[#22C55E]">
            {data.passed.toLocaleString()}
          </div>
        </div>
        <div className="bg-black/30 rounded-lg px-1.5 py-1 text-center">
          <div className="font-mono text-[8px] text-[#FF00E5] uppercase">Drop</div>
          <div className="font-mono text-xs font-bold text-[#FF00E5]">
            {data.blocked.toLocaleString()}
          </div>
        </div>
      </div>

      {data.extra && (
        <p className="font-mono text-[9px] text-center mt-2" style={{ color: data.color }}>{data.extra}</p>
      )}

      {data.pulse && (
        <div className="absolute inset-0 rounded-2xl animate-ping opacity-15 pointer-events-none"
          style={{ border: `2px solid ${data.color}` }} />
      )}
    </div>
  );
}

function RejectedNode({ data }: { data: { count: number } }) {
  return (
    <div className="min-w-[130px] rounded-xl border border-[#FF00E5]/30 bg-[#FF00E5]/5 backdrop-blur-[16px] p-3 text-center">
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-3 !h-3" />
      <span className="material-symbols-outlined text-[#FF00E5] text-xl">block</span>
      <p className="font-display font-bold text-[#FF00E5] text-xs mt-1">Rejected / Sold Out</p>
      <p className="font-mono text-lg font-bold text-[#FF00E5] mt-0.5">{data.count.toLocaleString()}</p>
    </div>
  );
}

function ReleasedNode({ data }: { data: { heartbeat: number; ttl: number } }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-[#EAB308]/30 bg-[#EAB308]/5 backdrop-blur-[16px] p-3 text-center">
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-3 !h-3" />
      <span className="material-symbols-outlined text-[#EAB308] text-xl">sync</span>
      <p className="font-display font-bold text-[#EAB308] text-xs mt-1">Reclaimed → Pool</p>
      <div className="flex gap-3 mt-1.5 justify-center">
        <div className="text-center">
          <p className="font-mono text-[8px] text-[#8F9BB3]">Heartbeat</p>
          <p className="font-mono text-sm font-bold text-[#EAB308]">{data.heartbeat}</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-[8px] text-[#8F9BB3]">TTL</p>
          <p className="font-mono text-sm font-bold text-[#A855F7]">{data.ttl}</p>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  architecture: ArchitectureNode,
  rejected: RejectedNode,
  released: ReleasedNode,
};

// ════════════════════════════════════════════════════
// INITIAL NODES & EDGES
// ════════════════════════════════════════════════════
const Y_MAIN = 180;
const Y_REJECT = 430;

const makeInitialNodes = (): Node[] => [
  {
    id: "users", type: "architecture", position: { x: 0, y: Y_MAIN },
    data: { label: "50K Users", icon: "group", subtitle: "Concurrent requests", color: "#F8F9FA", glowColor: "rgba(248,249,250,0.1)", entering: 0, passed: 0, blocked: 0, active: false, pulse: false },
  },
  {
    id: "cdn", type: "architecture", position: { x: 260, y: Y_MAIN },
    data: { label: "CDN Edge", icon: "public", subtitle: "Layer 1 · Static Assets", color: "#00F0FF", glowColor: "rgba(0,240,255,0.12)", entering: 0, passed: 0, blocked: 0, active: false, pulse: false },
  },
  {
    id: "ratelimit", type: "architecture", position: { x: 520, y: Y_MAIN },
    data: { label: "Rate Limiter", icon: "speed", subtitle: "Layer 2 · Bot Detection", color: "#EAB308", glowColor: "rgba(234,179,8,0.12)", entering: 0, passed: 0, blocked: 0, active: false, pulse: false },
  },
  {
    id: "waitingroom", type: "architecture", position: { x: 780, y: Y_MAIN },
    data: { label: "Waiting Room", icon: "queue", subtitle: "Virtual Queue · FIFO", color: "#F97316", glowColor: "rgba(249,115,22,0.12)", entering: 0, passed: 0, blocked: 0, active: false, pulse: false, extra: "Fair queue before gate" },
  },
  {
    id: "redis", type: "architecture", position: { x: 1040, y: Y_MAIN },
    data: { label: "⚡ Redis Gate", icon: "key", subtitle: "Layer 3 · Atomic Lua", color: "#3B82F6", glowColor: "rgba(59,130,246,0.12)", entering: 0, passed: 0, blocked: 0, active: false, pulse: false, extra: "1M+ ops/sec" },
  },
  {
    id: "bullmq", type: "architecture", position: { x: 1300, y: Y_MAIN },
    data: { label: "BullMQ Queue", icon: "reorder", subtitle: "Layer 4 · Async Jobs", color: "#22C55E", glowColor: "rgba(34,197,94,0.12)", entering: 0, passed: 0, blocked: 0, active: false, pulse: false },
  },
  {
    id: "postgres", type: "architecture", position: { x: 1560, y: Y_MAIN },
    data: { label: "PostgreSQL", icon: "database", subtitle: "Layer 5 · Persistent", color: "#A855F7", glowColor: "rgba(168,85,247,0.12)", entering: 0, passed: 0, blocked: 0, active: false, pulse: false },
  },
  {
    id: "rejected", type: "rejected", position: { x: 850, y: Y_REJECT },
    data: { count: 0 },
  },
  {
    id: "released", type: "released", position: { x: 1200, y: Y_REJECT },
    data: { heartbeat: 0, ttl: 0 },
  },
];

const makeInitialEdges = (): Edge[] => [
  { id: "e-users-cdn", source: "users", target: "cdn", animated: false, style: { stroke: "#00F0FF", strokeWidth: 2, opacity: 0.25 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#00F0FF" } },
  { id: "e-cdn-rl", source: "cdn", target: "ratelimit", animated: false, style: { stroke: "#EAB308", strokeWidth: 2, opacity: 0.25 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#EAB308" } },
  { id: "e-rl-wr", source: "ratelimit", target: "waitingroom", animated: false, style: { stroke: "#F97316", strokeWidth: 2, opacity: 0.25 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#F97316" } },
  { id: "e-wr-redis", source: "waitingroom", target: "redis", animated: false, style: { stroke: "#3B82F6", strokeWidth: 2, opacity: 0.25 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#3B82F6" } },
  { id: "e-redis-bmq", source: "redis", target: "bullmq", animated: false, style: { stroke: "#22C55E", strokeWidth: 2, opacity: 0.25 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#22C55E" } },
  { id: "e-bmq-pg", source: "bullmq", target: "postgres", animated: false, style: { stroke: "#A855F7", strokeWidth: 2, opacity: 0.25 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#A855F7" } },
  // Rejection edges
  { id: "e-rl-rej", source: "ratelimit", sourceHandle: "rejected", target: "rejected", animated: false, style: { stroke: "#FF00E5", strokeWidth: 1.5, opacity: 0.15, strokeDasharray: "6 4" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#FF00E5" } },
  { id: "e-wr-rej", source: "waitingroom", sourceHandle: "rejected", target: "rejected", animated: false, style: { stroke: "#FF00E5", strokeWidth: 1.5, opacity: 0.15, strokeDasharray: "6 4" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#FF00E5" } },
  { id: "e-redis-rej", source: "redis", sourceHandle: "rejected", target: "rejected", animated: false, style: { stroke: "#FF00E5", strokeWidth: 1.5, opacity: 0.15, strokeDasharray: "6 4" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#FF00E5" } },
  // Released edge
  { id: "e-redis-rel", source: "redis", sourceHandle: "rejected", target: "released", animated: false, style: { stroke: "#EAB308", strokeWidth: 1.5, opacity: 0.15, strokeDasharray: "6 4" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#EAB308" } },
];

// ════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════
interface SimStats {
  totalUsers: number; inventory: number;
  cdnPassed: number; rateLimited: number;
  waitingRoomEntered: number; waitingRoomReleased: number; waitingRoomRejected: number;
  redisReserved: number; redisRejected: number;
  bullmqEnqueued: number; postgresWritten: number;
  abandoned: number; heartbeatReleased: number; ttlReleased: number; errors: number;
  duration?: number;
}

interface LogEntry { id: number; phase: string; message: string; timestamp: number; color: string; }

const defaultStats: SimStats = {
  totalUsers: 0, inventory: 0, cdnPassed: 0, rateLimited: 0,
  waitingRoomEntered: 0, waitingRoomReleased: 0, waitingRoomRejected: 0,
  redisReserved: 0, redisRejected: 0, bullmqEnqueued: 0, postgresWritten: 0,
  abandoned: 0, heartbeatReleased: 0, ttlReleased: 0, errors: 0,
};

export default function SimulationPage() {
  const socketRef = useRef<Socket | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(makeInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(makeInitialEdges());

  const [totalUsers, setTotalUsers] = useState(5000);
  const [inventory, setInventory] = useState(50);
  const [abandonRate, setAbandonRate] = useState(30);
  const [simStatus, setSimStatus] = useState<"IDLE" | "RUNNING" | "COMPLETE">("IDLE");
  const [stats, setStats] = useState<SimStats>({ ...defaultStats });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState("Configure parameters and launch");
  const [elapsed, setElapsed] = useState(0);
  const logIdRef = useRef(0);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  const statsRef = useRef<SimStats>({ ...defaultStats });

  const addLog = useCallback((phase: string, message: string, color: string) => {
    logIdRef.current++;
    setLogs(prev => [{ id: logIdRef.current, phase, message, timestamp: Date.now(), color }, ...prev].slice(0, 150));
  }, []);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<ArchNodeData>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n));
  }, [setNodes]);

  const activateEdge = useCallback((edgeId: string, active: boolean) => {
    setEdges(eds => eds.map(e =>
      e.id === edgeId ? { ...e, animated: active, style: { ...e.style, opacity: active ? 1 : 0.25, strokeWidth: active ? 3 : 2 } } : e
    ));
  }, [setEdges]);

  // Socket connection
  useEffect(() => {
    const socket = io(API);
    socketRef.current = socket;

    socket.on("simulationEvent", (event) => {
      switch (event.phase) {
        case "START":
          setSimStatus("RUNNING");
          setCurrentPhase("🚀 Simulation launched — herd incoming");
          addLog("START", `${event.totalUsers.toLocaleString()} users → ${event.inventory} inventory (${Math.round(event.abandonRate * 100)}% abandon)`, "#00F0FF");
          updateNodeData("users", { entering: event.totalUsers, passed: event.totalUsers, active: true, pulse: true, label: `${event.totalUsers.toLocaleString()} Users` });
          setTimeout(() => updateNodeData("users", { pulse: false }), 800);
          break;

        case "WAVE_START":
          setCurrentPhase(`📡 Wave ${event.waveNumber}/${event.totalWaves}`);
          addLog("WAVE", `Wave ${event.waveNumber}/${event.totalWaves}: ${event.usersInWave.toLocaleString()} users`, "#8F9BB3");
          break;

        case "PHASE_CDN":
          activateEdge("e-users-cdn", true);
          activateEdge("e-cdn-rl", true);
          updateNodeData("cdn", { entering: event.totalCdnPassed, passed: event.totalCdnPassed, active: true, pulse: true });
          addLog("CDN", `${event.passed.toLocaleString()} requests distributed`, "#00F0FF");
          setTimeout(() => updateNodeData("cdn", { pulse: false }), 600);
          break;

        case "PHASE_RATE_LIMIT":
          activateEdge("e-rl-wr", true);
          if (event.blocked > 0) activateEdge("e-rl-rej", true);
          statsRef.current = { ...statsRef.current, rateLimited: statsRef.current.rateLimited + event.blocked, cdnPassed: statsRef.current.cdnPassed + event.entering };
          updateNodeData("ratelimit", {
            entering: statsRef.current.cdnPassed,
            passed: statsRef.current.cdnPassed - statsRef.current.rateLimited,
            blocked: statsRef.current.rateLimited,
            active: true, pulse: true,
          });
          addLog("RATE", `${event.blocked} bots blocked · ${event.passed.toLocaleString()} passed`, "#EAB308");
          setTimeout(() => updateNodeData("ratelimit", { pulse: false }), 600);
          break;

        case "PHASE_WAITING_ROOM":
          updateNodeData("waitingroom", {
            entering: event.totalWaitingEntered,
            passed: event.totalWaitingReleased,
            blocked: event.totalWaitingRejected,
            active: true, pulse: true,
            extra: event.rejectedSoldOut > 0 ? `${event.rejectedSoldOut.toLocaleString()} sent SOLD OUT` : "Releasing to Gate...",
          });
          if (event.rejectedSoldOut > 0) {
            activateEdge("e-wr-rej", true);
            addLog("QUEUE", `${event.rejectedSoldOut.toLocaleString()} users notified SOLD OUT from waiting room`, "#F97316");
          } else {
            addLog("QUEUE", `${event.released} users released from waiting room to Redis Gate`, "#F97316");
          }
          setTimeout(() => updateNodeData("waitingroom", { pulse: false }), 600);
          break;

        case "PHASE_REDIS_GATE":
          activateEdge("e-wr-redis", true);
          activateEdge("e-redis-bmq", event.reserved > 0);
          activateEdge("e-redis-rej", event.rejected > 0);
          updateNodeData("redis", {
            entering: event.totalReserved + event.totalRejected,
            passed: event.totalReserved,
            blocked: event.totalRejected,
            active: true, pulse: true,
            extra: `Stock: ${event.inventoryRemaining}`,
          });
          setNodes(nds => nds.map(n => n.id === "rejected" ? { ...n, data: { count: event.totalRejected + statsRef.current.rateLimited } } : n));
          statsRef.current = { ...statsRef.current, redisReserved: event.totalReserved, redisRejected: event.totalRejected };
          setStats(prev => ({ ...prev, redisReserved: event.totalReserved, redisRejected: event.totalRejected }));
          addLog("REDIS", `⚡ ${event.reserved} reserved · ${event.rejected.toLocaleString()} rejected (Stock: ${event.inventoryRemaining})`, "#3B82F6");
          setTimeout(() => updateNodeData("redis", { pulse: false }), 600);
          break;

        case "PHASE_BULLMQ":
          activateEdge("e-bmq-pg", true);
          updateNodeData("bullmq", { entering: event.totalEnqueued, passed: event.totalEnqueued, active: true, pulse: true });
          statsRef.current = { ...statsRef.current, bullmqEnqueued: event.totalEnqueued };
          setStats(prev => ({ ...prev, bullmqEnqueued: event.totalEnqueued }));
          addLog("QUEUE", `${event.enqueued} orders enqueued`, "#22C55E");
          setTimeout(() => updateNodeData("bullmq", { pulse: false }), 600);
          break;

        case "PHASE_POSTGRES":
          updateNodeData("postgres", { entering: event.totalWritten, passed: event.totalWritten, active: true, pulse: true });
          statsRef.current = { ...statsRef.current, postgresWritten: event.totalWritten };
          setStats(prev => ({ ...prev, postgresWritten: event.totalWritten }));
          addLog("PG", `${event.written} orders persisted to PostgreSQL`, "#A855F7");
          setTimeout(() => updateNodeData("postgres", { pulse: false }), 600);
          break;

        case "PHASE_HEARTBEAT_RELEASE":
          activateEdge("e-redis-rel", true);
          setNodes(nds => nds.map(n => n.id === "released" ? { ...n, data: { heartbeat: event.totalHeartbeatReleased, ttl: 0 } } : n));
          statsRef.current = { ...statsRef.current, heartbeatReleased: event.totalHeartbeatReleased, abandoned: event.totalAbandoned };
          setStats(prev => ({ ...prev, heartbeatReleased: event.totalHeartbeatReleased, abandoned: event.totalAbandoned }));
          addLog("HEARTBEAT", `💔 ${event.released} abandoned → inventory reclaimed`, "#EAB308");
          break;

        case "WAVE_COMPLETE":
          if (event.stats) setStats(event.stats);
          break;

        case "COMPLETE":
          setSimStatus("COMPLETE");
          setCurrentPhase("✅ Simulation Complete");
          if (event.stats) {
            setStats(event.stats);
            statsRef.current = event.stats;
          }
          addLog("DONE", `Complete in ${event.stats?.duration}ms — ${event.stats?.postgresWritten} confirmed, ${event.stats?.redisRejected?.toLocaleString()} rejected, ${event.stats?.heartbeatReleased} reclaimed`, "#22C55E");
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          setEdges(eds => eds.map(e => ({ ...e, animated: false, style: { ...e.style, opacity: 0.4 } })));
          break;

        case "ERROR":
          setSimStatus("IDLE");
          setCurrentPhase("❌ Error — " + event.message);
          addLog("ERROR", event.message, "#EF4444");
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          break;

        case "RESET":
          addLog("RESET", event.message, "#A855F7");
          break;
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleLaunch = async () => {
    if (simStatus === "RUNNING") return;

    setNodes(makeInitialNodes());
    setEdges(makeInitialEdges());
    statsRef.current = { ...defaultStats, totalUsers, inventory };
    setStats({ ...defaultStats, totalUsers, inventory });
    setLogs([]);
    setSimStatus("RUNNING");
    setCurrentPhase("Initializing...");
    startTimeRef.current = Date.now();
    setElapsed(0);

    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 100);

    try {
      const res = await fetch(`${API}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalUsers, inventory, abandonRate: abandonRate / 100 }),
      });
      if (!res.ok) throw new Error("Backend responded with an error");
    } catch {
      // Backend connection failed -> Fallback to Local Simulation Mode
      setSimStatus("RUNNING");
      setCurrentPhase("Backend unreachable. Running local fallback simulation...");
      addLog("FALLBACK", "Backend is offline. Running visual simulation in browser only.", "#A855F7");
      
      const mockEvent = (phase: string, data: any, delay: number) => {
        setTimeout(() => {
          socketRef.current?.emit("simulationEvent", { phase, ...data });
          // Manually trigger the handler since we aren't getting real socket events
          const listeners = (socketRef.current as any)?._callbacks?.["$simulationEvent"] || [];
          listeners.forEach((fn: any) => fn({ phase, ...data }));
        }, delay);
      };

      // Calculate mock stats
      const cdnPassed = Math.floor(totalUsers * 0.9);
      const rateLimited = totalUsers - cdnPassed;
      const waitingReleased = Math.min(cdnPassed, 1000);
      const waitingRejected = cdnPassed - waitingReleased;
      const reserved = Math.min(waitingReleased, inventory);
      const rejected = waitingReleased - reserved;
      const abandoned = Math.floor(reserved * (abandonRate / 100));
      const confirmed = reserved - abandoned;

      // Orchestrate mock events
      mockEvent("START", { totalUsers, inventory, abandonRate: abandonRate / 100 }, 100);
      mockEvent("WAVE_START", { waveNumber: 1, totalWaves: 1, usersInWave: totalUsers }, 1000);
      mockEvent("PHASE_CDN", { totalCdnPassed: cdnPassed, passed: cdnPassed }, 2000);
      mockEvent("PHASE_RATE_LIMIT", { entering: totalUsers, passed: cdnPassed, blocked: rateLimited }, 3000);
      mockEvent("PHASE_WAITING_ROOM", { totalWaitingEntered: cdnPassed, totalWaitingReleased: waitingReleased, totalWaitingRejected: waitingRejected, rejectedSoldOut: waitingRejected, released: waitingReleased }, 4500);
      mockEvent("PHASE_REDIS_GATE", { totalReserved: reserved, totalRejected: rejected, reserved, rejected, inventoryRemaining: Math.max(0, inventory - reserved) }, 6000);
      mockEvent("PHASE_BULLMQ", { totalEnqueued: reserved, enqueued: reserved }, 7500);
      mockEvent("PHASE_POSTGRES", { totalWritten: confirmed, written: confirmed }, 9000);
      mockEvent("PHASE_HEARTBEAT_RELEASE", { totalHeartbeatReleased: abandoned, totalAbandoned: abandoned, released: abandoned }, 10500);
      
      mockEvent("COMPLETE", {
        stats: {
          totalUsers, inventory, cdnPassed, rateLimited,
          waitingRoomEntered: cdnPassed, waitingRoomReleased: waitingReleased, waitingRoomRejected: waitingRejected,
          redisReserved: reserved, redisRejected: rejected,
          bullmqEnqueued: reserved, postgresWritten: confirmed,
          abandoned, heartbeatReleased: abandoned, ttlReleased: 0, errors: 0,
          duration: 11000
        }
      }, 11500);
      
      return; 
    }
  };

  return (
    <div className="bg-[#0A0A16] text-[#F8F9FA] font-body min-h-screen overflow-x-hidden relative selection:bg-[#00F0FF]/30 selection:text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(45,11,89,0.5)_0%,rgba(10,10,22,1)_70%)] z-0" />

      <div className="relative z-10 flex flex-col min-h-screen lg:h-screen pt-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 lg:px-6 py-2.5 gap-2 sm:gap-0 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#F8F9FA]">
              ⚡ Thundering Herd Simulator
            </h2>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider ${
              simStatus === "RUNNING" ? "bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30"
                : simStatus === "COMPLETE" ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30"
                : "bg-[rgba(255,255,255,0.05)] text-[#8F9BB3] border border-[rgba(255,255,255,0.1)]"
            }`}>
              {simStatus === "RUNNING" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F0FF] opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00F0FF]" /></span>}
              {simStatus}
            </div>
          </div>
          <p className="font-mono text-[11px] text-[#8F9BB3] max-w-[400px] truncate">{currentPhase}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 lg:gap-5 px-4 lg:px-6 py-2.5 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] shrink-0 flex-wrap justify-between lg:justify-start">
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] text-[#8F9BB3] uppercase tracking-wider hidden sm:inline">Users:</label>
            <input type="range" min={100} max={50000} step={100} value={totalUsers}
              onChange={e => setTotalUsers(parseInt(e.target.value))} disabled={simStatus === "RUNNING"}
              className="w-20 lg:w-28 accent-[#00F0FF]" />
            <span className="font-mono text-xs text-[#00F0FF] font-bold w-10 lg:w-14 text-right">{totalUsers.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] text-[#8F9BB3] uppercase tracking-wider hidden sm:inline">Inventory:</label>
            <input type="number" min={1} max={1000} value={inventory}
              onChange={e => setInventory(parseInt(e.target.value) || 50)} disabled={simStatus === "RUNNING"}
              className="w-14 bg-black/40 border border-[rgba(255,255,255,0.1)] rounded text-white text-xs font-mono px-1 py-1 focus:outline-none focus:border-[#00F0FF]/50 text-center lg:px-2" />
          </div>

          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] text-[#8F9BB3] uppercase tracking-wider">Abandon:</label>
            <input type="range" min={0} max={100} value={abandonRate}
              onChange={e => setAbandonRate(parseInt(e.target.value))} disabled={simStatus === "RUNNING"}
              className="w-20 accent-[#FF00E5]" />
            <span className="font-mono text-xs text-[#FF00E5] font-bold w-8">{abandonRate}%</span>
          </div>

          <button onClick={handleLaunch} disabled={simStatus === "RUNNING"}
            className="w-full lg:w-auto lg:ml-auto flex items-center justify-center gap-2 px-5 py-2 mt-2 lg:mt-0 rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#00B8FF] text-[#0A0A16] font-display font-bold text-xs uppercase tracking-wider hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
            <span className="material-symbols-outlined text-base">{simStatus === "RUNNING" ? "hourglass_top" : "rocket_launch"}</span>
            {simStatus === "RUNNING" ? "Simulating..." : "Launch Simulation"}
          </button>

          <div className="font-mono text-[11px] text-[#8F9BB3]">
            <span className="text-[#00F0FF] font-bold">{elapsed}s</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* React Flow Canvas */}
          <div className="flex-1 relative min-h-[50vh] lg:min-h-0">
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2} maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
              className="!bg-transparent"
            >
              <Background color="rgba(255,255,255,0.02)" gap={40} />
              <Controls className="!bg-[rgba(255,255,255,0.05)] !border-[rgba(255,255,255,0.1)] !rounded-lg [&>button]:!bg-transparent [&>button]:!border-[rgba(255,255,255,0.1)] [&>button]:!text-[#8F9BB3] [&>button:hover]:!bg-[rgba(0,240,255,0.1)]" />
            </ReactFlow>
          </div>

          {/* Stats Sidebar */}
          <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] flex flex-col shrink-0 min-h-[400px] lg:min-h-0">
            <div className="p-3 border-b border-[rgba(255,255,255,0.06)]">
              <h3 className="font-display text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#00F0FF] text-sm">monitoring</span>
                Live Metrics
              </h3>
              <div className="grid grid-cols-4 lg:grid-cols-2 gap-1.5">
                <StatBox label="Reserved" value={stats.redisReserved} color="#3B82F6" />
                <StatBox label="Confirmed" value={stats.postgresWritten} color="#22C55E" />
                <StatBox label="Rejected" value={stats.redisRejected} color="#FF00E5" />
                <StatBox label="Bots Blocked" value={stats.rateLimited} color="#EAB308" />
                <StatBox label="Abandoned" value={stats.abandoned} color="#8F9BB3" />
                <StatBox label="HB Released" value={stats.heartbeatReleased} color="#EAB308" />
                <StatBox label="WR Queued" value={stats.waitingRoomEntered} color="#F97316" />
                <StatBox label="Errors" value={stats.errors} color="#EF4444" />
              </div>
            </div>

            {simStatus === "COMPLETE" && stats.duration && (
              <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)] bg-[#22C55E]/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[#22C55E] text-sm">check_circle</span>
                  <span className="font-mono text-[10px] text-[#22C55E] font-bold uppercase">Complete</span>
                </div>
                <p className="font-mono text-[9px] text-[#8F9BB3]">
                  {stats.totalUsers.toLocaleString()} users in {stats.duration}ms
                </p>
                <p className="font-mono text-[9px] text-[#22C55E] mt-0.5">
                  ✓ {stats.postgresWritten} confirmed · 0 oversells
                </p>
              </div>
            )}

            {/* Activity Log */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-3 py-1.5 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#8F9BB3] text-xs">terminal</span>
                <span className="font-mono text-[9px] text-[#8F9BB3] uppercase tracking-wider">Event Stream</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-0.5 bg-[#05050A]">
                {logs.length === 0 && (
                  <p className="text-[#8F9BB3] text-[10px] text-center mt-6 font-mono">Awaiting simulation...</p>
                )}
                <AnimatePresence>
                  {logs.map(log => (
                    <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      className="flex gap-1.5 text-[10px] font-mono leading-snug">
                      <span className="text-[#8F9BB3]/40 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className="shrink-0 font-bold" style={{ color: log.color }}>[{log.phase}]</span>
                      <span className="text-[#8F9BB3] break-all">{log.message}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-black/40 border border-[rgba(255,255,255,0.05)] rounded-md p-1.5 text-center">
      <div className="font-mono text-[8px] uppercase tracking-wider text-[#8F9BB3]">{label}</div>
      <div className="font-mono text-sm font-bold mt-0.5" style={{ color }}>{value.toLocaleString()}</div>
    </div>
  );
}
