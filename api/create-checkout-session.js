import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Respond to preflight request
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { priceId, customerEmail } = req.body;

  try {
    // Fetch the promotion code ID for 'TCA4' from Stripe
    const promotionCodes = await stripe.promotionCodes.list({
      code: 'TCA4',
      active: true,
      limit: 1,
    });
    const promoCodeId = promotionCodes.data[0]?.id;

    let sessionConfig = {
      mode: 'payment',
      success_url: `${process.env.DOMAIN || 'https://your-domain.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN || 'https://your-domain.com'}/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      metadata: {
        product: 'The Viral Video Fundamentals: Your First 1,000,000 views',
        payment_type: 'one-time'
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
    };

    if (promoCodeId) {
      sessionConfig.discounts = [{ promotion_code: promoCodeId }];
    }
    // If promo code is not found or expired, no discount will be applied (full price)

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create checkout session'
    });
  }
}
