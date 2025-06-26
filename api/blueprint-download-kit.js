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

  const { email, firstName } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const KIT_API_KEY = process.env.KIT_API_KEY;
    const KIT_FORM_ID = '8189148'; // Same form as creator
    if (KIT_FORM_ID && KIT_API_KEY) {
      await fetch(
        `https://api.convertkit.com/v3/forms/${KIT_FORM_ID}/subscribe?api_secret=${KIT_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            first_name: firstName || ''
          })
        }
      );
    }
    return res.status(200).json({ success: true, message: 'Kit requested successfully' });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to request kit' });
  }
} 