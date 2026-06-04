const n8nAuth = (req, res, next) => {
  const apiKey = req.headers['x-n8n-api-key'];
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return res.status(401).json({ error: 'API Key inválida' });
  }
  next();
};

module.exports = { n8nAuth };
