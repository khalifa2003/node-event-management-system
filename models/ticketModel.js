const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      required: true
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Ticket must belong to an event']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Ticket must belong to a user']
    },
    attendeeInfo: {
      name: {
        type: String,
        required: [true, 'Attendee name is required'],
        trim: true
      },
      email: {
        type: String,
        required: [true, 'Attendee email is required'],
        lowercase: true
      },
      phone: {
        type: String,
        required: [true, 'Attendee phone is required']
      },
      age: {
        type: Number,
        min: 1,
        max: 120
      },
      gender: {
        type: String,
        enum: ['male', 'female', 'other']
      }
    },
    seatInfo: {
      seatNumber: {
        type: String,
        required: [true, 'Seat number is required']
      },
      section: String,
      row: String
    },
    pricing: {
      originalPrice: {
        type: Number,
        required: [true, 'Original price is required'],
        min: 0
      },
      finalPrice: {
        type: Number,
        required: [true, 'Final price is required'],
        min: 0
      },
      discount: {
        type: Number,
        default: 0,
        min: 0
      },
      currency: {
        type: String,
        default: 'EGP'
      }
    },
    payment: {
      paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'online', 'bank_transfer'],
        required: true
      },
      transactionId: String,
      paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
      },
      paidAt: Date,
      refundedAt: Date
    },
    qrCode: {
      data: String,
      image: String // Base64 or file path
    },
    status: {
      type: String,
      enum: ['active', 'used', 'cancelled', 'expired'],
      default: 'active'
    },
    checkIn: {
      isCheckedIn: {
        type: Boolean,
        default: false
      },
      checkedInAt: Date,
      checkedInBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      gate: String
    },
    purchaseDate: {
      type: Date,
      default: Date.now
    },
    validUntil: Date,
    notes: String,
    metadata: {
      source: {
        type: String,
        enum: ['web', 'mobile', 'admin'],
        default: 'web'
      },
      userAgent: String,
      ipAddress: String
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
ticketSchema.index({ event: 1, user: 1 });
ticketSchema.index({ ticketNumber: 1 });
ticketSchema.index({ 'qrCode.data': 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ 'checkIn.isCheckedIn': 1 });

// Generate unique ticket number before save
ticketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    // Generate format: EVT-YYYYMMDD-XXXXX
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    this.ticketNumber = `EVT-${date}-${random}`;
    
    // Check if ticket number already exists
    const existingTicket = await mongoose.model('Ticket').findOne({ ticketNumber: this.ticketNumber });
    if (existingTicket) {
      // Generate new random number if duplicate
      const newRandom = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
      this.ticketNumber = `EVT-${date}-${newRandom}`;
    }
  }
  next();
});

// Set valid until date if not provided
ticketSchema.pre('save', function(next) {
  if (this.isNew && !this.validUntil && this.event) {
    // Valid until 24 hours after event end time
    this.validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

const Ticket = mongoose.model('Ticket', ticketSchema);
module.exports = Ticket;