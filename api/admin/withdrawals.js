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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded || decoded.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { db } = await connectToDatabase();
  const withdrawals = db.collection('withdrawals');

  // GET - List semua penarikan
  if (req.method === 'GET') {
    try {
      const list = await withdrawals
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return res.json({
        success: true,
        data: list
      });
    } catch (error) {
      console.error('Admin withdrawals error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // POST - Konfirmasi penarikan
  if (req.method === 'POST') {
    const { withdrawId, action } = req.body; // action: 'confirm' or 'reject'

    if (!withdrawId || !action) {
      return res.status(400).json({ 
        success: false, 
        message: 'Withdraw ID and action required' 
      });
    }

    try {
      const withdraw = await withdrawals.findOne({ 
        _id: new ObjectId(withdrawId) 
      });

      if (!withdraw) {
        return res.status(404).json({ success: false, message: 'Withdraw not found' });
      }

      if (withdraw.status !== 'pending') {
        return res.status(400).json({ 
          success: false, 
          message: `Withdraw already ${withdraw.status}` 
        });
      }

      if (action === 'confirm') {
        await withdrawals.updateOne(
          { _id: withdraw._id },
          { 
            $set: { 
              status: 'success',
              confirmedAt: new Date(),
              confirmedBy: decoded.userId
            } 
          }
        );

        return res.json({
          success: true,
          message: 'Penarikan dikonfirmasi'
        });

      } else if (action === 'reject') {
        // Kembalikan saldo ke user
        const users = db.collection('users');
        
        await users.updateOne(
          { _id: withdraw.userId },
          { $inc: { saldo: withdraw.totalPotongan } }
        );

        await withdrawals.updateOne(
          { _id: withdraw._id },
          { 
            $set: { 
              status: 'rejected',
              rejectedAt: new Date(),
              rejectedBy: decoded.userId
            } 
          }
        );

        return res.json({
          success: true,
          message: 'Penarikan ditolak, saldo dikembalikan'
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid action' });

    } catch (error) {
      console.error('Admin withdrawals error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
};