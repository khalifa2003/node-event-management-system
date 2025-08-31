const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    slug: {
      type: String,
      lowercase: true
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [200, 'Short description cannot exceed 200 characters']
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Event category is required']
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Event organizer is required']
    },
    images: [{
      type: String
    }],
    coverImage: {
      type: String,
      required: [true, 'Cover image is required']
    },
    venue: {
      name: {
        type: String,
        required: [true, 'Venue name is required'],
        trim: true
      },
      address: {
        type: String,
        required: [true, 'Venue address is required'],
        trim: true
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
      },
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    dateTime: {
      start: {
        type: Date,
        required: [true, 'Event start date is required']
      },
      end: {
        type: Date,
        required: [true, 'Event end date is required']
      }
    },
    pricing: {
      ticketPrice: {
        type: Number,
        required: [true, 'Ticket price is required'],
        min: [0, 'Price cannot be negative']
      },
      currency: {
        type: String,
        default: 'EGP',
        enum: ['EGP', 'USD', 'EUR']
      },
      earlyBird: {
        price: Number,
        deadline: Date
      }
    },
    capacity: {
      totalSeats: {
        type: Number,
        required: [true, 'Total seats is required'],
        min: [1, 'Must have at least 1 seat']
      },
      availableSeats: {
        type: Number,
        required: true
      },
      soldSeats: {
        type: Number,
        default: 0
      }
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
      default: 'draft'
    },
    tags: [{
      type: String,
      trim: true
    }],
    features: [{
      type: String,
      trim: true
    }],
    ageRestriction: {
      minAge: {
        type: Number,
        min: 0,
        default: 0
      },
      maxAge: {
        type: Number,
        max: 120
      }
    },
    socialLinks: {
      website: String,
      facebook: String,
      twitter: String,
      instagram: String
    },
    isPopular: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    views: {
      type: Number,
      default: 0
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
eventSchema.index({ title: 'text', description: 'text' });
eventSchema.index({ category: 1 });
eventSchema.index({ 'dateTime.start': 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ 'venue.city': 1 });

// Virtual populate for reviews
eventSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'event'
});

// Virtual populate for tickets
eventSchema.virtual('tickets', {
  ref: 'Ticket',
  localField: '_id',
  foreignField: 'event'
});

// Virtual for average rating
eventSchema.virtual('avgRating').get(function() {
  if (this.reviews && this.reviews.length > 0) {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    return Math.round((sum / this.reviews.length) * 10) / 10;
  }
  return 0;
});

// Create slug before save
eventSchema.pre('save', function(next) {
  if (this.title) {
    const unique = uuidv4().slice(0, 6);
    this.slug = `${this.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')}-${unique}`;
  }
  
  // Set available seats if not provided
  if (this.isNew && !this.capacity.availableSeats) {
    this.capacity.availableSeats = this.capacity.totalSeats;
  }
  next();
});

// Update available seats when sold seats change
eventSchema.pre('save', function(next) {
  if (this.isModified('capacity.soldSeats')) {
    this.capacity.availableSeats = this.capacity.totalSeats - this.capacity.soldSeats;
  }
  next();
});

// Validate end date is after start date
eventSchema.pre('save', function(next) {
  if (this.dateTime.end <= this.dateTime.start) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;