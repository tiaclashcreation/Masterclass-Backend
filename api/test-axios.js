const axios = require('axios');

export default async function handler(req, res) {
  try {
    const response = await axios.get('https://api.github.com');
    res.status(200).json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
} 