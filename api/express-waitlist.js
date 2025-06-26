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
      return res.status(400).json({ success: false, error: 'Email and name are required' });
    }

    const kitApiKey = process.env.KIT_API_KEY;
    const formId = '8194066'; // Express waitlist form
    const url = `https://api.convertkit.com/v3/forms/${formId}/subscribe?api_secret=${kitApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        first_name,
        fields: {
          source: 'express_waitlist_website',
          signup_date: new Date().toISOString(),
          product_interest: 'Express Creative Department',
          pricing_tier: '£3k+/month'
        },
        tags: ['express-waitlist', 'high-value-prospect', 'creative-services'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ConvertKit error:', errorText);
      return res.status(500).json({ success: false, error: 'Failed to join waitlist' });
    }

    const result = await response.json();
    console.log('Express waitlist signup successful:', result);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully joined Express waitlist' 
    });
  } catch (error) {
    console.error('Express waitlist signup error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
} 