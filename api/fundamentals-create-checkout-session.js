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
  console.log('Received request:', { customerEmail, couponCode });

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
      console.log('Applying LION coupon');
      try {
        // Verify the coupon exists first
        const coupon = await stripe.coupons.retrieve('LION');
        console.log('Found coupon:', coupon);
        
        sessionConfig.discounts = [{
          coupon: 'LION'
        }];
      } catch (couponError) {
        console.error('Error retrieving coupon:', couponError);
        return res.status(400).json({
          error: 'Invalid coupon code'
        });
      }
    }

    console.log('Creating checkout session with config:', sessionConfig);
    const session = await stripe.checkout.sessions.create(sessionConfig);
    console.log('Session created:', session.id);
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating fundamentals checkout session:', error);
    // Log the full error object for debugging
    console.error('Full error:', {
      message: error.message,
      type: error.type,
      raw: error.raw,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: error.message || 'Failed to create checkout session',
      details: error.raw || error.type || 'Unknown error'
    });
  }
} 