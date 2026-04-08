// Minimal Vercel serverless function — testing if basic handler works
module.exports = function handler(req, res) {
  const url = req.url || '';
  
  // Health check
  if (url === '/api/health' || url.startsWith('/api/health')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 200;
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(), 
      version: '2.0.0-minimal' 
    }));
    return;
  }
  
  // 404 for everything else
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found', url: url }));
};
