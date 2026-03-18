const { connectToDatabase } = require('../../lib/db');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

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

  const { depositId } = req.body;

  if (!depositId) {
    return res.status(400).json({ success: false, message: 'Deposit ID required' });
  }

  try {
    const { db } = await connectToDatabase();
    const deposits = db.collection('deposits');

    const result = await deposits.updateOne(
      { 
        _id: new ObjectId(depositId),
        userId: decoded.userId,
        status: 'pending'
      },
      { $set: { status: 'canceled' } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Deposit not found or cannot be canceled' 
      });
    }

    res.json({
      success: true,
      message: 'Deposit canceled successfully'
    });

  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};