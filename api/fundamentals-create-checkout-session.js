import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_ID = 'price_1RWAHLBlWJBhJeWF4ZXPS7eL';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://clashcreation.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Respond to preflight request
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customerEmail, couponCode } = req.body;

  try {
    let sessionConfig = {
      mode: 'payment',
      success_url: `https://clashcreation.com/academy/fundamentals/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/academy/fundamentals/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      line_items: [{
        price: PRICE_ID,
        quantity: 1,
      }],
      metadata: {
        product: 'The Viral Video Fundamentals: Your First 1,000,000 views',
        payment_type: 'one-time'
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
      allow_promotion_codes: false // Disable Stripe's built-in promo code field
    };

    // Apply 50% off coupon if code is "LION"
    if (couponCode === 'LION') {
      sessionConfig.discounts = [{
        coupon: 'LION'
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create checkout session'
    });
  }
} 