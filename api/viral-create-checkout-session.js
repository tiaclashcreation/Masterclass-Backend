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

  const { addTeamTraining, customerEmail } = req.body;

  // Always include the main course
  const line_items = [
    {
      price_data: {
        currency: 'gbp',
        unit_amount: 350000, // £3,500.00 in pence
        product_data: {
          name: 'The Vertical Shortcut - Main Package',
          description: 'Turn your personal brand into a personal machine with our proven system for short form content.'
        },
      },
      quantity: 1,
    }
  ];

  if (addTeamTraining) {
    line_items.push({
      price_data: {
        currency: 'gbp',
        unit_amount: 75000, // £750.00 in pence
        product_data: {
          name: 'The Vertical Shortcut - Team Training Add-on',
          description: 'Team training for your content team.'
        },
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/viral/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/viral/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      line_items,
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