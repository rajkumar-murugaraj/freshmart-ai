import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting for AI endpoints
  const { success, response } = await rateLimit(request, 'ai');
  if (!success && response) return response;

  try {
    const { ingredients } = await request.json();

    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Ingredients are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        suggestion: "Sorry, the AI service is not configured. Please add GEMINI_API_KEY to your environment."
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const ingredientList = ingredients.join(', ');
    const prompt = `I have the following ingredients in my grocery cart: ${ingredientList}. Suggest one simple and delicious recipe I can make using some of these ingredients. Provide the recipe name and a very brief instruction summary.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful AI Chef. Keep suggestions concise.",
      }
    });

    return NextResponse.json({
      suggestion: response.text || "I couldn't find a recipe at the moment, but these ingredients look great!"
    });
  } catch (error) {
    console.error('Recipe suggestion error:', error);
    return NextResponse.json({
      suggestion: "Sorry, I'm having trouble connecting to the recipe service right now."
    });
  }
}
