import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

  const { priceId, customerEmail } = req.body;

  try {
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
      discounts: [{ coupon: 'TESTDISCOUNT' }], // Temporarily apply the TESTDISCOUNT coupon for testing
    };

    try {
      const session = await stripe.checkout.sessions.create(sessionConfig);
      return res.status(200).json({ sessionId: session.id });
    } catch (error) {
      // If coupon is invalid or expired, try again without the discount
      if (
        error &&
        error.raw &&
        error.raw.type === 'invalid_request_error' &&
        error.raw.message &&
        (
          error.raw.message.includes('No such coupon') ||
          error.raw.message.includes('expired') ||
          error.raw.message.includes('invalid')
        )
      ) {
        // Remove discounts and try again (full price)
        delete sessionConfig.discounts;
        const session = await stripe.checkout.sessions.create(sessionConfig);
        return res.status(200).json({ sessionId: session.id, fallback: true });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create checkout session'
    });
  }
}
