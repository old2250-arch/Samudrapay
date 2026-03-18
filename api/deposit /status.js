const { connectToDatabase } = require('../../lib/db');
const { checkOrkutMutation } = require('../../lib/orkut');
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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Verifikasi API Key atau Token
  const authHeader = req.headers.authorization;
  let userId = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      userId = decoded.userId;
    }
  }

  // Cek API Key
  const apiKey = req.headers['x-api-key'];
  if (!userId && apiKey) {
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ apiKey });
    if (user) {
      userId = user._id;
    }
  }

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { depositId } = req.body;

  if (!depositId) {
    return res.status(400).json({ success: false, message: 'Deposit ID required' });
  }

  try {
    const { db } = await connectToDatabase();
    const deposits = db.collection('deposits');
    const users = db.collection('users');

    const deposit = await deposits.findOne({ 
      _id: new ObjectId(depositId),
      userId: userId 
    });

    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }

    // Cek expired
    if (deposit.status === 'pending' && new Date() > deposit.expiredAt) {
      await deposits.updateOne(
        { _id: deposit._id },
        { $set: { status: 'expired' } }
      );
      deposit.status = 'expired';
    }

    // Cek mutasi Orkut jika masih pending
    if (deposit.status === 'pending') {
      const result = await checkOrkutMutation(
        deposit.totalBayar,
        deposit.createdAt.getTime()
      );

      if (result.found) {
        // Update deposit
        await deposits.updateOne(
          { _id: deposit._id },
          { $set: { status: 'success' } }
        );
        deposit.status = 'success';

        // Add saldo ke user
        await users.updateOne(
          { _id: userId },
          { $inc: { saldo: deposit.nominal } }
        );
      }
    }

    res.json({
      success: true,
      data: {
        id: deposit._id,
        nominal: deposit.nominal,
        fee: deposit.fee,
        totalBayar: deposit.totalBayar,
        status: deposit.status,
        expiredAt: deposit.expiredAt,
        createdAt: deposit.createdAt
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};