export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const data = req.body;
    
    // Your logic here
    res.status(200).json({ 
      success: true,
      received: data 
    });
  } else if (req.method === 'GET') {
    res.status(200).json({ 
      items: ['item1', 'item2', 'item3'] 
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}