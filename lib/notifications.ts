import { Resend } from 'resend';

// Resend client configuration
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('Email not configured: Missing RESEND_API_KEY');
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

// Twilio client configuration
let twilioClient: any = null;

async function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.log('SMS not configured: Missing Twilio credentials');
    return null;
  }

  try {
    const twilio = await import('twilio');
    twilioClient = twilio.default(accountSid, authToken);
    return twilioClient;
  } catch (error) {
    console.error('Failed to initialize Twilio:', error);
    return null;
  }
}

// Send Email using Resend
export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const client = getResendClient();
  if (!client) {
    console.log(`Email skipped (not configured): ${subject} to ${to}`);
    return false;
  }

  try {
    const fromEmail = process.env.FROM_EMAIL || 'FreshMart AI <onboarding@resend.dev>';

    const { error } = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html,
      text: text || subject,
    });

    if (error) {
      console.error('Email send error:', error);
      return false;
    }

    console.log(`Email sent: ${subject} to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// Send SMS using Twilio
export async function sendSMS(to: string, message: string): Promise<boolean> {
  const client = await getTwilioClient();
  if (!client) {
    console.log(`SMS skipped (not configured): ${message} to ${to}`);
    return false;
  }

  try {
    let fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!fromNumber) {
      console.log('SMS skipped: Missing TWILIO_FROM_NUMBER');
      return false;
    }

    // Remove any spaces from the from number
    fromNumber = fromNumber.replace(/\s/g, '');

    // Format phone number for India (+91)
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) {
      formattedTo = '+91' + formattedTo;
    } else if (!formattedTo.startsWith('+')) {
      formattedTo = '+' + formattedTo;
    }

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedTo,
    });
    console.log(`SMS sent: ${message} to ${formattedTo}`);
    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

// Order confirmation email template
export function getOrderConfirmationEmail(orderId: string, customerName: string, total: number, items: any[]): string {
  const itemsList = items
    .map(item => `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantity}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">₹${item.price * item.quantity}</td></tr>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">FreshMart AI</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Your Smart Grocery Store</p>
      </div>

      <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #22c55e; margin-top: 0;">Order Confirmed!</h2>

        <p>Hi <strong>${customerName}</strong>,</p>
        <p>Thank you for your order! We've received your order and will begin processing it right away.</p>

        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Order ID:</strong> #${orderId}</p>
          <p style="margin: 5px 0 0;"><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
        </div>

        <h3 style="border-bottom: 2px solid #22c55e; padding-bottom: 10px;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: left;">Qty</th>
              <th style="padding: 10px; text-align: left;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 15px 8px; font-weight: bold; font-size: 18px;">Total</td>
              <td style="padding: 15px 8px; font-weight: bold; font-size: 18px; color: #22c55e;">₹${total}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 30px; padding: 20px; background: #ecfdf5; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #166534;">We'll notify you when your order is out for delivery!</p>
        </div>

        <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
          If you have any questions, feel free to reply to this email or contact our support team.
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>© ${new Date().getFullYear()} FreshMart AI. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

// Order status update email template
export function getOrderStatusEmail(orderId: string, customerName: string, status: string): string {
  const statusMessages: { [key: string]: { emoji: string; message: string; color: string } } = {
    pending: { emoji: '⏳', message: 'Your order is being processed', color: '#f59e0b' },
    completed: { emoji: '✅', message: 'Your order has been delivered', color: '#22c55e' },
    cancelled: { emoji: '❌', message: 'Your order has been cancelled', color: '#ef4444' },
  };

  const statusInfo = statusMessages[status] || statusMessages.pending;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Status Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">FreshMart AI</h1>
      </div>

      <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <div style="text-align: center; padding: 20px;">
          <span style="font-size: 48px;">${statusInfo.emoji}</span>
          <h2 style="color: ${statusInfo.color}; margin: 10px 0;">${statusInfo.message}</h2>
        </div>

        <p>Hi <strong>${customerName}</strong>,</p>
        <p>Your order <strong>#${orderId}</strong> status has been updated to: <span style="color: ${statusInfo.color}; font-weight: bold; text-transform: uppercase;">${status}</span></p>

        ${status === 'completed' ? `
          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #166534;">Thank you for shopping with FreshMart AI! We hope to serve you again soon.</p>
          </div>
        ` : ''}

        ${status === 'cancelled' ? `
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b;">If you have any questions about this cancellation, please contact our support team.</p>
          </div>
        ` : ''}
      </div>

      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>© ${new Date().getFullYear()} FreshMart AI. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

// Admin new order notification email
export function getAdminOrderNotificationEmail(orderId: string, customerName: string, customerEmail: string, customerPhone: string, total: number): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Order Received</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">New Order Alert</h1>
      </div>

      <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #3b82f6; margin-top: 0;">New Order Received!</h2>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%;">
            <tr><td style="padding: 5px 0; color: #6b7280;">Order ID:</td><td style="padding: 5px 0; font-weight: bold;">#${orderId}</td></tr>
            <tr><td style="padding: 5px 0; color: #6b7280;">Customer:</td><td style="padding: 5px 0; font-weight: bold;">${customerName}</td></tr>
            <tr><td style="padding: 5px 0; color: #6b7280;">Email:</td><td style="padding: 5px 0;">${customerEmail}</td></tr>
            <tr><td style="padding: 5px 0; color: #6b7280;">Phone:</td><td style="padding: 5px 0;">${customerPhone}</td></tr>
            <tr><td style="padding: 5px 0; color: #6b7280;">Total:</td><td style="padding: 5px 0; font-weight: bold; color: #22c55e; font-size: 18px;">₹${total}</td></tr>
          </table>
        </div>

        <p style="color: #6b7280;">Please login to the admin dashboard to view and process this order.</p>
      </div>
    </body>
    </html>
  `;
}

// SMS Templates
export const smsTemplates = {
  orderConfirmation: (orderId: string, total: number) =>
    `FreshMart AI: Your order #${orderId} for Rs.${total} has been confirmed! We'll notify you when it's out for delivery.`,

  orderStatusUpdate: (orderId: string, status: string) =>
    `FreshMart AI: Your order #${orderId} status: ${status.toUpperCase()}. Thank you for shopping with us!`,

  adminNewOrder: (orderId: string, customerName: string, total: number) =>
    `FreshMart Admin: New order #${orderId} from ${customerName} for Rs.${total}. Please check dashboard.`,
};
