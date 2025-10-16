const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Search name is required'],
    trim: true,
    maxlength: [100, 'Search name cannot exceed 100 characters']
  },
  query: {
    type: Object,
    required: [true, 'Search query is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
