const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const cors = require('cors');
const bodyParser = express.json();
app.use(bodyParser);
require('dotenv').config();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ['https://matrimony-sengunthar.netlify.app'],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.get("/", (req, res)=>{
  res.send("Server is running");
})
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create upload directories if they don't exist
const uploadDirs = ['uploads/photos', 'uploads/docs'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Database connection
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully at:', result.rows[0].now);
  }
});

// Enhanced file upload setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = file.fieldname === 'profile_photo' 
      ? path.join(__dirname, 'uploads', 'photos')
      : path.join(__dirname, 'uploads', 'docs');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Utils
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Admin-only middleware
function adminOnly(req, res, next){
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  const token = auth.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.admin = payload;
    next();
  } catch(e) {
    console.error('Admin auth error:', e.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Regular user authentication middleware
function authenticateUser(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  
  const token = auth.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = payload;
    next();
  } catch(e) {
    console.error('Auth error:', e.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// USER ROUTES

// Enhanced User signup with CORRECTED SQL
app.post('/api/auth/signup', upload.fields([
  {name:'profile_photo', maxCount: 1},
  {name:'community_cert', maxCount: 1},
  {name:'jathagam', maxCount: 1}
]), async (req, res) => {
  try {
    console.log('Signup attempt for:', req.body.email);
    
    const {
      name, email, password, age, gender, dob, birth_time, birth_place,
      religion, caste, sub_caste, gothram, star, rasi,
      education, occupation, job_location, income,
      height, weight, body_type, complexion, mother_tongue, disability,
      father_occupation, mother_occupation, elder_brothers, younger_brothers,
      elder_sisters, younger_sisters, family_details,
      partner_education, partner_occupation, partner_income, partner_marital_status, partner_expectations,
      phone, whatsapp, address, city, state, pincode, about, interests
    } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error:'Name, email and password required' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashed = await bcrypt.hash(password, 10);
    
    // Get uploaded file paths
    const profilePhoto = req.files && req.files['profile_photo'] ? req.files['profile_photo'][0].filename : null;
    const certPath = req.files && req.files['community_cert'] ? req.files['community_cert'][0].filename : null;
    const jathPath = req.files && req.files['jathagam'] ? req.files['jathagam'][0].filename : null;
    
    // CORRECTED INSERT QUERY - exactly 46 columns and 46 values
    const insertQuery = `
      INSERT INTO users (
        name, email, password, age, gender, dob, birth_time, birth_place,
        religion, caste, sub_caste, gothram, star, rasi,
        education, occupation, job_location, income,
        height, weight, body_type, complexion, mother_tongue, disability,
        father_occupation, mother_occupation, elder_brothers, younger_brothers,
        elder_sisters, younger_sisters, family_details,
        partner_education, partner_occupation, partner_income, partner_marital_status, partner_expectations,
        phone, whatsapp, address, city, state, pincode, about, interests,
        profile_photo, status, created_at, last_login
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
        $41, $42, $43, $44, $45, $46, $47, $48
      ) RETURNING id
    `;
    
    const values = [
      name || null,
      email,
      hashed,
      age ? parseInt(age) : null,
      gender || null,
      dob || null,
      birth_time || null,
      birth_place || null,
      religion || null,
      caste || 'SENGUNTHAR',
      sub_caste || null,
      gothram || null,
      star || null,
      rasi || null,
      education || null,
      occupation || null,
      job_location || null,
      income || null,
      height ? parseInt(height) : null,
      weight ? parseInt(weight) : null,
      body_type || null,
      complexion || null,
      mother_tongue || null,
      disability || 'no',
      father_occupation || null,
      mother_occupation || null,
      elder_brothers ? parseInt(elder_brothers) : 0,
      younger_brothers ? parseInt(younger_brothers) : 0,
      elder_sisters ? parseInt(elder_sisters) : 0,
      younger_sisters ? parseInt(younger_sisters) : 0,
      family_details || null,
      partner_education || null,
      partner_occupation || null,
      partner_income || null,
      partner_marital_status || 'unmarried',
      partner_expectations || null,
      phone || null,
      whatsapp || null,
      address || null,
      city || null,
      state || null,
      pincode || null,
      about || null,
      interests || null,
      profilePhoto,
      'pending',
      new Date(),
      new Date()
    ];
    
    console.log('Inserting user with', values.length, 'values');
    const r = await pool.query(insertQuery, values);
    const userId = r.rows[0].id;
    
    // Save document paths
    try {
      if (certPath) {
        await pool.query('INSERT INTO user_docs (user_id, doc_type, path) VALUES ($1, $2, $3)', [userId, 'community', certPath]);
      }
      if (jathPath) {
        await pool.query('INSERT INTO user_docs (user_id, doc_type, path) VALUES ($1, $2, $3)', [userId, 'jathagam', jathPath]);
      }
    } catch(e) { 
      console.error('Error saving documents:', e);
    }
    
    console.log('User created successfully with ID:', userId);
    res.json({ ok: true, message: 'Profile created successfully! Admin will verify within 2 days.' });
    
  } catch (err) { 
    console.error('Signup error:', err); 
    res.status(500).json({ error: 'Server error during registration: ' + err.message }); 
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const q = 'SELECT id,name,email,password,status FROM users WHERE email=$1';
    const r = await pool.query(q, [email.toLowerCase().trim()]);
    
    if (r.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const u = r.rows[0];
    const match = await bcrypt.compare(password, u.password);
    
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (u.status !== 'active') {
      return res.status(403).json({ error: 'Account pending verification. Please wait for admin approval.' });
    }
    
    const token = jwt.sign(
      { id: u.id, email: u.email, role: 'user' }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '7d' }
    );
    
    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [u.id]);
    
    res.json({ 
      token,
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: 'user'
      }
    });

  } catch (err) { 
    console.error('Login error:', err); 
    res.status(500).json({ error: 'Server error during login' }); 
  }
});

// ADMIN ROUTES

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const q = 'SELECT id,name,email,password FROM admins WHERE email=$1';
    const r = await pool.query(q, [email.toLowerCase().trim()]);
    
    if (r.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    
    const admin = r.rows[0];
    const match = await bcrypt.compare(password, admin.password);
    
    if (!match) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin'
      }
    });

  } catch (err) { 
    console.error('Admin login error:', err); 
    res.status(500).json({ error: 'Server error during admin login' }); 
  }
});

