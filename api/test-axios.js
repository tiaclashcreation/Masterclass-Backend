export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.github.com');
    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
} 