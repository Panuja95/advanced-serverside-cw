const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const db = require('./configs/db');
const {v4 :uuidv4} = require('uuid');
const axios = require('axios');

const app = express();




// Middleware
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Register page
app.get('/register', (req, res) => {
  res.render('register');
});

// Handle registration
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query(sql, [username, hashedPassword], (err, result) => {
      if (err) {
        console.error('Error saving user:', err);
        return res.send('User already exists or DB error.');
      }
      res.redirect('/login?message=Registration successful!');

    });
  } catch (err) {
    console.error('Error:', err);
    res.send('Something went wrong.');
  }
});

app.get('/login', (req, res) => {
  res.render('login', { message: req.query.message });
});

  

// Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], async (err, results) => {
    if (err || results.length === 0) {
      return res.send(' User not found');
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.send(' Incorrect password');
    }

    req.session.user = user;
    res.redirect('/dashboard');

  });
});

// Middleware to protect routes
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Protected dashboard route
app.get('/dashboard', isAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const sql = 'SELECT api_key FROM api_keys WHERE user_id = ?';

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(' Error fetching API key:', err);
      return res.send('Error loading dashboard.');
    }

    const apiKey = results.length > 0 ? results[0].api_key : null;
    res.render('dashboard', { user: req.session.user, apiKey });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

//api key generation
app.post('/generate-api-key', isAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  const checkSql = 'SELECT * FROM api_keys WHERE user_id = ?';
  db.query(checkSql, [userId], (err, rows) => {
    if (err) {
      console.error(' Error checking API key:', err);
      return res.send(`DB error: ${err.message}`);
    }
    

    if (rows.length > 0) {
      return res.send(`You already have an API key: ${rows[0].api_key}`);
    }

    const newApiKey = uuidv4();
    const insertSql = 'INSERT INTO api_keys (user_id, api_key) VALUES (?, ?)';
    db.query(insertSql, [userId, newApiKey], (err, result) => {
      if (err) {
        console.error(' Error inserting API key:', err);
        return res.send('Error generating API key.');
      }
      res.redirect('/dashboard');
    });
  });
});


app.get('/country/:name', async (req, res) => {
  const { name } = req.params;
  const { apikey } = req.query;

  if (!apikey) return res.status(400).json({ error: 'API key required in query ?apikey=' });

  const sql = 'SELECT * FROM api_keys WHERE api_key = ?';
  db.query(sql, [apikey], async (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ error: 'Invalid API key' });


    // try {
    //   const formatted = {
    //     name: name,
    //     capital: "New Delhi",
    //     currencies: "INR",
    //     languages: "Hindi, English",
    //     flag: "https://flagcdn.com/w320/in.png"
    //   };
    //   res.json(formatted);
    // } catch (apiError) {
    //   console.error(' Country API error:', apiError.message);
    //   res.status(500).json({ error: 'Error fetching country data' });
    // }

    
    
    try {
      const response = await axios.get(`https://restcountries.com/v3.1/name/${name}`);
      const country = response.data[0];

      const formatted = {
        name: country.name.common,
        capital: country.capital?.[0] || 'N/A',
        currencies: country.currencies ? Object.keys(country.currencies).join(', ') : 'N/A',
        languages: country.languages ? Object.values(country.languages).join(', ') : 'N/A',
        flag: country.flags?.png || 'N/A'
      };

      res.json(formatted);
    } catch (apiError) {
      console.error(' Country API error:', apiError.response?.data || apiError.message || apiError);
      res.status(500).json({ error: 'Error fetching country data' });
    }
    
  }); 
});


// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


