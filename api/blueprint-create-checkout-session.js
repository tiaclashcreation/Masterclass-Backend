import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://clashcreation.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { customerEmail } = req.body;
  
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/work-with-us/blueprint/cancel`,
      
      line_items: [{
        price: 'price_1RjuN4BlWJBhJeWFeWpiw2oO', // Your new multi-currency price
        quantity: 1
      }],
      
      // Don't set currency - let Stripe's adaptive pricing work with your defined prices
      
      automatic_tax: { enabled: true },
      tax_id_collection: { 
        enabled: true,
        required: 'if_supported'
      },
      
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
      
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time',
        price_id: 'price_1RjuN4BlWJBhJeWFeWpiw2oO'
      }
    });
    
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating blueprint checkout session:', error);
    return res.status(400).json({ error: error.message || 'Failed to create checkout session' });
  }
}
