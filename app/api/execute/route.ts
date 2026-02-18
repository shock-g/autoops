// app/api/execute/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
   const service = body?.service;

if (!["api-gateway","primary-db","cache"].includes(service)) {
  return NextResponse.json({ error: "Invalid service" }, { status: 400 });
}

    //
    
    const webhookRes = await fetch(process.env.WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "scale_up",
        service,
        triggeredBy: "AutoOps AI",
        timestamp: new Date().toISOString(),
      }),
    });

    return NextResponse.json({
      status: "executed",
      service,
      webhook_status: webhookRes.status,
      message: `Real infrastructure action triggered for ${service}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Execution failed" },
      { status: 500 }
    );
  }
}
