import Stripe from 'stripe';

export default async function handler(req, res) {
  // Set CORS headers immediately, before any potential errors
  res.setHeader('Access-Control-Allow-Origin', 'https://clashcreation.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Initialize Stripe inside try block to catch initialization errors
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const { customerEmail } = req.body;
    
    // Get customer's country from their IP with better error handling
    let customerCountry = 'GB'; // Default to UK
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress;
      
      if (ip && !ip.includes('127.0.0.1') && !ip.includes('::1')) {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        try {
          const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
            signal: controller.signal
          });
          clearTimeout(timeout);
          
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData.country_code) {
              customerCountry = geoData.country_code;
            }
          }
        } catch (geoError) {
          console.log('Geolocation skipped:', geoError.message);
        }
      }
    } catch (error) {
      console.log('IP detection failed, using default');
    }
    
    // Determine price based on detected location
    const isUSCustomer = customerCountry === 'US';
    const currency = isUSCustomer ? 'usd' : 'gbp';
    const amount = isUSCustomer ? 295000 : 213500;
    const priceDisplay = isUSCustomer ? '$2,950' : '£2,135';
    
    // Create Stripe session
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
            payment_type: 'one-time',
            price: priceDisplay,
            currency: currency
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
              tax_code: 'txcd_10103000'
            },
            tax_behavior: 'exclusive'
          },
          quantity: 1,
        }
      ],
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time',
        price: priceDisplay
      },
      billing_address_collection: 'required',
      customer_email: customerEmail || undefined,
      customer_creation: 'always'
    });
    
    return res.status(200).json({ sessionId: session.id });
    
  } catch (error) {
    console.error('Error in checkout session:', error);
    
    // Return a proper error response with CORS headers already set
    return res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
