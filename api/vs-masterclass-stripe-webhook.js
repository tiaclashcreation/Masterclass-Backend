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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      try {
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerName = session.customer_details?.name || '';
        // --- CONVERTKIT ---
        try {
          const KIT_API_KEY = process.env.KIT_API_KEY;
          const PURCHASE_FORM_ID = process.env.KIT_PURCHASE_FORM_ID || 'PLACEHOLDER_FORM_ID';
          if (PURCHASE_FORM_ID && KIT_API_KEY) {
            await fetchJson(
              `https://api.convertkit.com/v3/forms/${PURCHASE_FORM_ID}/subscribe?api_secret=${KIT_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: customerEmail,
                  first_name: customerName.split(' ')[0] || ''
                })
              }
            );
          }
        } catch (error) {
          // log ConvertKit error
        }
        return res.status(200).json({ success: true, message: 'Purchase processed successfully' });
      } catch (error) {
        return res.status(200).json({ success: false, error: error.message });
      }
    }
  }
  return res.status(200).json({ received: true });
} 