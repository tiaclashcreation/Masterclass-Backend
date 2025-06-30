const Stripe = require('stripe');

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  console.log('[FUNDAMENTALS WEBHOOK] Handler invoked.');
  if (req.method !== 'POST') {
    console.log('[FUNDAMENTALS WEBHOOK] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_FUNDAMENTALS;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
    console.log('[FUNDAMENTALS WEBHOOK] Stripe event received:', event.type);
  } catch (err) {
    console.error('[FUNDAMENTALS WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('[FUNDAMENTALS WEBHOOK] Processing checkout.session.completed event.');
      
      if (session.payment_status === 'paid') {
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerName = session.customer_details?.name || '';
        console.log('[FUNDAMENTALS WEBHOOK] Customer email:', customerEmail);
        console.log('[FUNDAMENTALS WEBHOOK] Customer name:', customerName);

        // --- KAJABI ENROLLMENT USING WEBHOOK ---
        if (session.metadata?.product === 'The Viral Video Fundamentals: Your First 1,000,000 views') {
          try {
            const KAJABI_ACTIVATION_URL = process.env.KAJABI_ACTIVATION_URL;
            if (!KAJABI_ACTIVATION_URL) {
              throw new Error('KAJABI_ACTIVATION_URL not configured');
            }
            console.log('[FUNDAMENTALS WEBHOOK] Attempting Kajabi enrollment');
            const kajabiResponse = await fetchJson(KAJABI_ACTIVATION_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: customerName,
                email: customerEmail,
                external_user_id: customerEmail
              })
            });
            console.log('[FUNDAMENTALS WEBHOOK] Kajabi enrollment successful:', kajabiResponse);
          } catch (kajabiError) {
            console.error('[FUNDAMENTALS WEBHOOK] Kajabi enrollment error:', kajabiError.message);
            // Don't throw here, continue with ConvertKit
          }
        }

        // --- CONVERTKIT INTEGRATION ---
        try {
          const KIT_API_KEY = process.env.KIT_API_KEY;
          const PURCHASE_FORM_ID = process.env.KIT_PURCHASE_FORM_ID;
          if (PURCHASE_FORM_ID && KIT_API_KEY) {
            console.log('[FUNDAMENTALS WEBHOOK] Adding to ConvertKit form:', PURCHASE_FORM_ID);
            const response = await fetchJson(
              `https://api.convertkit.com/v3/forms/${PURCHASE_FORM_ID}/subscribe?api_secret=${KIT_API_KEY}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  email: customerEmail,
                  first_name: customerName.split(' ')[0] || ''
                })
              }
            );
            console.log('[FUNDAMENTALS WEBHOOK] ConvertKit subscription successful:', response);
          }
        } catch (error) {
          console.error('[FUNDAMENTALS WEBHOOK] ConvertKit error:', error.message);
          // Don't throw here, continue with response
        }
      }
    }

    // Always return a 200 response to Stripe
    console.log('[FUNDAMENTALS WEBHOOK] Processing complete');
    return res.status(200).json({ received: true });
    
  } catch (err) {
    console.error('[FUNDAMENTALS WEBHOOK] Processing error:', err.message);
    // Still return a 200 to acknowledge receipt
    return res.status(200).json({ 
      received: true,
      error: err.message 
    });
  }
} 