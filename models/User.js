// User Schema (untuk MongoDB)
{
  _id: ObjectId,
  fullname: String,
  username: String,
  email: String,
  password: String,
  nomor: String,
  saldo: Number,
  role: String, // 'user' or 'admin'
  apiKey: String,
  createdAt: Date,
  lastLogin: Date
}