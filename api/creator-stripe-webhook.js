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
        // --- KAJABI ENROLLMENT ---
        try {
          const KAJABI_API_KEY = process.env.KAJABI_API_KEY;
          const KAJABI_SITE_ID = process.env.KAJABI_SITE_ID;
          const KAJABI_BASE_URL = process.env.KAJABI_BASE_URL || 'https://api.kajabi.com';
          const OFFER_ID = '2150421081';
          if (KAJABI_API_KEY && KAJABI_SITE_ID && OFFER_ID) {
            const response = await fetch(
              `${KAJABI_BASE_URL}/sites/${KAJABI_SITE_ID}/offers/${OFFER_ID}/grant`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${KAJABI_API_KEY}`,
                  'Kajabi-Api-Version': '2023-10-16',
                },
                body: JSON.stringify({
                  email: customerEmail,
                  name: customerName,
                })
              }
            );
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Kajabi enrollment error:', errorText);
            }
          }
        } catch (error) {
          console.error('Kajabi enrollment error:', error);
        }
        // --- CONVERTKIT KIT FORM SUBSCRIBE ---
        try {
          const KIT_API_KEY = process.env.KIT_API_KEY;
          const KIT_FORM_ID = '8189148';
          if (KIT_FORM_ID && KIT_API_KEY) {
            await fetch(
              `https://api.convertkit.com/v3/forms/${KIT_FORM_ID}/subscribe?api_secret=${KIT_API_KEY}`,
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
          console.error('ConvertKit error:', error);
        }
        return res.status(200).json({ success: true, message: 'Creator purchase processed and enrolled in Kajabi' });
      } catch (error) {
        return res.status(200).json({ success: false, error: error.message });
      }
    }
  }
  return res.status(200).json({ received: true });
} 