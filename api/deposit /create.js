const { connectToDatabase } = require('../../lib/db');
const { createOrkutQRIS, formatRupiah } = require('../../lib/orkut');
const jwt = require('jsonwebtoken');

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Verifikasi token dari header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  const { nominal } = req.body;

  // Cari baris ini:
if (!nominal || isNaN(nominal) || nominal < 10000) { // ← UBAH 10000 sesuai keinginan
  return res.status(400).json({ 
    success: false, 
    message: 'Nominal minimal Rp 10.000' // ← UBAH juga pesannya
  });
}
  const parsedNominal = parseInt(nominal);
  
  // Random fee 200-500
  const randomFee = Math.floor(Math.random() * (500 - 200 + 1)) + 200;
  const totalBayar = parsedNominal + randomFee;
  
  const expiredAt = Date.now() + (5 * 60 * 1000); // 5 menit

  try {
    const { db } = await connectToDatabase();
    const deposits = db.collection('deposits');
    const users = db.collection('users');

    // Create QRIS via Orkut
    const orkutResult = await createOrkutQRIS(totalBayar);

    // Simpan deposit
    const depositData = {
      userId: decoded.userId,
      nominal: parsedNominal,
      fee: randomFee,
      totalBayar,
      metode: 'QRIS',
      orkutTrxId: orkutResult.trxid,
      qrImage: orkutResult.qris_image,
      qrString: orkutResult.qr_string,
      status: 'pending',
      expiredAt: new Date(expiredAt),
      createdAt: new Date()
    };

    const result = await deposits.insertOne(depositData);

    // Update user balance jika auto-check? Nanti di webhook

    res.json({
      success: true,
      data: {
        id: result.insertedId,
        ...depositData,
        _id: undefined
      }
    });

  } catch (error) {
    console.error('Deposit create error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Gagal membuat deposit' 
    });
  }
};