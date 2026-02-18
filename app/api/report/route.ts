import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

function generateIncidentId() {
  return "INC-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function formatTimestamp() {
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const incidentType = body.incident_type ?? "Unknown";
  const severity =
  body.severity ??
  (body.severity_score >= 80
    ? "P1"
    : body.severity_score >= 60
    ? "P2"
    : "P3");

  const impact = body.impact ?? "N/A";
  const blastRadius = body.blast_radius ?? "N/A";
  const executiveSummary =
    body.executive_summary ??
    "AI detected abnormal system behavior requiring further investigation.";
  const externalIntelligence =
  body.external_intelligence ?? "No external intelligence available.";
  const probableCauses = body.probable_causes ?? [];

  let confidenceRaw =
  body.confidence ??
  body.confidence_score ??
  null;

if (confidenceRaw === null) {
  confidenceRaw = 0.72; // demo fallback
}


  const confidence = Math.round(
    confidenceRaw <= 1 ? confidenceRaw * 100 : confidenceRaw
  );

  const incidentId = body.incident_id ?? generateIncidentId();
  const ts = formatTimestamp();

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;

  /* ========================= */
  /* AUTO PAGE BREAK FUNCTION  */
  /* ========================= */

  function ensureSpace(spaceNeeded = 40) {
    if (y < spaceNeeded) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
  }

  /* ========================= */
  /* HEADER                    */
  /* ========================= */

  page.drawRectangle({
    x: 0,
    y: 760,
    width: 595,
    height: 82,
    color: rgb(0.05, 0.15, 0.3),
  });

  page.drawText("AutoOps — Enterprise Incident Report", {
    x: 50,
    y: 800,
    size: 18,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  y = 740;

  page.drawText(`Incident ID: ${incidentId}`, { x: 50, y, size: 12, font });
  y -= 20;

  page.drawText(`Generated: ${ts}`, { x: 50, y, size: 12, font });
  y -= 40;

  /* ========================= */
  /* EXECUTIVE SUMMARY         */
  /* ========================= */

  ensureSpace(120);

  page.drawText("Executive Summary", {
    x: 50,
    y,
    size: 14,
    font: boldFont,
  });

  y -= 20;

  page.drawText(executiveSummary, {
    x: 50,
    y,
    size: 12,
    font,
    maxWidth: 500,
    lineHeight: 14,
  });

  y -= 60;
y -= 40;

page.drawText("External Intelligence (You.com)", {
  x: 50,
  y,
  size: 14,
  font: boldFont,
});

y -= 20;

page.drawText(externalIntelligence.slice(0, 1500), {
  x: 50,
  y,
  size: 10,
  font,
  maxWidth: 500,
});

  /* ========================= */
  /* INCIDENT DETAILS          */
  /* ========================= */

  ensureSpace(120);

  page.drawText("Incident Details", {
    x: 50,
    y,
    size: 14,
    font: boldFont,
  });

  y -= 20;

  const severityColor =
    severity === "P1"
      ? rgb(0.8, 0, 0)
      : severity === "P2"
      ? rgb(0.9, 0.4, 0)
      : rgb(0, 0, 0);

  page.drawText(`Type: ${incidentType}`, { x: 50, y, size: 12, font });
  y -= 18;

  page.drawText(`Severity: ${severity}`, {
    x: 50,
    y,
    size: 12,
    font,
    color: severityColor,
  });
  y -= 18;

  page.drawText(`Impact: ${impact}`, { x: 50, y, size: 12, font });
  y -= 18;

  page.drawText(`Blast Radius: ${blastRadius}`, { x: 50, y, size: 12, font });
  y -= 40;

  /* ========================= */
  /* TOP PROBABLE CAUSES       */
  /* ========================= */

  if (probableCauses.length > 0) {
    ensureSpace(150);

    page.drawText("Top Probable Causes", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });

    y -= 20;

    probableCauses.slice(0, 3).forEach((cause: any, index: number) => {
      ensureSpace(80);

      const prob = Math.round(Number(cause.probability) * 100);

      page.drawText(
        `${index + 1}. ${cause.name} (${prob}%)`,
        { x: 60, y, size: 12, font: boldFont }
      );
      y -= 15;

      page.drawText(
        `Reason: ${cause.reasoning}`,
        { x: 75, y, size: 10, font, maxWidth: 470 }
      );
      y -= 15;

      page.drawText(
        `Recommended Action: ${cause.recommended_action}`,
        { x: 75, y, size: 10, font, maxWidth: 470 }
      );

      y -= 25;
    });
  }

  /* ========================= */
  /* AI CONFIDENCE VISUAL BAR  */
  /* ========================= */

  ensureSpace(120);

  page.drawText("AI Assessment", {
    x: 50,
    y,
    size: 14,
    font: boldFont,
  });

  y -= 25;

  page.drawText(`Confidence Level: ${confidence}%`, {
    x: 50,
    y,
    size: 14,
    font: boldFont,
  });

  y -= 20;

  const barWidth = 400;
  const filledWidth = (confidence / 100) * barWidth;

  page.drawRectangle({
    x: 50,
    y,
    width: barWidth,
    height: 12,
    color: rgb(0.85, 0.85, 0.85),
  });

  page.drawRectangle({
    x: 50,
    y,
    width: filledWidth,
    height: 12,
    color:
      confidence >= 85
        ? rgb(0, 0.6, 0)
        : confidence >= 60
        ? rgb(0.9, 0.6, 0)
        : rgb(0.8, 0, 0),
  });

  y -= 25;

  page.drawText(
    confidence >= 85
      ? "AI is highly confident in the root cause assessment."
      : confidence >= 60
      ? "AI assessment shows moderate confidence."
      : "AI confidence is low. Manual verification recommended.",
    {
      x: 50,
      y,
      size: 12,
      font,
      maxWidth: 500,
    }
  );

  /* ========================= */
  /* FOOTER                    */
  /* ========================= */

  page.drawText("Generated by AutoOps AI Engine", {
    x: 50,
    y: 20,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${incidentId}.pdf"`,
    },
  });
}
