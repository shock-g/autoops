// app/api/transcribe/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const deepgramRes = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&detect_language=true&smart_format=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "audio/webm",
        },
        body: buffer,
      }
    );

   const data = await deepgramRes.json();

const alternative =
  data?.results?.channels?.[0]?.alternatives?.[0] ?? {};

const text = alternative?.transcript ?? "";
const confidence = alternative?.confidence ?? 0;
const words = alternative?.words ?? [];

// 🔥 Speech Rate 계산 (words per second)
let speechRate = 0;

if (words.length > 1) {
  const duration =
    words[words.length - 1].end - words[0].start;

  if (duration > 0) {
    speechRate = words.length / duration;
  }
}

return NextResponse.json({
  text,
  voice_meta: {
    confidence,
    speech_rate: speechRate,
    word_count: words.length
  }
});

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Transcription failed" },
      { status: 500 }
    );
  }
}
