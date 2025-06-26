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
  console.log('Fundamentals webhook handler invoked.');
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_FUNDAMENTALS;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
    console.log('Fundamentals Stripe event received:', event.type);
  } catch (err) {
    console.error('Fundamentals webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Processing fundamentals checkout.session.completed event.');
    if (session.payment_status === 'paid') {
      try {
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerName = session.customer_details?.name || '';
        console.log('Fundamentals customer email:', customerEmail);
        console.log('Fundamentals customer name:', customerName);

        // --- KAJABI ENROLLMENT USING WEBHOOK ---
        if (
          session.metadata &&
          session.metadata.product === 'The Viral Video Fundamentals: Your First 1,000,000 views'
        ) {
          try {
            const KAJABI_ACTIVATION_URL = process.env.KAJABI_ACTIVATION_URL;
            if (!KAJABI_ACTIVATION_URL) {
              throw new Error('KAJABI_ACTIVATION_URL not configured');
            }
            console.log('Attempting Kajabi fundamentals enrollment via webhook');
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
            console.log('Kajabi fundamentals webhook response:', kajabiResponse);
          } catch (kajabiError) {
            console.error('Error enrolling user in Kajabi fundamentals:', kajabiError.message);
          }
        } else {
          console.log('Skipping Kajabi enrollment for product:', session.metadata?.product);
        }

        // --- SIMPLIFIED CONVERTKIT ---
        try {
          const KIT_API_KEY = process.env.KIT_API_KEY;
          const PURCHASE_FORM_ID = process.env.KIT_PURCHASE_FORM_ID;
          if (PURCHASE_FORM_ID && KIT_API_KEY) {
            console.log('Adding to ConvertKit fundamentals form:', PURCHASE_FORM_ID);
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
            console.log('ConvertKit fundamentals response:', response);
          }
        } catch (error) {
          console.error('ConvertKit fundamentals error:', error.message);
        }

        console.log('Fundamentals webhook processing complete. Returning success.');
        return res.status(200).json({
          success: true,
          message: 'Fundamentals purchase processed successfully',
        });

      } catch (error) {
        console.error('Error processing fundamentals purchase:', error.message);
        return res.status(200).json({
          success: false,
          error: error.message,
        });
      }
    }
  }

  console.log('Fundamentals event type not handled or payment not paid. Returning received.');
  return res.status(200).json({ received: true });
} 