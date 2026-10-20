import OpenAI from "openai";
import { connection } from "next/server";

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

export async function GET() {
  await connection();
  const response = await client.chat.completions.create({
    model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    messages: [
      { role: "user", content: "Say hello in German and English, one short sentence each." },
    ],
  });
  return Response.json({ answer: response.choices[0].message.content });
}