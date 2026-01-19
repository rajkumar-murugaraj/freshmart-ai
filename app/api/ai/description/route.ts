import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting for AI endpoints
  const { success, response } = await rateLimit(request, 'ai');
  if (!success && response) return response;

  try {
    const { name, category } = await request.json();

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        description: "Fresh and high-quality product."
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Write a short, appetizing, and catchy description (max 2 sentences) for a grocery product named "${name}" which is in the "${category}" category. Focus on freshness and quality.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return NextResponse.json({
      description: response.text || "Fresh and high-quality product."
    });
  } catch (error) {
    console.error('Description generation error:', error);
    return NextResponse.json({
      description: "Fresh and high-quality product."
    });
  }
}
