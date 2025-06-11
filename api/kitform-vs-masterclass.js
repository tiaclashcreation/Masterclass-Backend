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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, first_name } = req.body;
    if (!email || !first_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const kitApiKey = process.env.KIT_API_KEY;
    const formId = '8174288';
    const url = `https://api.convertkit.com/v3/forms/${formId}/subscribe?api_secret=${kitApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        first_name,
        fields: {
          source: 'vs_masterclass_slides',
          submission_date: new Date().toISOString(),
        },
        tags: ['vs-masterclass-slides-download'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ success: false, error: errorText });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
} 