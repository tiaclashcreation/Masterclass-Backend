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

  const { customerEmail, currency } = req.body;

  // Set price ID based on currency
  let priceId;
  if (currency === 'usd') {
    priceId = 'price_1RaSn5BlWJBhJeWFMvVu8RG1';
  } else if (currency === 'gbp') {
    priceId = 'price_1RaSmIBlWJBhJeWFBpboNdnW';
  } else {
    return res.status(400).json({ error: 'Invalid currency' });
  }

  const line_items = [
    {
      price: priceId,
      quantity: 1,
    },
  ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/creator/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/creator/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      line_items,
      metadata: {
        product: 'Creator',
        payment_type: 'one-time',
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
    });
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(400).json({ error: error.message || 'Failed to create checkout session' });
  }
} 