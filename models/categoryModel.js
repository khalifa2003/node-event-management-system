const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters']
    },
    slug: {
      type: String,
      lowercase: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    image: String,
    color: {
      type: String,
      default: '#3B82F6' // Default blue color
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual populate for events count
categorySchema.virtual('eventsCount', {
  ref: 'Event',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Create slug before save
categorySchema.pre('save', function(next) {
  if (this.name) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  }
  next();
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;