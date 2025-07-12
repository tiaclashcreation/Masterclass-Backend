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
  
  // Get customer's country from their IP
  let customerCountry = 'GB'; // Default to UK
  try {
    // Get IP from headers (works with Vercel, Netlify, etc.)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress;
    
    // Use a geolocation service
    if (ip && !ip.includes('127.0.0.1') && !ip.includes('::1')) {
      const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        customerCountry = geoData.country_code || 'GB';
      }
    }
  } catch (error) {
    console.error('Geolocation failed, using default GB:', error);
  }
  
  // Determine price based on detected location
  // US gets USD pricing, everyone else gets GBP pricing
  const isUSCustomer = customerCountry === 'US';
  const currency = isUSCustomer ? 'usd' : 'gbp';
  const amount = isUSCustomer ? 295000 : 213500; // $2950.00 or £2135.00
  const priceDisplay = isUSCustomer ? '$2,950' : '£2,135';
  
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/work-with-us/blueprint/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { 
        enabled: true,
        required: 'if_supported' // Forces collection for B2B
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
            payment_type: 'one-time',
            price: priceDisplay,
            currency: currency,
            detected_country: customerCountry
          }
        }
      },
      line_items: [
        {
          price_data: {
            currency: currency,
            unit_amount: amount,
            product_data: {
              name: 'Blueprint Program',
              description: 'Complete Blueprint training program',
              tax_code: 'txcd_10103000' // Training services
            },
            tax_behavior: 'exclusive' // B2B tax exclusive
          },
          quantity: 1,
        }
      ],
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time',
        price: priceDisplay,
        currency: currency,
        detected_country: customerCountry
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always',
      // Remove shipping_address_collection entirely, or include all countries you ship to
      // shipping_address_collection: {
      //   allowed_countries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'FR', 'DE', 'NL', 'ES', 'IT', ...]
      // }
    });
