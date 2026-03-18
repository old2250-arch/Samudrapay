const { connectToDatabase } = require('../../lib/db');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  try {
    const { db } = await connectToDatabase();
    const users = db.collection('users');

    // Generate new API Key
    const newApiKey = crypto.randomBytes(32).toString('hex');

    await users.updateOne(
      { _id: new ObjectId(decoded.userId) },
      { $set: { apiKey: newApiKey } }
    );

    res.json({
      success: true,
      message: 'API Key berhasil digenerate',
      apiKey: newApiKey
    });

  } catch (error) {
    console.error('API Key generate error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};