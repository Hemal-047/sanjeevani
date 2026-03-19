require('dotenv').config();
const express = require('express');
const cors = require('cors');

const analyzeRoutes = require('./routes/analyze');
const attestationRoutes = require('./routes/attestation');
const marketplaceRoutes = require('./routes/marketplace');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'sanjeevani-backend' });
});

app.use('/api/analyze', analyzeRoutes);
app.use('/api/attestation', attestationRoutes);
app.use('/api/marketplace', marketplaceRoutes);

app.listen(PORT, () => {
  console.log(`Sanjeevani backend running on port ${PORT}`);
});
