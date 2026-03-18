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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
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

  try {
    const { db } = await connectToDatabase();
    const users = db.collection('users');
    const deposits = db.collection('deposits');
    const withdrawals = db.collection('withdrawals');

    // Total users
    const totalUsers = await users.countDocuments();

    // Total saldo semua user
    const usersAgg = await users.aggregate([
      { $group: { _id: null, totalSaldo: { $sum: '$saldo' } } }
    ]).toArray();
    const totalSaldo = usersAgg[0]?.totalSaldo || 0;

    // Total deposit sukses
    const depositsAgg = await deposits.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$nominal' }, count: { $sum: 1 } } }
    ]).toArray();
    const totalDeposit = depositsAgg[0]?.total || 0;
    const totalDepositCount = depositsAgg[0]?.count || 0;

    // Total fee terkumpul dari deposit
    const feeAgg = await deposits.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, totalFee: { $sum: '$fee' } } }
    ]).toArray();
    const totalFee = feeAgg[0]?.totalFee || 0;

    // Total penarikan pending
    const pendingWithdrawals = await withdrawals.countDocuments({ status: 'pending' });

    // Total keuntungan (fee deposit - fee withdraw? Sesuaikan)
    const totalProfit = totalFee; // Sederhananya fee deposit

    res.json({
      success: true,
      data: {
        totalUsers,
        totalSaldo,
        totalDeposit,
        totalDepositCount,
        totalFee,
        totalProfit,
        pendingWithdrawals
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};