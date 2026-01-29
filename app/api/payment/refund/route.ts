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
    const { payment_id, amount, notes } = body;

    if (!payment_id) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    const razorpay = getRazorpayInstance();

    // Create refund
    const refundOptions: any = {
      notes: notes || {}
    };

    // If amount is specified, it's a partial refund (amount in paise)
    if (amount) {
      refundOptions.amount = Math.round(amount * 100);
    }

    const refund = await razorpay.payments.refund(payment_id, refundOptions);

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        payment_id: refund.payment_id,
        amount: (refund.amount || 0) / 100, // Convert back to rupees
        status: refund.status,
        created_at: refund.created_at
      }
    });
  } catch (error: any) {
    console.error('Razorpay refund error:', error);

    if (error.message === 'Razorpay credentials not configured') {
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 503 }
      );
    }

    // Handle Razorpay API errors
    if (error.error) {
      return NextResponse.json(
        { error: error.error.description || 'Refund failed' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}
