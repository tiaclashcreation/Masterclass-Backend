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
  
  // Detect country BEFORE creating session
  let isUSCustomer = false;
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
    if (ip && !ip.includes('127.0.0.1')) {
      const geoResponse = await fetch(`https://ipapi.co/${ip}/country_code/`);
      if (geoResponse.ok) {
        const countryCode = await geoResponse.text();
        isUSCustomer = countryCode.trim() === 'US';
      }
    }
  } catch (e) {
    console.log('Geo detection failed, assuming non-US');
  }
  
  // Set currency and amount based on detected location
  const currency = isUSCustomer ? 'usd' : 'gbp';
  const amount = isUSCustomer ? 295000 : 213500; // $2950 or £2135
  
  const line_items = [
    {
      price_data: {
        currency: currency, // This MUST match the customer's location
        unit_amount: amount,
        product_data: {
          name: 'Blueprint Program',
          description: 'Complete Blueprint training program',
          tax_code: 'txcd_10103000'
        },
        tax_behavior: 'exclusive'
      },
      quantity: 1,
    },
  ];
  
  try {
    const sessionParams = {
      mode: 'payment',
      success_url: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/work-with-us/blueprint/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { 
        enabled: true,
        required: 'if_supported'
      },
      line_items,
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time',
        price: currency === 'usd' ? '$2,950' : '£2,135',
        currency: currency,
        detected_country: isUSCustomer ? 'US' : 'Other'
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
      // IMPORTANT: Disable automatic currency conversion
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic'
        }
      }
    };
    
    // For US customers, restrict to USD only
    if (isUSCustomer) {
      sessionParams.currency = 'usd'; // Force USD for US customers
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating blueprint checkout session:', error);
    return res.status(400).json({ error: error.message || 'Failed to create checkout session' });
  }
}
