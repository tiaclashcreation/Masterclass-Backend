// api/intensive-redirect.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Detect country
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
  
  const currency = isUSCustomer ? 'usd' : 'gbp';
  const amount = isUSCustomer ? 295000 : 213500;
  
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://clashcreation.com/work-with-us/blueprint/cancel`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true, required: 'if_supported' },
      line_items: [{
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
      }],
      metadata: {
        product: 'Blueprint Program',
        payment_type: 'one-time',
        price: currency === 'usd' ? '$2,950' : '£2,135',
        currency: currency,
        detected_country: isUSCustomer ? 'US' : 'Other'
      },
      billing_address_collection: 'required',
      customer_email: req.query.email || undefined,
      customer_creation: 'always'
    });
    
    // Redirect directly instead of returning JSON
    res.redirect(303, session.url);
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.redirect(303, 'https://clashcreation.com/work-with-us/blueprint');
  }
}
