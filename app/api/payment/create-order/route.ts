import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

// Initialize Razorpay instance
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials not configured');
  }

  return new Razorpay({
    key_id,
    key_secret
  });
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency = 'INR', receipt, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const razorpay = getRazorpayInstance();

    // Create Razorpay order
    // Amount should be in smallest currency unit (paise for INR)
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes || {}
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error: any) {
    console.error('Razorpay order creation error:', error);

    // Check if it's a credentials error
    if (error.message === 'Razorpay credentials not configured') {
      return NextResponse.json(
        { error: 'Payment gateway not configured. Please contact support.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
