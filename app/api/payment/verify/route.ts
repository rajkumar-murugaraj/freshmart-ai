import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment verification parameters' },
        { status: 400 }
      );
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_secret) {
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 503 }
      );
    }

    // Verify signature
    const body_data = razorpay_order_id + '|' + razorpay_payment_id;
    const expected_signature = crypto
      .createHmac('sha256', key_secret)
      .update(body_data)
      .digest('hex');

    const isValid = expected_signature === razorpay_signature;

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: 'Payment verified successfully',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id
      });
    } else {
      return NextResponse.json(
        { error: 'Payment verification failed', success: false },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
