require('dotenv').config();
const express = require('express');
const cors = require('cors');

const analyzeRoutes = require('./routes/analyze');
const attestationRoutes = require('./routes/attestation');
const marketplaceRoutes = require('./routes/marketplace');
const agentRoutes = require('./routes/agents');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: explicit allowlist for Vercel frontend + localhost dev
const corsOptions = {
  origin: [
    'https://sanjeevani-peach.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : []),
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.options('*', cors(corsOptions)); // preflight
app.use(cors(corsOptions));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'sanjeevani-backend' });
});

app.use('/api/analyze', analyzeRoutes);
app.use('/api/attestation', attestationRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/agents', agentRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sanjeevani backend running on port ${PORT}`);
});
