import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Actual price IDs
const MAIN_COURSE_PRICE_ID = 'price_1RYweyBlWJBhJeWFpOuUOCK9'; // Vertical Shortcut (updated)
const TEAM_TRAINING_PRICE_ID = 'price_1RYwboBlWJBhJeWF7F3NUqWv'; // Team Training add-on

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

  const { priceIds, customerEmail } = req.body;
  if (!Array.isArray(priceIds) || priceIds.length === 0) {
    return res.status(400).json({ error: 'Missing priceIds' });
  }

  // Ensure main course is always present
  if (!priceIds.includes(MAIN_COURSE_PRICE_ID)) {
    return res.status(400).json({ error: 'Main course must be included to purchase.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${process.env.DOMAIN || 'https://your-domain.com'}/vs-masterclass/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN || 'https://your-domain.com'}/vs-masterclass/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      line_items: priceIds.map(price => ({ price, quantity: 1 })),
      metadata: {
        product: 'The Vertical Shortcut',
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