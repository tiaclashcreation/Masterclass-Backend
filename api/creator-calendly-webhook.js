export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://clashcreation.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Respond to preflight request
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
    // Calendly sends booking info in event.payload.invitee
    const invitee = event.payload?.invitee;
    const email = invitee?.email;
    const name = invitee?.name || '';

    if (!email) {
      return res.status(400).json({ error: 'No email found in Calendly webhook' });
    }

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
              email,
              name,
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
              email,
              first_name: name.split(' ')[0] || ''
            })
          }
        );
      }
    } catch (error) {
      // log ConvertKit error
      console.error('ConvertKit error:', error);
    }

    return res.status(200).json({ success: true, message: 'Calendly booking processed for Creator' });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to process Calendly webhook' });
  }
} 