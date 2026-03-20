require('dotenv').config();
const express = require('express');
const cors = require('cors');

const analyzeRoutes = require('./routes/analyze');
const attestationRoutes = require('./routes/attestation');
const marketplaceRoutes = require('./routes/marketplace');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: configurable via CORS_ORIGIN env var, falls back to localhost + permissive for deployment
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? '*' : corsOrigin,
  credentials: process.env.CORS_ORIGIN !== '*',
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'sanjeevani-backend' });
});

app.use('/api/analyze', analyzeRoutes);
app.use('/api/attestation', attestationRoutes);
app.use('/api/marketplace', marketplaceRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sanjeevani backend running on port ${PORT}`);
});
