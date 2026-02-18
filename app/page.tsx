
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ===========================
   TYPES
=========================== */

type SystemStatus = "healthy" | "incident" | "recovering";
type ServiceStatus = "healthy" | "degraded" | "down";

type AnalyzeResult = {
  incident_type: string;
external_intelligence?: string;

  // 🔥 추가(프론트 카드)
  executive_summary?: string;

  probable_causes: Array<{
    name: string;
    probability: number;
    reasoning: string;
    recommended_action: string;
  }>;

  confidence: number;

  severity_score?: number; // 0..100
  business_impact_score?: number; // 0..100
  estimated_recovery_time_minutes?: number;

  recommended_runbook_steps?: string[];

  services?: Array<{
    name: string;
    status: ServiceStatus;
    signals: string[];
    suspected_components: string[];
  }>;

  propagation?: {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
  };
};

/* ===========================
   SMALL UTILS / HOOKS
=========================== */

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const safeInt = (v: any, fallback = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), 0, 100);
};

function useAnimatedNumber(target: number, opts?: { durationMs?: number; decimals?: number }) {
  const durationMs = opts?.durationMs ?? 700;
  const decimals = opts?.decimals ?? 0;

  const [value, setValue] = useState<number>(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(target);
  const toRef = useRef<number>(target);

  useEffect(() => {
    fromRef.current = value;
    toRef.current = target;
    startRef.current = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = clamp((now - startRef.current) / durationMs, 0, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (toRef.current - fromRef.current) * eased;
      const factor = Math.pow(10, decimals);
      setValue(Math.round(next * factor) / factor);

      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, decimals]);

  return value;
}

/* ===========================
   UI HELPERS
=========================== */

const svcBadgeClass = (st: ServiceStatus) => {
  if (st === "healthy") return "bg-emerald-600/90";
  if (st === "degraded") return "bg-amber-500/90";
  return "bg-rose-600/90";
};

const svcStroke = (st: ServiceStatus) => {
  if (st === "healthy") return "rgba(16,185,129,0.85)";
  if (st === "degraded") return "rgba(245,158,11,0.85)";
  return "rgba(244,63,94,0.85)";
};

function StatusBar({ status }: { status: SystemStatus }) {
  const cls =
    status === "healthy"
      ? "bg-emerald-900/40 border-emerald-700/50 text-emerald-200"
      : status === "incident"
      ? "bg-rose-900/35 border-rose-700/60 text-rose-200 animate-pulse"
      : "bg-amber-900/35 border-amber-700/60 text-amber-200 animate-pulse";

  return (
    <div className={`mt-4 mb-8 rounded-xl border px-5 py-4 ${cls} transition-all duration-500`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-base font-bold tracking-wide">
            {status === "healthy" && "🟢 Cluster Healthy"}
            {status === "incident" && "🔴 Incident Active"}
            {status === "recovering" && "🟡 Recovery In Progress"}
          </div>
          <div className="text-xs text-white/60">
            Global Control Plane · prod · ap-northeast-2
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Policy</span>
          <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5">
            HUMAN-APPROVAL
          </span>
          <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5">
            AUTO-OBSERVE
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
}) {
  const display = useAnimatedNumber(value, { durationMs: 650, decimals: suffix === "%" ? 1 : 0 });

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-bold text-cyan-200 tabular-nums">
          {display}
        </div>
        {suffix && <div className="text-xs text-white/45">{suffix}</div>}
      </div>
      {hint && <div className="mt-2 text-[11px] text-white/35">{hint}</div>}
    </div>
  );
}

function ScoreBar({
  label,
  score,
  tone,
  rightHint,
}: {
  label: string;
  score: number;
  tone: "red" | "amber" | "emerald" | "cyan";
  rightHint?: string;
}) {
  const animated = useAnimatedNumber(score, { durationMs: 900, decimals: 0 });

  const bar =
    tone === "red"
      ? "bg-rose-500/90"
      : tone === "amber"
      ? "bg-amber-500/90"
      : tone === "emerald"
      ? "bg-emerald-500/90"
      : "bg-cyan-500/90";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex justify-between items-center mb-2 gap-3">
        <div className="text-sm font-semibold text-white/85">{label}</div>
        <div className="flex items-center gap-2">
          {rightHint && <span className="text-xs text-white/45">{rightHint}</span>}
          <span className="text-sm font-bold text-white/90 tabular-nums">{animated}</span>
        </div>
      </div>
      <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden border border-white/10">
        <div
          className={`h-3 ${bar} transition-all duration-700`}
          style={{ width: `${clamp(animated, 0, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ===========================
   MAIN COMPONENT (🏆 FINAL WINNER)
=========================== */

export default function Home() {
  const [logs, setLogs] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>("healthy");

  // ✅ 기존 유지
  const [recoveryTime, setRecoveryTime] = useState<number | null>(null);
  const [runbook, setRunbook] = useState<string | null>(null);

  // ✅ 기존 유지 (requireApproval는 UI상 크게 쓰진 않아도 "유지" 요구)
  const [requireApproval] = useState(true);
  const [approved, setApproved] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<number[]>([]);
  const [notified, setNotified] = useState(false);

  // ✅ 스트리밍 유지
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState<string>("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  // ✅ 멀티 서비스
  const [selectedService, setSelectedService] = useState<string | null>(null);
// 🔥 Animated recovery time (Hook은 항상 컴포넌트 최상단에서 호출해야 함)
// 🎙 Deepgram Recording State
const [recording, setRecording] = useState(false);
const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const animatedRecoveryTime = useAnimatedNumber(
  result?.estimated_recovery_time_minutes ?? 0,
  { durationMs: 900, decimals: 1 }
);

  // 🔥 실시간 Infra Metrics (관제센터 느낌)
  const [metrics, setMetrics] = useState({
    cpu: 18, // %
    errorRate: 0.3, // %
    latency: 110, // ms
    rps: 1200, // req/s
    dbConn: 40, // conns
  });

  // 🔥 복구 연출용(점진적 변화)
  const recoveryIntervalRef = useRef<number | null>(null);

  // ✅ 실시간 메트릭 가짜 스트림 (항상 실행)
  useEffect(() => {
    const id = window.setInterval(() => {
      setMetrics((prev) => ({
        cpu: clamp(prev.cpu + (Math.random() - 0.5) * 10, 5, 95),
        errorRate: clamp(prev.errorRate + (Math.random() - 0.5) * 1.8, 0, 20),
        latency: clamp(prev.latency + (Math.random() - 0.5) * 50, 50, 900),
        rps: clamp(prev.rps + (Math.random() - 0.5) * 260, 200, 3200),
        dbConn: clamp(prev.dbConn + (Math.random() - 0.5) * 6, 5, 120),
      }));
    }, 1200);

    return () => clearInterval(id);
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.close();
      if (recoveryIntervalRef.current) window.clearInterval(recoveryIntervalRef.current);
    };
  }, []);

  /* ===========================
     ANALYZE (SSE 스트리밍 유지 + fallback 유지)
  =========================== */

  const analyze = async () => {
    if (!logs.trim()) return;

    setLoading(true);
    setResult(null);
    setSystemStatus("healthy");
    setRecoveryTime(null);
    setRunbook(null);
    setApproved(false);
    setExecutionLogs([]);
    setTimeline([]);
    setNotified(false);

    // 스트리밍 reset
    setStreaming(false);
    setStreamText("");
    setStreamError(null);
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    // 복구 연출 중단
    if (recoveryIntervalRef.current) {
      window.clearInterval(recoveryIntervalRef.current);
      recoveryIntervalRef.current = null;
    }

    try {
      setStreaming(true);

      // ✅ POST SSE (ReadableStream 파서) - 1번 코드 유지
      const sseRes = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs }),
      });

      if (!sseRes.ok || !sseRes.body) {
        throw new Error("Streaming endpoint not available");
      }

      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let buffer = "";
      let gotFinal = false;

      const handleEventBlock = (block: string) => {
        const lines = block.split("\n").map((l) => l.trim());
        let eventName = "message";
        let dataLine = "";

        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.replace("event:", "").trim();
          if (line.startsWith("data:")) dataLine += line.replace("data:", "").trim();
        }
        if (!dataLine) return;

        try {
          const data = JSON.parse(dataLine);

          if (eventName === "token") {
            setStreamText((prev) => prev + (data.text ?? ""));
          } else if (eventName === "final") {
            gotFinal = true;

            setResult(data as AnalyzeResult);
            setSystemStatus("incident");
            setStreaming(false);

            // ✅ Demo timeline 유지
            setTimeline([10, 40, 75, 60, 35, 15]);

            // ✅ 멀티서비스 기본 선택 유지
            const firstService = (data?.services?.[0]?.name as string) ?? null;
            setSelectedService(firstService);
          } else if (eventName === "error") {
            setStreamError(data.message ?? "Streaming error");
            setStreaming(false);
          }
        } catch {
          // ignore parsing errors
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (block) handleEventBlock(block);
        }
      }

      // ✅ final 없으면 fallback JSON 호출 (1번 코드 유지)
      if (!gotFinal) {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logs }),
        });

        const data = (await res.json()) as AnalyzeResult;
        setResult(data);
        setSystemStatus("incident");
        setTimeline([10, 40, 75, 60, 35, 15]);
        setSelectedService(data?.services?.[0]?.name ?? null);
        setStreaming(false);
      }
    } catch (err: any) {
      // ✅ 스트리밍 실패하면 /api/analyze로 폴백 (1번 코드 유지)
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logs }),
        });

        const data = (await res.json()) as AnalyzeResult;
        setResult(data);
        setSystemStatus("incident");
        setTimeline([10, 40, 75, 60, 35, 15]);
        setSelectedService(data?.services?.[0]?.name ?? null);
      } catch (e) {
        console.error(e);
      } finally {
        setStreamError(err?.message ?? "Streaming failed");
        setStreaming(false);
      }
    } finally {
      setLoading(false);
    }
  };
/* ===========================
   🎙 Deepgram Recording
=========================== */

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  mediaRecorderRef.current = mediaRecorder;

  const chunks: BlobPart[] = [];

  mediaRecorder.ondataavailable = (e) => {
    chunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: "audio/webm" });
    setAudioBlob(blob);

    const formData = new FormData();
    formData.append("file", blob);

    const res = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    setLogs((prev) => prev + "\n\n" + data.text);
    if (data.voice_meta) {
  const stressDetected =
    data.voice_meta.speech_rate > 3.2 ||
    data.voice_meta.confidence < 0.75;

  if (stressDetected) {
    setExecutionLogs((prev) => [
      ...prev,
      "🎙 Voice Stress Detected → Escalating severity weighting"
    ]);

    // 🔥 실제 severity 가중치 반영
    setResult((prev) => {
      if (!prev) return prev;

      const boosted = clamp(
        (prev.severity_score ?? 60) + 12,
        0,
        100
      );

      return {
        ...prev,
        severity_score: boosted,
      };
    });
  }
}

  };

  mediaRecorder.start();
  setRecording(true);
};

const stopRecording = () => {
  mediaRecorderRef.current?.stop();
  setRecording(false);
};

  /* ===========================
     LEGACY 계산(유지)
  =========================== */

 const calculateSeverity = () => {
  if (!result) return "P3";

  // 🔥 severity_score가 있으면 그걸 우선 사용
  if (typeof result.severity_score === "number") {
    const s = result.severity_score;
    if (s >= 80) return "P1";
    if (s >= 50) return "P2";
    return "P3";
  }

  // 🔥 probable_causes fallback
  if (result.probable_causes?.length) {
    const highest = Math.max(
      ...result.probable_causes.map((c) => Number(c.probability) || 0)
    );
    if (highest >= 0.7) return "P1";
    if (highest >= 0.4) return "P2";
  }

  // 🔥 기본값
  return "P3";
};


  const calculateImpact = () => {
    const severity = calculateSeverity();
    if (severity === "P1") return "$4,800/hr revenue impact";
    if (severity === "P2") return "$1,200/hr revenue impact";
    return "Minimal revenue impact";
  };

  const calculateBlastRadius = () => {
    const severity = calculateSeverity();
    if (severity === "P1") return "All Regions (63%)";
    if (severity === "P2") return "Single Region (28%)";
    return "Limited Service (12%)";
  };

  /* ===========================
     PDF / SLACK (유지)
  =========================== */

  const generatePDF = async () => {
    if (!result) return;

    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  ...result,
  external_intelligence: result.external_intelligence,
  confidence: result.confidence ?? 0.75,  // 🔥 fallback
  severity_score: result.severity_score ?? 60,
  business_impact_score: result.business_impact_score ?? 40,
  severity: calculateSeverity(),
  impact: calculateImpact(),
  blast_radius: calculateBlastRadius(),
  execution_logs: executionLogs,
      }),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "incident-report.pdf";
    a.click();
  };

  const sendSlack = async () => {
    if (!result) return;

    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_type: result.incident_type,
        severity: calculateSeverity(),
        severity_score: result.severity_score ?? null,
      }),
    });

    setNotified(true);
  };

  /* ===========================
     🔥 RECOVERY (요청 3번: 진짜 우승용 자동 전환)
     - recovering → services 점진적 healthy
     - propagation 그래프 색상 변화
     - severity score 애니메이션 감소 (state 업데이트로 자연스럽게)
  =========================== */

  const simulateRecovery = () => {
    // 🔥 REAL ACTION CALL
fetch("/api/execute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    service: selectedService ?? "api-gateway",
  }),
})
  .then((res) => res.json())
  .then((data) => {
    setExecutionLogs((prev) => [
      ...prev,
      `Infra API call sent for ${data.service}`,
      `Webhook status: ${data.webhook_status}`,
    ]);
  })
  .catch(() => {
    setExecutionLogs((prev) => [
      ...prev,
      "⚠️ Infra execution call failed",
    ]);
  });

    if (!result) return;

    setSystemStatus("recovering");

    // ✅ runbook steps (기존 유지)
    const aiSteps =
      result?.recommended_runbook_steps?.length
        ? result.recommended_runbook_steps
        : [
            "Restarting primary DB instance...",
            "Scaling API servers...",
            "Enabling circuit breaker...",
            "Rebalancing load...",
            "Monitoring latency metrics...",
          ];

    aiSteps.forEach((step: string, i: number) => {
      setTimeout(() => {
        setExecutionLogs((prev) => [...prev, step]);
      }, i * 800);
    });

    // 🔥 1) 서비스 상태 점진적 회복 + 스코어 감소(“진짜 관제” 연출)
    const totalTicks = 9; // 더 길게 보여주면 데모 감성 올라감
    let tick = 0;

    const startSeverity = safeInt(result.severity_score ?? 78, 78);
    const startImpact = safeInt(result.business_impact_score ?? 62, 62);

    // incident일 때 metrics도 더 "나쁘게" 보여주고 recovering에서 개선되는 느낌
    setMetrics((prev) => ({
      ...prev,
      cpu: clamp(prev.cpu + 18, 5, 95),
      errorRate: clamp(prev.errorRate + 2.4, 0, 20),
      latency: clamp(prev.latency + 180, 50, 900),
      rps: clamp(prev.rps - 200, 200, 3200),
      dbConn: clamp(prev.dbConn + 14, 5, 120),
    }));

    if (recoveryIntervalRef.current) window.clearInterval(recoveryIntervalRef.current);

    recoveryIntervalRef.current = window.setInterval(() => {
      tick += 1;

      // 점진 개선 목표치
      const sev = clamp(Math.round(startSeverity * (1 - tick / (totalTicks + 1))), 3, 100);
      const imp = clamp(Math.round(startImpact * (1 - tick / (totalTicks + 1))), 2, 100);

      // services 상태 단계적으로: down -> degraded -> healthy
      setResult((prev) => {
        if (!prev) return prev;

        const nextServices = (prev.services ?? []).map((s, idx) => {
          // 순차적으로 회복되게(관제센터 느낌)
          const threshold = Math.floor(((idx + 1) / Math.max(1, (prev.services ?? []).length)) * totalTicks);
          if (tick < threshold) return s;

          // down이면 degraded로, degraded면 healthy로, healthy는 유지
          if (s.status === "down") return { ...s, status: "degraded" as const };
          if (s.status === "degraded") return { ...s, status: "healthy" as const };
          return s;
        });

        return {
          ...prev,
          services: nextServices,
          severity_score: sev,
          business_impact_score: imp,
        };
      });

      // metrics도 회복 방향으로 움직이게
      setMetrics((prev) => ({
        cpu: clamp(prev.cpu - 3.5, 5, 95),
        errorRate: clamp(prev.errorRate - 0.45, 0, 20),
        latency: clamp(prev.latency - 35, 50, 900),
        rps: clamp(prev.rps + 120, 200, 3200),
        dbConn: clamp(prev.dbConn - 2.2, 5, 120),
      }));

      // 종료 조건
      if (tick >= totalTicks) {
        if (recoveryIntervalRef.current) {
          window.clearInterval(recoveryIntervalRef.current);
          recoveryIntervalRef.current = null;
        }

        setTimeout(() => {
          setSystemStatus("healthy");
          setRecoveryTime(result?.estimated_recovery_time_minutes ?? 3.4);
          setExecutionLogs((prev) => [...prev, "System stabilized ✅"]);
        }, 900);
      }
    }, 650);
  };

  /* ===========================
     MULTI SERVICE (유지)
  =========================== */

  const services = result?.services ?? [];
  const activeService = useMemo(() => {
    if (!services.length) return null;
    const found = services.find((s) => s.name === selectedService);
    return found ?? services[0];
  }, [services, selectedService]);

  /* ===========================
     PROPAGATION GRAPH LAYOUT (유지)
  =========================== */

  const graph = result?.propagation;

  const serviceStatusByName = useMemo(() => {
    const map: Record<string, ServiceStatus> = {};
    for (const s of services) map[s.name] = s.status;
    return map;
  }, [services]);

  const graphLayout = useMemo(() => {
    if (!graph?.nodes?.length) return null;

    const nodes = graph.nodes;
    const edges = graph.edges ?? [];

    const incoming: Record<string, number> = {};
    const out: Record<string, string[]> = {};

    for (const n of nodes) {
      incoming[n.id] = 0;
      out[n.id] = [];
    }

    for (const e of edges) {
      if (incoming[e.to] === undefined) incoming[e.to] = 0;
      incoming[e.to] += 1;
      if (!out[e.from]) out[e.from] = [];
      out[e.from].push(e.to);
    }

    const depth: Record<string, number> = {};
    const queue: string[] = [];

    for (const n of nodes) {
      if ((incoming[n.id] ?? 0) === 0) {
        depth[n.id] = 0;
        queue.push(n.id);
      }
    }

    while (queue.length) {
      const cur = queue.shift()!;
      const nexts = out[cur] ?? [];
      for (const nxt of nexts) {
        const nd = (depth[cur] ?? 0) + 1;
        depth[nxt] = Math.max(depth[nxt] ?? 0, nd);
      }
    }

    const columns: Record<number, string[]> = {};
    for (const n of nodes) {
      const d = depth[n.id] ?? 0;
      if (!columns[d]) columns[d] = [];
      columns[d].push(n.id);
    }

    const colKeys = Object.keys(columns)
      .map(Number)
      .sort((a, b) => a - b);

    const width = 980;
    const height = 280;
    const paddingX = 70;
    const paddingY = 50;

    const positions: Record<string, { x: number; y: number }> = {};

    colKeys.forEach((d, i) => {
      const col = columns[d];
      const x =
        paddingX + (i * (width - paddingX * 2)) / Math.max(1, colKeys.length - 1);

      col.forEach((id, j) => {
        const y =
          paddingY + (j * (height - paddingY * 2)) / Math.max(1, col.length - 1);
        positions[id] = { x, y };
      });
    });

    return { width, height, positions, nodes, edges };
  }, [graph]);

  /* ===========================
     RENDER
  =========================== */

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#06070a] to-[#04060a] text-white px-6 py-10 md:px-10">
      {/* HEADER */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            AutoOps — Self-Healing AI Control Plane
          </h1>
          <div className="mt-2 text-sm text-white/55">
            Real-time AI investigation → propagation mapping → human approval → runbook execution → PDF + Slack
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/55">Build</span>
          <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5">
            v0.9.9-demo
          </span>
          <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5">
            ENTERPRISE DARK
          </span>
        </div>
      </div>

      {/* 🔥 (요청 1번) GLOBAL STATUS BAR */}
      <StatusBar status={systemStatus} />

      {/* INPUT PANEL */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm font-semibold text-white/85">Incident Logs</div>
          <div className="text-xs text-white/45">
            Paste raw logs · structured parsing via /api/analyze/stream
          </div>
        </div>

        <textarea
          className="mt-4 w-full h-44 p-4 text-white bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 font-mono text-sm"
          placeholder="Paste logs here..."
          value={logs}
          onChange={(e) => setLogs(e.target.value)}
        />

{/* 🎙 Voice Input (Deepgram Mission) */}
<div className="mt-3 flex gap-3">
  {!recording ? (
    <button
      onClick={startRecording}
      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700"
    >
      🎙 Start Recording
    </button>
  ) : (
    <button
      onClick={stopRecording}
      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700"
    >
      ⏹ Stop Recording
    </button>
  )}
</div>


        <div className="mt-4 flex gap-3 items-center flex-wrap">
          <button
            onClick={analyze}
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 font-semibold shadow"
          >
            {loading ? "Analyzing..." : "Analyze Incident"}
          </button>

          {streaming && (
            <div className="text-sm text-cyan-200/90 animate-pulse">
              🔥 Streaming investigation…
            </div>
          )}

          {approved ? (
            <div className="ml-auto text-emerald-300 font-bold animate-pulse">
              🟢 HUMAN APPROVED
            </div>
          ) : (
            <div className="ml-auto text-white/40 text-xs">
              Gate: require approval before execution
            </div>
          )}
        </div>
      </div>

      {/* 🔥 (요청 2번) REAL-TIME INFRA METRICS PANEL */}
      <div className="mt-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm font-semibold text-white/85">Real-time Infra Metrics</div>
          <div className="text-xs text-white/45">Synthetic stream · animated counters · control-room feel</div>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="CPU Usage" value={metrics.cpu} suffix="%" hint="node avg · 1s" />
          <MetricCard label="Error Rate" value={metrics.errorRate} suffix="%" hint="5xx ratio · 1m" />
          <MetricCard label="Latency" value={metrics.latency} suffix="ms" hint="p95 · 1m" />
          <MetricCard label="RPS" value={metrics.rps} hint="edge aggregated" />
          <MetricCard label="DB Connections" value={metrics.dbConn} hint="pool + active" />
        </div>
      </div>

      {/* ✅ Live AI Stream Panel (유지) */}
      {(streamText || streaming) && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="font-bold mb-2 text-white/85">Live AI Investigation Stream</div>
          <div className="text-sm text-white/70 whitespace-pre-wrap font-mono bg-black/40 border border-white/10 rounded-xl p-4">
            {streamText || "…"}
          </div>
        </div>
      )}

      {/* RESULT */}
      {result && (
        <div className="mt-10 space-y-8">
          {/* INCIDENT HEADER */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="text-xs text-white/45">Incident Type</div>
               <div className="mt-1 text-2xl md:text-3xl font-extrabold text-rose-200">
  🚨 {result.incident_type?.trim()
      ? result.incident_type
      : "Database Connectivity / Latency Degradation"}
</div>
                <div className="mt-2 text-sm text-white/55">
                  Severity (legacy): <span className="font-bold text-white/80">{calculateSeverity()}</span>{" "}
                  · Impact: <span className="text-white/75">{calculateImpact()}</span>{" "}
                  · Blast Radius: <span className="text-white/75">{calculateBlastRadius()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!approved && (
                  <button
                    onClick={() => setApproved(true)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 font-semibold"
                  >
                    Approve Execution
                  </button>
                )}

                <button
                  onClick={simulateRecovery}
                  disabled={requireApproval && !approved}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 font-semibold"
                >
                  Execute Recovery
                </button>

                <button
                  onClick={generatePDF}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold"
                >
                  Download Report
                </button>

                <button
                  onClick={sendSlack}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-semibold"
                >
                  Send Slack Alert
                </button>
              </div>
            </div>

            {notified && (
              <div className="mt-4 text-rose-200 font-bold">
                🚨 Slack Notification Sent
              </div>
            )}
          </div>

          {/* 🔥 (요청 4번) EXECUTIVE SUMMARY CARD */}
          {result.external_intelligence && (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mt-6">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="text-lg font-bold text-cyan-300">
        🌐 External Intelligence (You.com)
      </div>
      <div className="text-xs text-white/45">
        Real-time contextual search enrichment
      </div>
    </div>

    <div className="mt-3 text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
      {result.external_intelligence}
    </div>
  </div>
)}

          {(result.executive_summary || true) && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-lg font-bold text-white/85">Executive Summary</div>
                <div className="text-xs text-white/45">
                  AI-generated · surfaced to executives & stakeholders
                </div>
              </div>

              <div className="mt-3 text-sm text-white/70 leading-relaxed">
                {result.executive_summary?.trim()
                  ? result.executive_summary
                  : "AI detected abnormal system behavior requiring further investigation. Root cause candidates were identified and a runbook was generated for controlled recovery execution."}
              </div>
            </div>
          )}

          {/* SCORES (Animated counters) */}
          <div className="grid md:grid-cols-3 gap-3">
            {typeof result.severity_score === "number" && (
              <ScoreBar
                label="AI Severity Score (0–100)"
                score={safeInt(result.severity_score)}
                tone="red"
                rightHint="risk"
              />
            )}

            {typeof result.business_impact_score === "number" && (
              <ScoreBar
                label="Business Impact Score (0–100)"
                score={safeInt(result.business_impact_score)}
                tone="amber"
                rightHint="revenue"
              />
            )}

            {typeof result.confidence === "number" && (
              <ScoreBar
                label="AI Confidence (0–100)"
                score={safeInt(result.confidence * 100)}
                tone="emerald"
                rightHint="model"
              />
            )}
          </div>

          {/* Recovery Estimate (유지 + 숫자 카운팅 느낌) */}
          {typeof result.estimated_recovery_time_minutes === "number" && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-white/55">Estimated Recovery Time</div>
              <div className="mt-2 text-2xl font-extrabold text-cyan-200 tabular-nums">
                {animatedRecoveryTime} minutes
                {recoveryTime !== null && (
                  <span className="ml-3 text-sm text-white/45 font-medium">
                    (last run: {recoveryTime} min)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* PROPAGATION GRAPH (유지 + (요청 3번) 상태색 변화) */}
          {graphLayout && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="font-bold text-white/85">Failure Propagation Graph</div>
                <div className="text-xs text-white/45">
                  Click a node to drill down service details
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                <svg
                  width="100%"
                  viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}
                >
                  {/* edges */}
                  {graphLayout.edges.map((e, i) => {
                    const a = graphLayout.positions[e.from];
                    const b = graphLayout.positions[e.to];
                    if (!a || !b) return null;

                    const fromStatus = serviceStatusByName[e.from] ?? "degraded";
                    const toStatus = serviceStatusByName[e.to] ?? "degraded";

                    // edge color: worst-of endpoints
                    const worst: ServiceStatus =
                      fromStatus === "down" || toStatus === "down"
                        ? "down"
                        : fromStatus === "degraded" || toStatus === "degraded"
                        ? "degraded"
                        : "healthy";

                    const stroke = svcStroke(worst);
                    const alpha =
                      systemStatus === "incident"
                        ? 0.55
                        : systemStatus === "recovering"
                        ? 0.45
                        : 0.30;

                    const midX = (a.x + b.x) / 2;
                    const midY = (a.y + b.y) / 2;

                    return (
                      <g key={i}>
                        <line
                          x1={a.x}
                          y1={a.y}
                          x2={b.x}
                          y2={b.y}
                          stroke={stroke.replace("0.85", `${alpha}`)}
                          strokeWidth="2.4"
                        />
                        <text
                          x={midX + 6}
                          y={midY - 6}
                          fill="rgba(255,255,255,0.55)"
                          fontSize="12"
                        >
                          {e.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* nodes */}
                  {graphLayout.nodes.map((n) => {
                    const p = graphLayout.positions[n.id];
                    if (!p) return null;

                    const isSelected = selectedService === n.id;
                    const st = serviceStatusByName[n.id] ?? "degraded";

                    const fill =
                      st === "healthy"
                        ? "rgba(16,185,129,0.95)"
                        : st === "degraded"
                        ? "rgba(245,158,11,0.95)"
                        : "rgba(244,63,94,0.95)";

                    const ring =
                      isSelected ? "rgba(34,211,238,0.95)" : "rgba(255,255,255,0.15)";

                    return (
                      <g
                        key={n.id}
                        onClick={() => setSelectedService(n.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <circle cx={p.x} cy={p.y} r={isSelected ? 20 : 16} fill={ring} />
                        <circle cx={p.x} cy={p.y} r={isSelected ? 16 : 12} fill={fill} />
                        <text x={p.x + 24} y={p.y + 5} fill="white" fontSize="14">
                          {n.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="mt-3 text-xs text-white/45">
                Tip: 노드 클릭하면 아래 멀티 서비스 상세가 그 서비스로 이동합니다.
              </div>
            </div>
          )}

          {/* MULTI SERVICE VIEW (유지) */}
          {services.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="font-bold text-white/85">Multi-Service View</div>
                <div className="text-xs text-white/45">Service-level signals · suspected components</div>
              </div>

              <div className="mt-4 flex gap-3 flex-wrap">
                {services.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setSelectedService(s.name)}
                    className={`px-3 py-2 rounded-xl border border-white/10 ${
                      selectedService === s.name ? "bg-white/10" : "bg-black/20"
                    } hover:bg-white/10 transition`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${svcBadgeClass(s.status)}`} />
                    <span className="text-sm">{s.name}</span>
                  </button>
                ))}
              </div>

              {activeService && (
                <div className="mt-5 grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        {activeService.name}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${svcBadgeClass(activeService.status)} text-white`}
                      >
                        {activeService.status}
                      </span>
                    </div>

                    <div className="mt-4 text-xs text-white/55">Signals</div>
                    <ul className="mt-2 text-sm text-white/70 list-disc ml-5 space-y-1">
                      {activeService.signals?.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-5">
                    <div className="text-xs text-white/55">Suspected Components</div>
                    <ul className="mt-2 text-sm text-white/70 list-disc ml-5 space-y-1">
                      {activeService.suspected_components?.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TIMELINE (유지) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/55 mb-4">Incident Timeline</div>
            <div className="flex items-end gap-3 h-28">
              {timeline.map((v, i) => (
                <div
                  key={i}
                  className="w-6 rounded-lg transition-all duration-700 bg-rose-500/90"
                  style={{ height: `${v}%` }}
                />
              ))}
            </div>
          </div>

          {/* PROBABLE CAUSES (유지) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-bold text-white/85 mb-4">Top Probable Causes</div>
            {result.probable_causes?.map((cause, i) => (
              <div key={i} className="mb-4">
                <div className="font-semibold text-white/90">
                  {cause.name}{" "}
                  <span className="text-white/55">
                    ({Math.round((cause.probability ?? 0) * 100)}%)
                  </span>
                </div>
                <div className="text-sm text-white/60 mt-1">{cause.reasoning}</div>
                <div className="text-sm text-cyan-200 mt-1">
                  Recommended: {cause.recommended_action}
                  {(cause as any).citation && (
  <div className="text-xs text-cyan-300 mt-1">
    Source: {(cause as any).citation}
  </div>
)}

                </div>
              </div>
            ))}
          </div>

          {/* RUNBOOK (유지) */}
          {result.recommended_runbook_steps?.length ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="font-bold text-white/85 mb-4">AI Generated Runbook</div>
              <div className="space-y-1 text-white/75">
                {result.recommended_runbook_steps.map((step, i) => (
                  <div key={i}>→ {step}</div>
                ))}
              </div>
            </div>
          ) : null}

          {/* EXECUTION LOGS (유지) */}
          {executionLogs.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="font-bold text-white/85 mb-3">Execution Logs</div>
              <div className="bg-black/35 border border-white/10 rounded-xl p-4 text-sm font-mono text-white/80">
                {executionLogs.map((log, i) => (
                  <div key={i}>→ {log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
