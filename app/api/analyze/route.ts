// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type ServiceStatus = "healthy" | "degraded" | "down";

type AnalyzeResult = {
  incident_type: string;
  executive_summary: string;
  severity_score: number;
  business_impact_score: number;
  estimated_recovery_time_minutes: number;

  probable_causes: Array<{
    name: string;
    probability: number;
    reasoning: string;
    recommended_action: string;
  }>;

  recommended_runbook_steps: string[];
  confidence: number;

  services: Array<{
    name: string;
    status: ServiceStatus;
    signals: string[];
    suspected_components: string[];
  }>;

  propagation: {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
  };
};

// ---------------- SAFETY HELPERS ----------------

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const toNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toInt01to100 = (v: any, fallback = 0) =>
  clamp(Math.round(toNumber(v, fallback)), 0, 100);

const toProb01 = (v: any, fallback = 0) =>
  clamp(toNumber(v, fallback), 0, 1);

const toStringSafe = (v: any, fallback = "") =>
  typeof v === "string" ? v : fallback;

const toStringArray = (v: any, limit = 20) =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === "string" ? x : String(x ?? "")))
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];

const safeServiceStatus = (v: any): ServiceStatus => {
  if (v === "healthy" || v === "degraded" || v === "down") return v;
  return "degraded";
};

const safeJSONParse = (text: string) => {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  const candidate =
    first !== -1 && last !== -1 && last > first
      ? cleaned.slice(first, last + 1)
      : cleaned;

  return JSON.parse(candidate);
};

// ---------------- FALLBACK BUILDERS ----------------

const buildFallbackServices = (incidentType: string): AnalyzeResult["services"] => {
  const base = [
    {
      name: "api-gateway",
      status: "degraded" as ServiceStatus,
      signals: ["Fallback service map"],
      suspected_components: ["request-routing", "auth", "rate-limiter"],
    },
    {
      name: "primary-db",
      status: "degraded" as ServiceStatus,
      signals: ["Fallback service map"],
      suspected_components: ["connections", "replication", "locks"],
    },
    {
      name: "cache",
      status: "healthy" as ServiceStatus,
      signals: ["Fallback service map"],
      suspected_components: ["evictions", "latency", "memory"],
    },
  ];

  const it = incidentType.toLowerCase();
  if (it.includes("outage") || it.includes("down") || it.includes("critical")) {
    base[0].status = "down";
    base[1].status = "down";
    base[2].status = "degraded";
  }

  return base;
};

const buildPropagationFromServices = (
  services: AnalyzeResult["services"]
): AnalyzeResult["propagation"] => {
  const nodes = services.map((s) => ({ id: s.name, label: s.name }));
  const edges =
    services.length >= 3
      ? [
          { from: services[0].name, to: services[1].name, label: "depends_on" },
          { from: services[0].name, to: services[2].name, label: "uses_cache" },
        ]
      : [];

  return { nodes, edges };
};

// ---------------- HYBRID DETERMINISTIC SCORING ----------------

const calculateSeverityFromServices = (
  services: AnalyzeResult["services"]
) => {
  let score = 0;

  const downCount = services.filter((s) => s.status === "down").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;

  if (downCount >= 2) score += 70;
  else if (downCount === 1) score += 45;

  score += degradedCount * 10;

  return clamp(score, 0, 100);
};


const calculateBlastRadius = (
  services: AnalyzeResult["services"]
) => {
  const total = services.length;
  if (total === 0) return 0;

  const down = services.filter((s) => s.status === "down").length;
  const degraded = services.filter((s) => s.status === "degraded").length;

  const radius = (down + degraded * 0.5) / total;
  return clamp(Math.round(radius * 100), 0, 100);
};

const calculateImpactFromPropagation = (
  propagation: AnalyzeResult["propagation"]
) => {
  const nodeCount = propagation.nodes.length;
  const edgeCount = propagation.edges.length;
  return clamp(nodeCount * 5 + edgeCount * 8, 0, 100);
};

// ---------------- MAIN ----------------

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const logs = body?.logs;

    if (!logs || typeof logs !== "string" || !logs.trim()) {
      return NextResponse.json({ error: "Logs are required" }, { status: 400 });
    }
// ---------------- EXTERNAL CONTEXT (You.com) ----------------
const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`;

let externalContext = "No external context available.";

try {
  const searchRes = await fetch(
    `${baseUrl}/api/search-context`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: logs.slice(0, 400),
      }),
    }
  );

  const searchData = await searchRes.json();

  if (Array.isArray(searchData?.summaries) && searchData.summaries.length > 0) {
    externalContext = searchData.summaries
      .map(
        (s: any, i: number) =>
          `Source ${i + 1}: ${s.title}\n${s.snippet}\n${s.url}`
      )
      .join("\n\n");
  }
} catch {
  externalContext = "External search unavailable.";
}
console.log("=== EXTERNAL CONTEXT START ===");
console.log(externalContext);
console.log("=== EXTERNAL CONTEXT END ===");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

 const result = await model.generateContent(`
  You must also consider the following real-time external intelligence:

${externalContext}

---

You are a Tier-1 Incident Commander AI operating in a production-critical environment.

Return STRICT JSON ONLY.

