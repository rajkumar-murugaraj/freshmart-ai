import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    // Get all products from database for matching
    const products = db.prepare(`
      SELECT id, name, stock, min_stock, unit, category, price, cost_price
      FROM products
    `).all() as any[];

    const productNames = products.map(p => p.name).join(', ');

    // Use Gemini Vision to analyze the bill
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this purchase bill/invoice image and extract the product items with their quantities.

Available products in our inventory: ${productNames}

Instructions:
1. Look for product names, item descriptions, quantities, and prices in the bill
2. Match the items found with the available products list (use fuzzy matching for similar names)
3. Extract the quantity for each matched product
4. If a unit is mentioned (kg, g, pieces, packs, etc.), include it

Return the data as a JSON array with this exact format:
{
  "items": [
    {
      "billName": "exact name as shown in bill",
      "matchedProduct": "matched product name from inventory or null if no match",
      "quantity": number,
      "unit": "kg/g/piece/pack/etc",
      "price": number or null,
      "confidence": "high/medium/low"
    }
  ],
  "billInfo": {
    "vendor": "vendor name if visible",
    "date": "date if visible",
    "total": number or null,
    "billNumber": "bill/invoice number if visible"
  }
}

Only return valid JSON, no markdown formatting or explanation.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
      },
      prompt,
    ]);

    const responseText = result.response.text();

    // Parse the JSON response
    let parsedData;
    try {
      // Remove any markdown code blocks if present
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse bill data', rawResponse: responseText },
        { status: 500 }
      );
    }

    // Match extracted items with database products
    const matchedItems = parsedData.items.map((item: any) => {
      let matchedProduct = null;

      if (item.matchedProduct) {
        // Try exact match first
        matchedProduct = products.find(
          p => p.name.toLowerCase() === item.matchedProduct.toLowerCase()
        );

        // Try partial match if no exact match
        if (!matchedProduct) {
          matchedProduct = products.find(
            p => p.name.toLowerCase().includes(item.matchedProduct.toLowerCase()) ||
                 item.matchedProduct.toLowerCase().includes(p.name.toLowerCase())
          );
        }
      }

      // If still no match, try matching with billName
      if (!matchedProduct && item.billName) {
        matchedProduct = products.find(
          p => p.name.toLowerCase().includes(item.billName.toLowerCase()) ||
               item.billName.toLowerCase().includes(p.name.toLowerCase())
        );
      }

      return {
        ...item,
        product: matchedProduct ? {
          id: matchedProduct.id,
          name: matchedProduct.name,
          currentStock: matchedProduct.stock,
          unit: matchedProduct.unit,
          price: matchedProduct.price,
          cost_price: matchedProduct.cost_price
        } : null,
        isMatched: !!matchedProduct
      };
    });

    return NextResponse.json({
      success: true,
      items: matchedItems,
      billInfo: parsedData.billInfo,
      totalProducts: products.length,
      matchedCount: matchedItems.filter((i: any) => i.isMatched).length
    });

  } catch (error: any) {
    console.error('Bill scan error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process bill image' },
      { status: 500 }
    );
  }
}

// Endpoint to apply stock updates from scanned bill
export async function PUT(request: NextRequest) {
  try {
    const { items, userId, billInfo } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items to update' },
        { status: 400 }
      );
    }

    const results: any[] = [];
    const reason = billInfo?.vendor
      ? `Bill from ${billInfo.vendor}${billInfo.billNumber ? ` #${billInfo.billNumber}` : ''}`
      : 'Stock update from bill scan';

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        results.push({ ...item, success: false, error: 'Invalid item data' });
        continue;
      }

      try {
        // Get current stock
        const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.productId) as any;

        if (!product) {
          results.push({ ...item, success: false, error: 'Product not found' });
          continue;
        }

        const newStock = product.stock + item.quantity;

        // Update stock
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, item.productId);

        // Record transaction
        db.prepare(`
          INSERT INTO stock_transactions (product_id, type, quantity, reason, created_by)
          VALUES (?, 'add', ?, ?, ?)
        `).run(item.productId, item.quantity, reason, userId || null);

        results.push({
          productId: item.productId,
          productName: item.productName,
          previousStock: product.stock,
          addedQuantity: item.quantity,
          newStock: newStock,
          success: true
        });
      } catch (err: any) {
        results.push({ ...item, success: false, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });

  } catch (error: any) {
    console.error('Stock update from bill error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update stock' },
      { status: 500 }
    );
  }
}
