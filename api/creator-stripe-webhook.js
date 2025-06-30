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
  console.log('[CREATOR WEBHOOK] Handler invoked.');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_CREATOR;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
    console.log('[CREATOR WEBHOOK] Stripe event received:', event.type);

    // Early return if this is not a Creator purchase
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Check both metadata and line items to ensure this is a Creator purchase
      const CREATOR_PRICE_IDS = [
        'price_1RaSn5BlWJBhJeWFMvVu8RG1', // USD
        'price_1RaSmIBlWJBhJeWFBpboNdnW'  // GBP
      ];

      const isCreator = session.metadata?.product === 'Creator' && 
        session.line_items?.data?.some(item => 
          CREATOR_PRICE_IDS.includes(item.price?.id)
        );

      if (!isCreator) {
        console.log('[CREATOR WEBHOOK] Skipping non-Creator purchase');
        return res.status(200).json({ received: true });
      }
    }
  } catch (err) {
    console.error('[CREATOR WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Continue with Creator-specific processing
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      try {
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerName = session.customer_details?.name || '';
        console.log('Creator Stripe webhook: customerEmail:', customerEmail, 'customerName:', customerName);
        // --- KAJABI ENROLLMENT (Creator-specific activation URL) ---
        try {
          const KAJABI_ACTIVATION_URL_CREATOR = 'https://checkout.kajabi.com/webhooks/offers/W5uzsKztGDo9HVzK/2150421081/activate';
          console.log('Attempting Kajabi Creator enrollment via activation URL');
          const kajabiResponse = await fetchJson(KAJABI_ACTIVATION_URL_CREATOR, {
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
          console.log('Kajabi Creator enrollment response:', kajabiResponse);
        } catch (kajabiError) {
          console.error('Error enrolling user in Kajabi Creator offer:', kajabiError.message);
        }
        // --- CONVERTKIT KIT FORM SUBSCRIBE ---
        try {
          const KIT_API_KEY = process.env.KIT_API_KEY;
          const KIT_FORM_ID = '8189148';
          if (KIT_FORM_ID && KIT_API_KEY) {
            console.log('Adding to ConvertKit form:', KIT_FORM_ID);
            const response = await fetchJson(
              `https://api.convertkit.com/v3/forms/${KIT_FORM_ID}/subscribe?api_secret=${KIT_API_KEY}`,
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
            console.log('ConvertKit response:', response);
          }
        } catch (error) {
          console.error('ConvertKit error:', error.message);
        }
        console.log('Creator webhook processing complete. Returning success.');
        return res.status(200).json({ success: true, message: 'Creator purchase processed successfully' });
      } catch (error) {
        console.error('Error processing Creator purchase:', error.message);
        return res.status(200).json({ success: false, error: error.message });
      }
    }
  }
  return res.status(200).json({ received: true });
} 