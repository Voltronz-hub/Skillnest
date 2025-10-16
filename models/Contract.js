const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['active','completed','cancelled'], default: 'active' },
  milestones: [{ title: String, dueDate: Date, amount: Number, completed: { type: Boolean, default: false } }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Contract', contractSchema);
