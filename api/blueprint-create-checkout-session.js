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
  
  // Use the separate prices
  const GBP_PRICE_ID = 'price_1Rju1HBlWJBhJeWFEKp9gmjf'; // £2,135
  const USD_PRICE_ID = 'price_1Rju1MBlWJBhJeWFjjyI1k0e'; // $2,950
  
  // Better geolocation detection
  let priceId = GBP_PRICE_ID;
  let detectedCountry = 'Unknown';
  
  try {
    // Get IP - Vercel puts the real IP in x-forwarded-for
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress;
    
    console.log('Detected IP:', ip); // Debug log
    
    // Don't try geolocation for localhost
    if (ip && !ip.includes('127.0.0.1') && !ip.includes('::1')) {
      try {
        const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
        const geoData = await geoResponse.json();
        
        console.log('Geo response:', geoData); // Debug log
        
        if (geoData && geoData.country_code) {
          detectedCountry = geoData.country_code;
          if (geoData.country_code === 'US') {
            priceId = USD_PRICE_ID;
          }
        }
      } catch (geoError) {
        console.error('Geo lookup failed:', geoError);
      }
    }
  } catch (e) {
    console.error('IP detection error:', e);
  }
  
  console.log('Using price:', priceId, 'for country:', detectedCountry); // Debug log
  
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/work-with-us/blueprint/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { 
        enabled: true,
        required: 'if_supported'
      },
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time',
        price: priceId === USD_PRICE_ID ? '$2,950' : '£2,135',
        detected_country: detectedCountry,
        detected_ip: req.headers['x-forwarded-for'] || 'none'
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always'
    });
    
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating blueprint checkout session:', error);
    return res.status(400).json({ error: error.message || 'Failed to create checkout session' });
  }
}