// Get pending users for admin approval
app.get('/api/admin/pending', adminOnly, async (req, res) => {
  try {
    const q = 'SELECT id,name,email,status,created_at FROM users WHERE status=$1 ORDER BY created_at ASC';
    const r = await pool.query(q, ['pending']);
    res.json(r.rows);
  } catch (err) { 
    console.error('Admin pending error:', err); 
    res.status(500).json({ error: 'server error' }); 
  }
});

// Admin verify user
app.post('/api/admin/verify/:id', adminOnly, async (req, res) => {
  try {
    const id = req.params.id;
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const checkUser = await pool.query('SELECT id, email, status FROM users WHERE id = $1', [id]);
    if (checkUser.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = checkUser.rows[0];
    if (user.status === 'active') {
      return res.status(400).json({ error: 'User already active' });
    }
    
    // Activate the user
    await pool.query('UPDATE users SET status=$1 WHERE id=$2', ['active', id]);
    
    // Create notification for user
    await pool.query(
      'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
      [id, 'account_approved', 'Your account has been approved! You can now browse profiles and send match requests.']
    );
    
    res.json({ 
      ok: true, 
      message: `User ${user.email} activated successfully` 
    });
  } catch (e) { 
    console.error('Admin verify error:', e); 
    res.status(500).json({ error: 'server error' }); 
  }
});

// USER PROTECTED ROUTES

// Get all active profiles (enhanced with photos)
app.get('/api/profiles', authenticateUser, async (req, res) => {
  try {
    const userCheck = await pool.query('SELECT status FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rowCount === 0 || userCheck.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Account not active' });
    }
    
    const q = `SELECT id, name, age, city, education, occupation, profile_photo, created_at 
               FROM users 
               WHERE status = 'active' AND id != $1 
               ORDER BY created_at DESC`;
    const r = await pool.query(q, [req.user.id]);
    res.json(r.rows);
  } catch (e) { 
    console.error('Profiles error:', e);
    res.status(500).json({ error: 'server error' }); 
  }
});

