const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Review must belong to an event']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user']
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Review title cannot exceed 100 characters']
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review comment cannot exceed 1000 characters']
    },
    pros: [{
      type: String,
      trim: true
    }],
    cons: [{
      type: String,
      trim: true
    }],
    images: [{
      type: String
    }],
    isVerifiedPurchase: {
      type: Boolean,
      default: false
    },
    helpfulVotes: {
      type: Number,
      default: 0
    },
    reportedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: {
        type: String,
        enum: ['spam', 'inappropriate', 'fake', 'other']
      },
      reportedAt: {
        type: Date,
        default: Date.now
      }
    }],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved'
    },
    adminResponse: {
      message: String,
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      respondedAt: Date
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
reviewSchema.index({ event: 1, user: 1 }, { unique: true }); // One review per user per event
reviewSchema.index({ event: 1, rating: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ status: 1 });

// Check if user purchased ticket for this event
reviewSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Ticket = mongoose.model('Ticket');
    const ticket = await Ticket.findOne({
      event: this.event,
      user: this.user,
      'payment.paymentStatus': 'completed'
    });
    
    if (ticket) {
      this.isVerifiedPurchase = true;
    }
  }
  next();
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;