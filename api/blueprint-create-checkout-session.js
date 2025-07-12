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
  
  // Detect customer location
  let detectedCountry = 'GB';
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.socket?.remoteAddress;
    
    if (ip && !ip.includes('127.0.0.1') && !ip.includes('::1')) {
      const geoResponse = await fetch(`https://ipapi.co/${ip}/country_code/`);
      if (geoResponse.ok) {
        const countryCode = await geoResponse.text();
        detectedCountry = countryCode.trim();
      }
    }
  } catch (e) {
    console.log('Geo detection failed, using GB');
  }
  
  // Force US customers to USD, everyone else to GBP
  const isUSCustomer = detectedCountry === 'US';
  const currency = isUSCustomer ? 'usd' : 'gbp';
  const amount = isUSCustomer ? 295000 : 213500;
  const priceDisplay = isUSCustomer ? '$2,950' : '£2,135';
  
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/work-with-us/blueprint/cancel`,
      
      // CRITICAL: Set currency at session level to prevent conversion options
      currency: currency,
      
      // IMPORTANT: Set payment_method_types to restrict options
      payment_method_types: ['card'],
      
      automatic_tax: { enabled: true },
      tax_id_collection: { 
        enabled: true,
        required: 'if_supported' // This ensures B2B tax ID collection
      },
      
      line_items: [{
        price_data: {
          currency: currency, // Must match session currency
          unit_amount: amount,
          product_data: {
            name: 'Blueprint Program',
            description: 'Complete Blueprint training program',
            tax_code: 'txcd_10103000' // Training services tax code
          },
          tax_behavior: 'exclusive' // B2B exclusive pricing
        },
        quantity: 1
      }],
      
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time',
        price: priceDisplay,
        currency: currency,
        detected_country: detectedCountry
      },
      
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
      
      // Disable automatic currency detection
      locale: 'auto' // Let Stripe detect language but not currency
    });
    
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating blueprint checkout session:', error);
    return res.status(400).json({ error: error.message || 'Failed to create checkout session' });
  }
}
