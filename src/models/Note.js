const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Supports user's paginated note list, admin list filtered by owner, and cascade delete of a user's notes
noteSchema.index({ owner: 1, _id: -1 });

module.exports = mongoose.model('Note', noteSchema);
