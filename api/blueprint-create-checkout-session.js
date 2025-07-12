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
    // Create session with BOTH price options
    // Stripe will automatically select based on customer's location
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/work-with-us/blueprint/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { 
        enabled: true,
        required: 'if_supported'
      },
      customer_update: {
        address: 'auto',
        name: 'auto'
      },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          metadata: {
            transaction_type: 'b2b',
            product: 'Blueprint Program',
            payment_type: 'one-time'
          }
        }
      },
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: 213500, // £2135.00
            product_data: {
              name: 'Blueprint Program',
              description: 'Complete Blueprint training program',
              tax_code: 'txcd_10103000'
            },
            tax_behavior: 'exclusive'
          },
          quantity: 1,
        }
      ],
      // This is the key: allow automatic currency conversion
      currency_options: {
        usd: {
          unit_amount: 295000 // $2950.00 when shown in USD
        }
      },
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time'
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
      shipping_address_collection: {
        allowed_countries: ['GB', 'US']
      }
    });
    
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating blueprint checkout session:', error);
    return res.status(400).json({ error: error.message || 'Failed to create checkout session' });
  }
}
