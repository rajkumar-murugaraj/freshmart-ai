import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ParsedItem {
  productName: string;
  quantity: number;
  unit?: string;
  confidence: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string;
  description: string;
  image: string;
  stock?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { transcript, products } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      );
    }

    // Get products from database if not provided
    let availableProducts: Product[] = products || [];
    if (!availableProducts.length) {
      availableProducts = db.prepare('SELECT * FROM products').all() as Product[];
    }

    const productNames = availableProducts.map(p => p.name).join(', ');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a shopping assistant for a grocery store. Parse the user's voice command and extract items they want to add to their cart.

Available products in the store: ${productNames}

User said: "${transcript}"

Extract each item the user wants with:
1. Product name (match to available products as closely as possible)
2. Quantity (default to 1 if not specified)
3. Unit if mentioned (kg, pack, liter, piece, etc.)

IMPORTANT:
- Match product names to the available products list
- If user says "onions", match it to "Onion" if that exists
- Handle plurals and common variations
- Be lenient with matching but accurate

Respond in JSON format only, no other text:
{
  "items": [
    {"productName": "exact product name from list", "quantity": 1, "unit": "kg", "confidence": 0.9}
  ],
  "understood": true,
  "message": "brief confirmation message"
}

If you couldn't understand the request:
{
  "items": [],
  "understood": false,
  "message": "explanation of what went wrong"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Clean up the response - remove markdown code blocks if present
    if (text.startsWith('```json')) {
      text = text.slice(7);
    } else if (text.startsWith('```')) {
      text = text.slice(3);
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    const parsed = JSON.parse(text);

    // Match parsed items to actual products
    const matchedItems = [];
    for (const item of parsed.items || []) {
      const searchName = item.productName.toLowerCase();

      // Find best matching product
      let bestMatch: Product | null = null;
      let bestScore = 0;

      for (const product of availableProducts) {
        const productLower = product.name.toLowerCase();

        // Exact match
        if (productLower === searchName) {
          bestMatch = product;
          bestScore = 1;
          break;
        }

        // Contains match
        if (productLower.includes(searchName) || searchName.includes(productLower)) {
          const score = 0.8;
          if (score > bestScore) {
            bestMatch = product;
            bestScore = score;
          }
        }

        // Partial word match
        const productWords = productLower.split(' ');
        const searchWords = searchName.split(' ');
        for (const sw of searchWords) {
          for (const pw of productWords) {
            if (pw.startsWith(sw) || sw.startsWith(pw)) {
              const score = 0.6;
              if (score > bestScore) {
                bestMatch = product;
                bestScore = score;
              }
            }
          }
        }
      }

      if (bestMatch && bestScore >= 0.5) {
        matchedItems.push({
          product: bestMatch,
          quantity: item.quantity || 1,
          unit: item.unit || bestMatch.unit,
          confidence: item.confidence * bestScore
        });
      }
    }

    return NextResponse.json({
      success: true,
      understood: parsed.understood,
      message: parsed.message,
      items: matchedItems,
      originalTranscript: transcript
    });

  } catch (error: any) {
    console.error('Voice parse error:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse voice command',
        message: error.message
      },
      { status: 500 }
    );
  }
}