// Get detailed profile with match status
app.get('/api/profile/:id', authenticateUser, async (req, res) => {
  try {
    const id = req.params.id;
    const q = `SELECT id, name, age, gender, city, state, education, occupation, height, weight, 
               complexion, mother_tongue, religion, caste, sub_caste, gothram, star, rasi,
               interests, about, profile_photo, created_at,
               elder_brothers, younger_brothers, elder_sisters, younger_sisters,
               father_occupation, mother_occupation, family_details,
               partner_education, partner_occupation, partner_expectations
               FROM users WHERE id = $1 AND status = 'active'`;
    const r = await pool.query(q, [id]);
    
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    const profile = r.rows[0];
    
    // Check match status
    const matchCheck = await pool.query(
      `SELECT status FROM match_requests 
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [req.user.id, id]
    );
    
    // Check if already matched
    const alreadyMatched = await pool.query(
      `SELECT id FROM matches 
       WHERE (user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1)`,
      [req.user.id, id]
    );
    
    if (alreadyMatched.rowCount > 0) {
      profile.match_status = 'matched';
      profile.can_send_request = false;
      
      // Get contact details since they're matched
      const contactQuery = await pool.query(
        'SELECT email, phone, whatsapp FROM users WHERE id = $1',
        [id]
      );
      if (contactQuery.rowCount > 0) {
        profile.contact_details = contactQuery.rows[0];
      }
    } else if (matchCheck.rowCount > 0) {
      profile.match_status = matchCheck.rows[0].status;
      profile.can_send_request = false;
    } else {
      profile.match_status = null;
      profile.can_send_request = true;
    }
    
    res.json(profile);
  } catch (e) {
    console.error('Profile fetch error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Send match request
app.post('/api/profile/:id/match-request', authenticateUser, async (req, res) => {
  try {
    const receiverId = req.params.id;
    const senderId = req.user.id;
    
    if (senderId == receiverId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }
    
    // Check if request already exists
    const existingRequest = await pool.query(
      'SELECT id FROM match_requests WHERE sender_id = $1 AND receiver_id = $2',
      [senderId, receiverId]
    );
    
    if (existingRequest.rowCount > 0) {
      return res.status(400).json({ error: 'Match request already sent' });
    }
    
    // Get sender details for notification
    const senderResult = await pool.query('SELECT name FROM users WHERE id = $1', [senderId]);
    const senderName = senderResult.rows[0].name;
    
    // Create match request
    await pool.query(
      'INSERT INTO match_requests (sender_id, receiver_id, status) VALUES ($1, $2, $3)',
      [senderId, receiverId, 'pending']
    );
    
    // Create notification for receiver
    await pool.query(
      'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
      [receiverId, 'match_request', `${senderName} sent you a match request!`]
    );
    
    res.json({ ok: true, message: 'Match request sent successfully!' });
  } catch (e) {
    console.error('Match request error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Get user notifications
app.get('/api/notifications', authenticateUser, async (req, res) => {
  try {
    const q = `SELECT id, type, message, is_read, created_at 
               FROM notifications 
               WHERE user_id = $1 
               ORDER BY created_at DESC`;
    const r = await pool.query(q, [req.user.id]);
    res.json(r.rows);
  } catch (e) {
    console.error('Notifications error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Get match requests for current user
app.get('/api/match-requests', authenticateUser, async (req, res) => {
  try {
    const q = `SELECT mr.id, mr.sender_id, mr.status, mr.created_at, 
               u.name as sender_name, u.profile_photo
               FROM match_requests mr
               JOIN users u ON mr.sender_id = u.id
               WHERE mr.receiver_id = $1 AND mr.status = 'pending'
               ORDER BY mr.created_at DESC`;
    const r = await pool.query(q, [req.user.id]);
    res.json(r.rows);
  } catch (e) {
    console.error('Match requests error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Accept match request
app.post('/api/match-requests/:id/accept', authenticateUser, async (req, res) => {
  try {
    const requestId = req.params.id;
    
    // Get the match request
    const requestResult = await pool.query(
      'SELECT sender_id, receiver_id FROM match_requests WHERE id = $1 AND receiver_id = $2 AND status = $3',
      [requestId, req.user.id, 'pending']
    );
    
    if (requestResult.rowCount === 0) {
      return res.status(404).json({ error: 'Match request not found or already processed' });
    }
    
    const { sender_id, receiver_id } = requestResult.rows[0];
    
    // Update match request status
    await pool.query('UPDATE match_requests SET status = $1, responded_at = NOW() WHERE id = $2', ['accepted', requestId]);
    
    // Create mutual match record
    await pool.query('INSERT INTO matches (user_a, user_b, created_at) VALUES ($1, $2, NOW())', [sender_id, receiver_id]);
    
    // Get both users' contact details
    const usersResult = await pool.query(
      'SELECT id, name, email, phone, whatsapp FROM users WHERE id IN ($1, $2)',
      [sender_id, receiver_id]
    );
    
    const users = usersResult.rows;
    const sender = users.find(u => u.id == sender_id);
    const receiver = users.find(u => u.id == receiver_id);
    
    // Create notifications for both users with contact details
    await pool.query(
      'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3), ($4, $5, $6)',
      [
        sender_id, 'match_accepted', 
        `Great news! ${receiver.name} accepted your match request. Contact: ${receiver.email}${receiver.phone ? ', ' + receiver.phone : ''}${receiver.whatsapp ? ', WhatsApp: ' + receiver.whatsapp : ''}`,
        receiver_id, 'match_made',
        `You accepted ${sender.name}'s request. Contact: ${sender.email}${sender.phone ? ', ' + sender.phone : ''}${sender.whatsapp ? ', WhatsApp: ' + sender.whatsapp : ''}`
      ]
    );
    
    res.json({ ok: true, message: 'Match request accepted! Contact details shared via notifications.' });
  } catch (e) {
    console.error('Accept match error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Reject match request
app.post('/api/match-requests/:id/reject', authenticateUser, async (req, res) => {
  try {
    const requestId = req.params.id;
    
    const result = await pool.query(
      'UPDATE match_requests SET status = $1, responded_at = NOW() WHERE id = $2 AND receiver_id = $3 AND status = $4',
      ['rejected', requestId, req.user.id, 'pending']
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Match request not found' });
    }
    
    res.json({ ok: true, message: 'Match request rejected' });
  } catch (e) {
    console.error('Reject match error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Mark notifications as read
app.post('/api/notifications/:id/read', authenticateUser, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('Mark notification read error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.listen(PORT, ()=> {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check: /api/health`);
  console.log(`CORS ON: https://matrimony-sengunthar.netlify.app`);
  
});
