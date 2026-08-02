require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const fontRoutes = require('./routes/fonts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

app.use('/api', authRoutes);
app.use('/api/fonts', fontRoutes);

app.use('/tester', express.static(path.join(__dirname, '..', 'public', 'tester')));
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));

app.get('/', (req, res) => res.redirect('/tester'));

app.listen(PORT, () => {
  console.log(`HDC Font Tester server running on port ${PORT}`);
  console.log(`  Tester: http://localhost:${PORT}/tester`);
  console.log(`  Admin:  http://localhost:${PORT}/admin`);
});
