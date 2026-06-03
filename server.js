const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const ReCaptchaV3 = require('node-recaptcha-v3');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: 's3cr3tK4nt0rHukum2025!SuperRahasia',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000 }
}));

// Konfigurasi EJS Layout
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/advokats';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'advokat-' + unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

const isAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login');
};

// ROUTES
app.get('/', (req, res) => {
  res.render('index', { title: 'Beranda' });
});

app.get('/advokat', (req, res) => {
  db.all(`SELECT * FROM advokats`, (err, advokats) => {
    if (err) advokats = [];
    res.render('advokat', { title: 'Para Advokat', advokats, isAdmin: req.session.isAdmin || false });
  });
});

app.get('/layanan', (req, res) => {
  res.render('layanan', { title: 'Layanan Hukum' });
});

app.get('/tanya-jawab', (req, res) => {
  db.all(`SELECT * FROM qna ORDER BY created_at DESC`, (err, questions) => {
    if (err) questions = [];
    res.render('tanya-jawab', { title: 'Tanya Jawab Hukum', questions, query: req.query });
  });
});

const tanyaJawabLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Anda sudah mencapai batas pertanyaan. Silakan coba lagi dalam 1 jam.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Secret key Anda (sudah didapat dari Google)
const SECRET_KEY = '6Lf5DAstAAAAADWcynuxzYAVcgHEGd0lvQR7pE5t';

const reCaptcha = new ReCaptchaV3({
    secretKey: SECRET_KEY,
    threshold: 0.5,
});
app.post('/tanya-jawab', tanyaJawabLimiter, reCaptcha.verify(0.5), (req, res) => {
  const { name, email, question } = req.body;

  // Log skor reCAPTCHA (opsional, untuk monitoring)
  console.log(`Skor reCAPTCHA untuk ${name}: ${req.reCaptchaV3Score}`);

  if (!name || !question) {
    return res.redirect('/tanya-jawab?error=Isi nama dan pertanyaan');
  }

  db.run('INSERT INTO qna (name, email, question) VALUES (?, ?, ?)', [name, email, question], (err) => {
    if (err) return res.redirect('/tanya-jawab?error=Gagal mengirim');
    res.redirect('/tanya-jawab?success=1');
  });
});

// ADMIN
app.get('/admin/login', (req, res) => {
  res.render('admin/login', { title: 'Login Admin', error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'MJN-Partner2025!') {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin/login', { title: 'Login Admin', error: 'Username atau password salah!' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin/dashboard', isAdmin, (req, res) => {
  db.all(`SELECT * FROM qna ORDER BY is_answered ASC, created_at DESC`, (err, questions) => {
    if (err) questions = [];
    res.render('admin/dashboard', { title: 'Dashboard Admin', questions });
  });
});

app.post('/admin/answer/:id', isAdmin, (req, res) => {
  const { answer } = req.body;
  db.run(`UPDATE qna SET answer = ?, is_answered = 1 WHERE id = ?`, [answer, req.params.id], () => {
    res.redirect('/admin/dashboard');
  });
});

app.get('/admin/delete/:id', isAdmin, (req, res) => {
  db.run(`DELETE FROM qna WHERE id = ?`, [req.params.id], () => {
    res.redirect('/admin/dashboard');
  });
});

app.get('/admin/upload-foto', isAdmin, (req, res) => {
  db.all(`SELECT * FROM advokats`, (err, advokats) => {
    res.render('admin/upload-foto', { title: 'Kelola Foto Advokat', advokats, query: req.query });
  });
});

app.post('/admin/upload-foto/:id', isAdmin, upload.single('photo'), (req, res) => {
  const id = req.params.id;
  if (!req.file) return res.redirect('/admin/upload-foto?error=Gagal upload');
  const photoUrl = '/uploads/advokats/' + req.file.filename;
  db.run(`UPDATE advokats SET photo = ? WHERE id = ?`, [photoUrl, id], () => {
    res.redirect('/admin/upload-foto?success=1');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  if (!fs.existsSync('./uploads/advokats')) fs.mkdirSync('./uploads/advokats', { recursive: true });
});