const axios = require('axios');

function getOrkutConfig() {
  return {
    // ⚠️ GANTI INI dengan punya kamu
    apiKey: process.env.ORKUT_API_KEY || "skyy7", // ← GANTI skyy7
    username: process.env.ORKUT_USERNAME || "inivirgi", // ← GANTI inivirgi
    token: process.env.ORKUT_TOKEN || "2775642:yCQwEFSdANvzjWLtPR73UY48faGrXimZ" // ← GANTI token
  };
}

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(angka);
}

async function createOrkutQRIS(amount) {
  const config = getOrkutConfig();
  const createUrl = `https://skyserver.web.id/?action=createpayment&apikey=${config.apiKey}&username=${config.username}&amount=${amount}&token=${config.token}`;
  
  const response = await axios.get(createUrl, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  if (!response.data?.status || !response.data?.result) {
    throw new Error(response.data?.message || "Gagal membuat QRIS");
  }

  return response.data.result;
}

async function checkOrkutMutation(targetAmount, startTime) {
  const config = getOrkutConfig();
  
  const mutasiUrl = `https://skyserver.web.id/?action=mutasiqr&apikey=${config.apiKey}&username=${config.username}&token=${config.token}`;
  
  const response = await axios.get(mutasiUrl, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  if (!response.data?.status) {
    return { found: false, error: "API Error" };
  }

  const results = response.data.result?.results || [];
  
  const found = results.find(t => {
    if (t.status !== "IN" && t.status !== "INV") return false;
    
    const nominalStr = String(t.kredit || '0').replace(/[^0-9]/g, '');
    const nominal = parseInt(nominalStr) || 0;
    
    if (nominal !== targetAmount) return false;
    
    if (t.tanggal && startTime) {
      try {
        const [datePart, timePart] = t.tanggal.split(' ');
        const [day, month, year] = datePart.split('/').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        
        const transTime = new Date(year, month-1, day, hour, minute, second).getTime();
        if (transTime < startTime - 60000) return false;
      } catch (e) {
        return false;
      }
    }
    
    return true;
  });

  return { found: !!found, data: found };
}

module.exports = { getOrkutConfig, formatRupiah, createOrkutQRIS, checkOrkutMutation };