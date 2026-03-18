require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'sanjeevani-backend' });
});

app.listen(PORT, () => {
  console.log(`Sanjeevani backend running on port ${PORT}`);
});
