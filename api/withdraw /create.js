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

  const { nominal, bank, nomorRekening, atasNama } = req.body;

  // Cari baris ini:
if (!nominal || nominal < 10000) { // ← UBAH minimal penarikan
  return res.status(400).json({ 
    success: false, 
    message: 'Minimal penarikan Rp 10.000' 
  });
}

  if (!bank || !nomorRekening || !atasNama) {
    return res.status(400).json({ 
      success: false, 
      message: 'Data bank harus lengkap' 
    });
  }

  const fee = 2000; // Fee penarikan Rp 2.000
  const totalPotongan = nominal + fee;

  try {
    const { db } = await connectToDatabase();
    const users = db.collection('users');
    const withdrawals = db.collection('withdrawals');

    // Cek saldo user
    const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
    
    if (!user || user.saldo < totalPotongan) {
      return res.status(400).json({ 
        success: false, 
        message: 'Saldo tidak mencukupi' 
      });
    }

    // Kurangi saldo
    await users.updateOne(
      { _id: user._id },
      { $inc: { saldo: -totalPotongan } }
    );

    // Buat permintaan penarikan
    const withdrawData = {
      userId: user._id,
      username: user.username,
      nominal,
      fee,
      totalPotongan,
      bank,
      nomorRekening,
      atasNama,
      status: 'pending',
      createdAt: new Date()
    };

    const result = await withdrawals.insertOne(withdrawData);

    res.json({
      success: true,
      message: 'Permintaan penarikan berhasil diajukan',
      data: {
        id: result.insertedId,
        ...withdrawData,
        _id: undefined
      }
    });

  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};