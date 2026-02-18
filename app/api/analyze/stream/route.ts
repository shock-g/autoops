// app/api/analyze/stream/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const logs = body?.logs ?? "";

    if (!logs.trim()) {
      return new Response("Missing logs", { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
You MUST understand that logs may be written in Korean or English.

If logs are written in Korean:
- Translate internally to English.
- Extract the technical meaning.
- Generate incident_type in professional English SRE terminology.
- Do NOT leave incident_type empty.
- If database issues are detected, use terms like:
  "Database Connectivity Failure"
  "Database Timeout"
  "DB Connection Pool Exhaustion"
- If latency issues are detected, include:
  "Latency Degradation"
  "Performance Degradation"

Always generate a clear, specific, technical incident_type.
Never return empty strings.

You are a senior SRE AI.

You must do TWO things:

(1) Stream concise investigation narration.
(2) At the very end output STRICT JSON wrapped exactly like this:

<FINAL_JSON>
{ ...valid json... }
</FINAL_JSON>

No markdown. No explanation after closing tag.

STRICT JSON schema:
{
  "incident_type": string,
  "executive_summary": string,
  "probable_causes": [
    { "name": string, "probability": number (0-1), "reasoning": string, "recommended_action": string }
  ],
  "confidence": number (0-1),
  "severity_score": number (0-100),
  "business_impact_score": number (0-100),
  "estimated_recovery_time_minutes": number,
  "recommended_runbook_steps": string[],
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

Rules:
- severity_score & business_impact_score must be integers 0..100
- probability & confidence must be 0..1
- propagation.nodes.id should match service names when possible

Logs:
${logs}
`.trim();

    const streamResult = await model.generateContentStream(prompt);
    const encoder = new TextEncoder();

    let fullText = "";
    let finalSent = false;

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`
            )
          );
        };

        try {
          // ✅ 스트리밍 상태는 루프 밖에서 유지해야 안전함
          let jsonStarted = false;
          let lastNarrationSentIndex = 0;

          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            if (!text) continue;

            fullText += text;

            // =======================================================
            // 1️⃣ FINAL_JSON 시작 감지 (JSON 섞임 방지)
            // =======================================================
            if (!finalSent && !jsonStarted) {
              const startIndex = fullText.indexOf("<FINAL_JSON>");

              if (startIndex === -1) {
                // 아직 JSON 시작 전: 이번 chunk는 narration으로 전송
                send("token", { text });
              } else {
                // JSON 시작됨: <FINAL_JSON> 전까지 한번만 narration 전송
                const narrationPart = fullText.slice(
                  lastNarrationSentIndex,
                  startIndex
                );

                if (narrationPart.trim()) {
                  send("token", { text: narrationPart });
                }

                jsonStarted = true;
              }
            }

            // =======================================================
            // 2️⃣ FINAL_JSON 완전 수신 확인
            // =======================================================
            if (!finalSent) {
              const start = fullText.indexOf("<FINAL_JSON>");
              const end = fullText.indexOf("</FINAL_JSON>");

              if (start !== -1 && end !== -1 && end > start) {
                const jsonText = fullText
                  .slice(start + "<FINAL_JSON>".length, end)
                  .trim();

                try {
                  const parsed = JSON.parse(jsonText);

                  // ===================================================
                  // 🔥 HYBRID SCORING (엔터프라이즈 안정 버전)
                  // ===================================================

                  const clamp = (n: number, min: number, max: number) =>
                    Math.min(max, Math.max(min, n));

                  const safeInt = (v: any, fallback = 0) => {
                    const n = Number(v);
                    return Number.isFinite(n)
                      ? clamp(Math.round(n), 0, 100)
                      : fallback;
                  };

                  const safeProb = (v: any) => {
                    const n = Number(v);
                    return Number.isFinite(n) ? clamp(n, 0, 1) : 0;
                  };

                  const services = Array.isArray(parsed.services)
                    ? parsed.services
                    : [];

                  const propagation =
                    parsed.propagation && typeof parsed.propagation === "object"
                      ? parsed.propagation
                      : { nodes: [], edges: [] };

                  const calculateSeverityFromServices = (svcs: any[]) => {
                    let score = 0;
                    svcs.forEach((s) => {
                      if (s?.status === "down") score += 35;
                      if (s?.status === "degraded") score += 15;
                    });
                    return clamp(score, 0, 100);
                  };

                  const calculateBlastRadius = (svcs: any[]) => {
                    const total = svcs.length;
                    if (!total) return 0;
                    const down = svcs.filter((s) => s?.status === "down")
                      .length;
                    const degraded = svcs.filter((s) => s?.status === "degraded")
                      .length;
                    return clamp(
                      Math.round(((down + degraded * 0.5) / total) * 100),
                      0,
                      100
                    );
                  };

                  const calculateImpactFromPropagation = (prop: any) => {
                    const nodeCount = Array.isArray(prop.nodes)
                      ? prop.nodes.length
                      : 0;
                    const edgeCount = Array.isArray(prop.edges)
                      ? prop.edges.length
                      : 0;
                    return clamp(nodeCount * 5 + edgeCount * 8, 0, 100);
                  };

                  const aiSeverity = safeInt(parsed.severity_score);
                  const aiImpact = safeInt(parsed.business_impact_score);

                  const deterministicSeverity =
                    calculateSeverityFromServices(services);

                  const deterministicImpact =
                    calculateImpactFromPropagation(propagation);

                  const blastRadiusScore = calculateBlastRadius(services);

                  parsed.severity_score = clamp(
                    Math.max(aiSeverity, deterministicSeverity),
                    0,
                    100
                  );

                  parsed.business_impact_score = clamp(
                    Math.round(
                      aiImpact * 0.5 +
                        deterministicImpact * 0.3 +
                        blastRadiusScore * 0.2
                    ),
                    0,
                    100
                  );

                  parsed.confidence = safeProb(parsed.confidence);

                  // ===================================================
                  // 3️⃣ 최종 이벤트 전송 + 종료
                  // ===================================================
                  send("final", parsed);
                  finalSent = true;

                  // 메모리 정리
                  fullText = "";

                  controller.close();
                  return;
                } catch (e) {
                  send("error", {
                    message: "Invalid JSON structure from model.",
                  });
                  controller.close();
                  return;
                }
              }
            }
          }

          // =======================================================
          // 3️⃣ 스트림 종료 시 FINAL_JSON 없을 경우 보호 (루프 밖)
          // =======================================================
          if (!finalSent) {
            send("error", {
              message: "Model did not return FINAL_JSON block.",
            });
            controller.close();
            return;
          }
        } catch (e: any) {
          send("error", { message: e?.message ?? "Streaming failed" });
          controller.close();
          return;
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    return new Response(e?.message ?? "Bad Request", { status: 400 });
  }
}
