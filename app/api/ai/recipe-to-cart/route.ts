import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import db from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const { success, response } = await rateLimit(request, 'ai');
  if (!success && response) return response;

  try {
    const { dish } = await request.json();
    if (!dish || typeof dish !== 'string') {
      return NextResponse.json({ error: 'Dish name is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `List the key grocery ingredients needed to make "${dish}" for 2 servings.
Return STRICT JSON only, no markdown, no commentary, in this shape:
{"ingredients":[{"name":"<simple ingredient name>","quantity":"<e.g. 500g, 2, 1 cup>"}]}
Use short common names (e.g. "tomato", "paneer", "milk"). Max 10 items.`;

    const aiResp = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction: 'You return strict JSON only.' },
    });

    let parsed: { ingredients: { name: string; quantity: string }[] } = { ingredients: [] };
    try {
      const raw = (aiResp.text || '').trim().replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '');
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Could not parse recipe ingredients' }, { status: 500 });
    }

    const ingredients = (parsed.ingredients || []).slice(0, 10);

    const allProducts = db.prepare('SELECT * FROM products').all() as any[];

    const matched: any[] = [];
    const unmatched: { name: string; quantity: string }[] = [];

    for (const ing of ingredients) {
      const needle = ing.name.toLowerCase().trim();
      const hit = allProducts.find((p) => {
        const n = (p.name || '').toLowerCase();
        return n.includes(needle) || needle.includes(n.split(' ')[0]);
      });
      if (hit) {
        matched.push({ ...hit, id: String(hit.id), requestedQuantity: ing.quantity });
      } else {
        unmatched.push(ing);
      }
    }

    return NextResponse.json({
      dish,
      ingredients,
      matched,
      unmatched,
    });
  } catch (error) {
    console.error('Recipe-to-cart error:', error);
    return NextResponse.json({ error: 'Failed to generate ingredient list' }, { status: 500 });
  }
}
