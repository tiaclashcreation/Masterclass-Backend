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
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const kitApiKey = process.env.KIT_API_KEY;
    const formId = '8058172'; // Like It Or Not newsletter form
    const url = `https://api.convertkit.com/v3/forms/${formId}/subscribe?api_secret=${kitApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        first_name: first_name || '', // Name is optional but recommended
        fields: {
          source: 'like_it_or_not_website',
          signup_date: new Date().toISOString(),
        },
        tags: ['newsletter-subscriber', 'like-it-or-not'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ConvertKit error:', errorText);
      return res.status(500).json({ success: false, error: 'Failed to subscribe' });
    }

    const result = await response.json();
    console.log('Newsletter signup successful:', result);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully subscribed to newsletter' 
    });
  } catch (error) {
    console.error('Newsletter signup error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
} 