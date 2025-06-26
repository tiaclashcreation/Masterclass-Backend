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

  const { customerEmail } = req.body;

  // Fixed price for Blueprint: £2135
  const line_items = [
    {
      price_data: {
        currency: 'gbp',
        unit_amount: 213500, // £2135.00 in pence
        product_data: {
          name: 'Blueprint Program',
          description: 'Complete Blueprint training program'
        },
      },
      quantity: 1,
    },
  ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/work-with-us/blueprint/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      line_items,
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time',
        price: '£2135'
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
    });
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating blueprint checkout session:', error);
    return res.status(400).json({ error: error.message || 'Failed to create checkout session' });
  }
} 