JSON schema:
{
  "incident_type": string,
  "executive_summary": string,
  "severity_score": number (0-100),
  "business_impact_score": number (0-100),
  "estimated_recovery_time_minutes": number,
  "probable_causes": [
    { "name": string, "probability": number (0-1), "reasoning": string, "recommended_action": string }
  ],
  "recommended_runbook_steps": string[],
  "confidence": number (0-1),
  "services": [
    {
      "name": string,
      "status": "healthy" | "degraded" | "down",
      "signals": string[],
      "suspected_components": string[]
    }
  ],
  "propagation": {
    "nodes": [{ "id": string, "label": string }],
    "edges": [{ "from": string, "to": string, "label": string }]
  }
}

CRITICAL SCORING RULES:
- Any "CRITICAL" log MUST significantly increase severity_score.
- "cluster unavailable" implies near-total outage.
- Failed failover implies systemic production impact.
- Multiple CRITICAL lines imply severity >= 85.
- Production database failure implies high business impact unless explicitly mitigated.

Severity Guidelines:
- Full cluster outage: 85–100
- Regional outage: 60–84
- Degraded service: 30–59
- Minor anomaly: 0–29

MANDATORY:
- Always provide at least 2 probable root causes.
- Always populate services.
- Always populate propagation.
- Do NOT be conservative.
- Assume production traffic unless logs say otherwise.

Logs:
${logs}
`);



    const text = result.response.text();

    let parsed: any;
    try {
      parsed = safeJSONParse(text);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const incident_type = toStringSafe(parsed?.incident_type, "Unknown Incident");
    const executive_summary = toStringSafe(parsed?.executive_summary, "");

    const aiSeverity = toInt01to100(parsed?.severity_score, 0);
    const aiImpact = toInt01to100(parsed?.business_impact_score, 0);

    const estimated_recovery_time_minutes = Math.max(
      0,
      toNumber(parsed?.estimated_recovery_time_minutes, 0)
    );

    const confidence = toProb01(parsed?.confidence, 0);
    

    const probable_causes = (Array.isArray(parsed?.probable_causes)
      ? parsed.probable_causes
      : []
    )
      .map((c: any) => ({
        name: toStringSafe(c?.name, "Unknown Cause"),
        probability: toProb01(c?.probability, 0),
        reasoning: toStringSafe(c?.reasoning, ""),
        recommended_action: toStringSafe(c?.recommended_action, ""),
      }))
      .filter((c) => c.name.trim().length > 0)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5);

    const recommended_runbook_steps = toStringArray(
      parsed?.recommended_runbook_steps,
      10
    );

    let services: AnalyzeResult["services"] = (Array.isArray(parsed?.services)
      ? parsed.services
      : []
    )
      .map((s: any) => ({
        name: toStringSafe(s?.name, "").trim() || "unknown-service",
        status: safeServiceStatus(s?.status),
        signals: toStringArray(s?.signals, 12),
        suspected_components: toStringArray(s?.suspected_components, 12),
      }))
      .filter((s) => s.name.length > 0);

    if (services.length < 3) {
      services = buildFallbackServices(incident_type);
    }

    const seen = new Set<string>();
    services = services.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });

    let propagation: AnalyzeResult["propagation"] | null = null;

    if (
      parsed?.propagation?.nodes &&
      parsed?.propagation?.edges &&
      Array.isArray(parsed.propagation.nodes) &&
      Array.isArray(parsed.propagation.edges)
    ) {
      const nodeIds = new Set<string>();

      const nodes = parsed.propagation.nodes
        .map((n: any) => ({
          id: toStringSafe(n?.id, "").trim(),
          label: toStringSafe(n?.label, "").trim(),
        }))
        .filter((n: any) => n.id && n.label)
        .filter((n: any) => {
          if (nodeIds.has(n.id)) return false;
          nodeIds.add(n.id);
          return true;
        })
        .slice(0, 30);

      const edges = parsed.propagation.edges
        .map((e: any) => ({
          from: toStringSafe(e?.from, "").trim(),
          to: toStringSafe(e?.to, "").trim(),
          label: toStringSafe(e?.label, "").trim() || "depends_on",
        }))
        .filter((e: any) => e.from && e.to)
        .slice(0, 60);

      if (nodes.length >= 2) {
        propagation = { nodes, edges };
      }
    }

    if (!propagation) {
      propagation = buildPropagationFromServices(services);
    }

    // -------- Hybrid Final Scoring --------

    const deterministicSeverity = calculateSeverityFromServices(services);
    const deterministicImpact = calculateImpactFromPropagation(propagation);
    const blastRadiusScore = calculateBlastRadius(services);

    const finalSeverity = clamp(
  Math.round(Math.max(aiSeverity, deterministicSeverity)),
  0,
  100
);

    const finalImpact = clamp(
      Math.round(
        aiImpact * 0.5 +
          deterministicImpact * 0.3 +
          blastRadiusScore * 0.2
      ),
      0,
      100
    );

    const safeResponse: AnalyzeResult = {
      incident_type,
      executive_summary,
      severity_score: finalSeverity,
      business_impact_score: finalImpact,
      estimated_recovery_time_minutes,
      probable_causes,
      recommended_runbook_steps,
      confidence,
      services,
      propagation,
    };

    
return NextResponse.json({
  ...safeResponse,
  external_intelligence: externalContext,
});
  } catch (error) {
    return NextResponse.json({ error: "Failed to analyze logs" }, { status: 500 });
  }
}
