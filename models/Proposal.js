const mongoose = require('mongoose');
const proposalSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: String,
  // status: 'pending' | 'hired' | 'accepted' | 'rejected'
  status: { type: String, enum: ['pending','hired','accepted','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Proposal', proposalSchema);
