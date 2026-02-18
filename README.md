# 🚨 AutoOps — Self-Healing AI Control Plane

AutoOps is an AI-powered Incident Command System that detects production failures, maps multi-service propagation, generates structured runbooks, and executes human-approved recovery actions in real time.

It simulates how AI would operate inside production infrastructure — not just analyze logs.

---

## 🧠 Core Concept

Modern distributed systems fail across services.

AutoOps transforms raw production logs into:

• Structured incident classification  
• Executive summaries  
• Severity & business impact scoring  
• Root cause probability analysis  
• Failure propagation graphs  
• AI-generated recovery runbooks  
• Controlled execution with human approval  

This is not a chatbot.  
This is an AI control plane simulation.

---

## ⚙️ Architecture Overview

### 🔹 Frontend — Control Room UI (Next.js + React)

- Real-time SSE streaming
- Incident → Recovering → Healthy state transitions
- Multi-service health visualization
- Failure propagation graph
- Live severity & impact metrics
- Human approval gating before execution

---

### 🔹 AI Core — Gemini 1.5 Flash

- Strict JSON schema enforcement
- Structured output parsing
- Deterministic fallback safeguards
- Hybrid severity scoring (AI + topology + blast radius)

Severity is never purely LLM-generated.

---

### 🔹 Execution Layer

- Webhook-based infrastructure simulation
- Explicit human approval required
- Gradual system state transition during recovery
- Real-time metric recalculation

---

### 🔹 Voice Intelligence (Deepgram)

- Speech-to-text transcription
- Speech rate calculation
- Confidence scoring
- Stress detection heuristics
- Automatic severity adjustment if stress signals detected

Incident response is technical — and human.

---

### 🔹 Enterprise Reporting

- PDF incident report generation (pdf-lib)
- Executive summary
- Root cause breakdown
- AI confidence visualization
- External intelligence enrichment

---

## 🛠 Tech Stack

- Next.js (App Router)
- React
- TypeScript
- Node.js
- Gemini 1.5 Flash
- Server-Sent Events (SSE)
- Deepgram API
- Webhook execution simulation
- pdf-lib
- TailwindCSS

---

## 🚀 Getting Started

Install dependencies:

```bash
npm install
Run development server:


npm run dev
Open:


http://localhost:3000
🔐 Environment Variables
Create .env.local:


GEMINI_API_KEY=your_key
DEEPGRAM_API_KEY=your_key
WEBHOOK_URL=https://your-webhook-endpoint
🧩 Future Roadmap
Kubernetes API integration

OpenTelemetry ingestion

Terraform/AWS adapters

Policy-driven auto-remediation guardrails

Multi-region blast radius modeling

Historical incident memory

Autonomous rollback engine

🎯 Vision
AutoOps evolves from simulation
into a real AI-powered Incident Command System operating inside production infrastructure.

Not beside it.
