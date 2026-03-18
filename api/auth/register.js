const { connectToDatabase } = require('../../lib/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { fullname, username, email, nomor, password } = req.body;

  if (!fullname || !username || !email || !nomor || !password) {
    return res.status(400).json({ success: false, message: 'Semua field harus diisi' });
  }

  try {
    const { db } = await connectToDatabase();
    const users = db.collection('users');

    // Cek username/email sudah terdaftar
    const existing = await users.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username atau email sudah terdaftar' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate API Key
    const apiKey = crypto.randomBytes(32).toString('hex');

    // Simpan user
    const result = await users.insertOne({
      fullname,
      username,
      email,
      nomor,
      password: hashedPassword,
      saldo: 0,
      role: 'user',
      apiKey,
      createdAt: new Date(),
      lastLogin: null
    });

    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: result.insertedId, username, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      token,
      user: {
        id: result.insertedId,
        fullname,
        username,
        email,
        nomor,
        role: 'user'
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};