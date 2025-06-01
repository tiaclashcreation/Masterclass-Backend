import Stripe from 'stripe';
import axios from 'axios';

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
    console.error('Webhook signature verification failed:', err.message);
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
          const KAJABI_API_SECRET = process.env.KAJABI_API_SECRET;
          const KAJABI_SITE_ID = process.env.KAJABI_SITE_ID;
          const KAJABI_OFFER_ID = process.env.KAJABI_OFFER_ID;
          const KAJABI_BASE_URL = process.env.KAJABI_BASE_URL || 'https://api.kajabi.com';

          let firstName = '';
          let lastName = '';
          if (customerName) {
            const nameParts = customerName.trim().split(' ');
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          }

          const kajabiRes = await axios.post(
            `${KAJABI_BASE_URL}/sites/${KAJABI_SITE_ID}/offers/${KAJABI_OFFER_ID}/memberships`,
            {
              email: customerEmail,
              first_name: firstName,
              last_name: lastName
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Kajabi-API-Client',
                'Kajabi-Api-Key': KAJABI_API_KEY,
                'Kajabi-Api-Secret': KAJABI_API_SECRET
              }
            }
          );
          console.log('Kajabi enrollment response:', kajabiRes.data);
        } catch (kajabiError) {
          console.error('Error enrolling user in Kajabi:', kajabiError.response?.data || kajabiError.message);
        }

        // --- CONVERTKIT LOGIC ---
        try {
          const KIT_API_KEY = process.env.KIT_API_KEY;
          const KIT_API_BASE = 'https://api.kit.com/v4';
          const PURCHASE_FORM_ID = process.env.KIT_PURCHASE_FORM_ID;

          // 1. Create or update subscriber in ConvertKit
          const subscriberResponse = await axios.post(
            `${KIT_API_BASE}/subscribers`,
            {
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
            },
            {
              headers: {
                'Authorization': `Bearer ${KIT_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const subscriber = subscriberResponse.data.subscriber;
          console.log(`Subscriber created/updated: ${subscriber.id}`);

          // 2. Optionally add to a specific form/sequence
          if (PURCHASE_FORM_ID) {
            await axios.post(
              `${KIT_API_BASE}/forms/${PURCHASE_FORM_ID}/subscribers/${subscriber.id}`,
              {},
              {
                headers: {
                  'Authorization': `Bearer ${KIT_API_KEY}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log(`Added subscriber to purchase form/sequence`);
          }

          // 3. Create a purchase record in ConvertKit
          await axios.post(
            `${KIT_API_BASE}/purchases`,
            {
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
            },
            {
              headers: {
                'Authorization': `Bearer ${KIT_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`Purchase record created in ConvertKit`);
        } catch (convertkitError) {
          console.error('Error processing ConvertKit integration:', convertkitError.response?.data || convertkitError.message);
        }

        return res.status(200).json({
          success: true,
          message: 'Purchase processed successfully',
        });

      } catch (error) {
        console.error('Error processing purchase:', error.response?.data || error.message);
        return res.status(200).json({
          success: false,
          error: error.message,
          details: error.response?.data
        });
      }
    }
  }

  return res.status(200).json({ received: true });
}
