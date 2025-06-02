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
  console.log('Webhook handler invoked.');
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
    console.log('Stripe event received:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Processing checkout.session.completed event.');
    if (session.payment_status === 'paid') {
      try {
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerName = session.customer_details?.name || '';
        console.log('Customer email:', customerEmail);
        console.log('Customer name:', customerName);

        // --- KAJABI ENROLLMENT (UPDATED) ---
        try {
          const KAJABI_API_KEY = process.env.KAJABI_API_KEY;
          const KAJABI_SUBDOMAIN = process.env.KAJABI_SUBDOMAIN; // e.g., "clash-creation"
          const KAJABI_OFFER_ID = process.env.KAJABI_OFFER_ID;

          let firstName = '';
          let lastName = '';
          if (customerName) {
            const nameParts = customerName.trim().split(' ');
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          }
          console.log('Attempting Kajabi enrollment:', { customerEmail, firstName, lastName });

          // Create or find the user
          const userResponse = await fetchJson(
            `https://${KAJABI_SUBDOMAIN}.mykajabi.com/api/v1/users`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${KAJABI_API_KEY}`
              },
              body: JSON.stringify({
                email: customerEmail,
                name: customerName || `${firstName} ${lastName}`.trim()
              })
            }
          );

          // Grant access to the offer
          const grantAccessResponse = await fetchJson(
            `https://${KAJABI_SUBDOMAIN}.mykajabi.com/api/v1/offers/${KAJABI_OFFER_ID}/grant_access`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${KAJABI_API_KEY}`
              },
              body: JSON.stringify({
                email: customerEmail
              })
            }
          );

          console.log('Kajabi enrollment response:', grantAccessResponse);
        } catch (kajabiError) {
          console.error('Error enrolling user in Kajabi:', kajabiError.message);
        }

        // --- CONVERTKIT LOGIC ---
        try {
          const KIT_API_KEY = process.env.KIT_API_KEY;
          const KIT_API_BASE = 'https://api.convertkit.com/v3';
          const PURCHASE_FORM_ID = process.env.KIT_PURCHASE_FORM_ID;

          // 1. Create or update subscriber in ConvertKit
          console.log('Attempting ConvertKit subscriber creation:', customerEmail);
          const subscriberResponse = await fetchJson(
            `${KIT_API_BASE}/subscribers?api_secret=${KIT_API_KEY}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email_address: customerEmail,
                first_name: customerName.split(' ')[0] || '',
                fields: {
                  'Purchase Date': new Date().toISOString(),
                  'Product': 'The Viral Video Fundamentals: Your First 1,000,000 views',
                  'Amount': session.amount_total ? `$${(session.amount_total / 100).toFixed(2)}` : '',
                  'Payment Method': session.payment_method_types?.[0] || 'card',
                  'Stripe Customer ID': session.customer,
                  'Stripe Session ID': session.id
                }
              })
            }
          );

          const subscriber = subscriberResponse.subscriber;
          console.log(`Subscriber created/updated: ${subscriber.id}`);

          // 2. Optionally add to a specific form/sequence
          if (PURCHASE_FORM_ID) {
            console.log('Adding subscriber to purchase form/sequence:', PURCHASE_FORM_ID);
            await fetchJson(
              `${KIT_API_BASE}/forms/${PURCHASE_FORM_ID}/subscribers/${subscriber.id}?api_secret=${KIT_API_KEY}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log(`Added subscriber to purchase form/sequence`);
          }

          // 3. Create a purchase record in ConvertKit
          console.log('Creating purchase record in ConvertKit');
          await fetchJson(
            `${KIT_API_BASE}/purchases?api_secret=${KIT_API_KEY}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                purchase: {
                  email_address: customerEmail,
                  first_name: customerName.split(' ')[0] || '',
                  transaction_id: session.id,
                  status: 'paid',
                  currency: session.currency ? session.currency.toUpperCase() : 'USD',
                  total: session.amount_total ? session.amount_total / 100 : undefined,
                  subtotal: (session.amount_subtotal || session.amount_total) ? (session.amount_subtotal || session.amount_total) / 100 : undefined,
                  tax: (session.total_details?.amount_tax || 0) / 100,
                  transaction_time: new Date().toISOString(),
                  products: [{
                    name: 'The Viral Video Fundamentals: Your First 1,000,000 views',
                    pid: 'viral-video-fundamentals',
                    lid: `${session.id}-1`,
                    quantity: 1,
                    unit_price: (session.amount_subtotal || session.amount_total) ? (session.amount_subtotal || session.amount_total) / 100 : undefined
                  }]
                }
              })
            }
          );
          console.log(`Purchase record created in ConvertKit`);
        } catch (convertkitError) {
          console.error('Error processing ConvertKit integration:', convertkitError.message);
        }

        console.log('Webhook processing complete. Returning success.');
        return res.status(200).json({
          success: true,
          message: 'Purchase processed successfully',
        });

      } catch (error) {
        console.error('Error processing purchase:', error.message);
        return res.status(200).json({
          success: false,
          error: error.message,
        });
      }
    }
  }

  console.log('Event type not handled or payment not paid. Returning received.');
  return res.status(200).json({ received: true });
}
