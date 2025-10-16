const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['client', 'freelancer', 'admin'], required: true },
  profileImage: String,
  // Profile fields
  name: String,
  bio: String,
  skills: [String],
  hourlyRate: Number,
  location: String,
  company: String,
  // Verification fields
  verified: { type: Boolean, default: false },
  verificationStatus: { type: String, enum: ['none','pending','approved','rejected'], default: 'none' },
  verificationDocs: [String],
  // Portfolio files (filenames stored in uploads/)
  portfolio: [String],
  // Cached rating info
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', userSchema);
