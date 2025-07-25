import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_ID = 'price_1RoiXYBlWJBhJeWFfnDbjwOU'; // New £200 price ID

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

  // Coupon IDs in Stripe (update these if your actual coupon IDs differ)
  const COUPON_LION = 'LION'; // No additional discount, shows £200
  const COUPON_EAGLE_EYES = 'EAGLE-EYES'; // £10 off coupon in Stripe (so user pays £190)

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
      customer_creation: 'always'
    };

    // Coupon logic
    if (couponCode === COUPON_LION) {
      // LION shows base price (£200) - no additional discount needed
      // No discount applied, user pays full £200
    } else if (couponCode === COUPON_EAGLE_EYES) {
      sessionConfig.discounts = [{ coupon: COUPON_EAGLE_EYES }];
    } else if (couponCode) {
      // Invalid code
      return res.status(400).json({ error: 'Invalid coupon code.' });
    }

    // Create the session
    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionConfig);
    } catch (error) {
      // Handle coupon limit reached (e.g., EAGLE-EYES max redemptions)
      if (
        error &&
        error.raw &&
        error.raw.type === 'invalid_request_error' &&
        error.raw.message &&
        error.raw.message.includes('max_redemptions')
      ) {
        return res.status(400).json({ error: 'Sorry, the discount limit has been reached.' });
      }
      // Other Stripe errors
      throw error;
    }
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create checkout session'
    });
  }
} 