import { buffer } from 'micro';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    const formId = '8235235'; // Professional Breakthrough waitlist form
    const url = `https://api.convertkit.com/v3/forms/${formId}/subscribe?api_secret=${kitApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        first_name,
        fields: {
          source: 'professional_breakthrough_website',
          signup_date: new Date().toISOString(),
          product_interest: 'Professional Breakthrough',
          pricing_tier: '£450',
          program_type: 'Career Development'
        },
        tags: ['professional-breakthrough-waitlist', 'career-development', 'creative-professional'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ConvertKit error:', errorText);
      return res.status(500).json({ success: false, error: 'Failed to join waitlist' });
    }

    const result = await response.json();
    console.log('Professional Breakthrough waitlist signup successful:', result);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully joined Professional Breakthrough waitlist' 
    });
  } catch (error) {
    console.error('Professional Breakthrough waitlist signup error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
} 