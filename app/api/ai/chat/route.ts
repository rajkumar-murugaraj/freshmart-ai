import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting for AI endpoints (expensive operations)
  const { success, response } = await rateLimit(request, 'ai');
  if (!success && response) return response;

  try {
    const { message, cartItems } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        response: "I'm sorry, but the AI service is not configured yet. Please add your GEMINI_API_KEY to the environment variables to enable AI features.\n\nIn the meantime, here are some general tips:\n- Fresh vegetables should be stored in the refrigerator\n- Fruits like bananas ripen faster at room temperature\n- Most herbs can be stored in a glass of water like flowers"
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build context about the cart
    let cartContext = '';
    if (cartItems && cartItems.length > 0) {
      cartContext = `\n\nThe user currently has these items in their grocery cart: ${cartItems.join(', ')}.`;
    }

    const systemPrompt = `You are FreshMart AI Chef, a friendly and knowledgeable cooking assistant for an Indian grocery store app. You help users with:

1. RECIPES: Suggest simple, delicious recipes (Indian and international) using available ingredients. Include brief cooking instructions.

2. MEAL PLANNING: Create balanced weekly meal plans considering nutrition, variety, and practicality.

3. NUTRITION: Provide accurate nutritional information about foods, their health benefits, and dietary considerations.

4. INGREDIENT SUBSTITUTES: Suggest healthy alternatives for ingredients (e.g., coconut oil instead of butter, jaggery instead of sugar).

5. COOKING TIPS: Share practical cooking tips, storage advice, and kitchen hacks.

Guidelines:
- Be concise but informative (keep responses under 300 words unless detailed instructions are needed)
- Use Indian food names where appropriate (dal, roti, sabzi, etc.)
- Consider common Indian dietary preferences (vegetarian options)
- Include cooking times and serving sizes when sharing recipes
- Be encouraging and supportive
- Use bullet points and formatting for readability
- When suggesting recipes, prioritize using items from the user's cart
${cartContext}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: message,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1024,
      }
    });

    return NextResponse.json({
      response: response.text || "I'm having trouble generating a response. Please try asking differently!"
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json({
      response: "I'm sorry, I'm having trouble connecting to the AI service right now. Please try again in a moment!"
    });
  }
}
