const mongoose = require('mongoose');
const jobSchema = new mongoose.Schema({
  title: String,
  description: String,
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  proposals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' }],
  milestones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' }],
  attachment: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Job', jobSchema);
