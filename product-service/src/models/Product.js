const mongoose = require("mongoose");
const slugify = require("slugify");

const reviewSchema = new mongoose.Schema(
  {
    userId:   { type: String, required: true },
    userName: { type: String, required: true },
    rating:   { type: Number, required: true, min: 1, max: 5 },
    comment:  { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Name too long"],
    },
    slug: { type: String, unique: true },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [2000, "Description too long"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    discountedPrice: {
      type: Number,
      min: [0, "Discounted price cannot be negative"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    brand: { type: String, trim: true },
    images: [{ type: String }],     // Array of image URLs
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    sku: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    tags: [{ type: String, lowercase: true }],
    specifications: { type: Map, of: String },  // e.g. { "RAM": "16GB", "Storage": "512GB" }
    reviews: [reviewSchema],
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-generate slug from name
productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true }) + "-" + Date.now();
  }
  next();
});

// Recalculate average rating after review changes
productSchema.methods.calculateRating = function () {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
    this.totalReviews = 0;
  } else {
    const total = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    this.averageRating = parseFloat((total / this.reviews.length).toFixed(1));
    this.totalReviews = this.reviews.length;
  }
};

// Text index for search
productSchema.index({ name: "text", description: "text", tags: "text", brand: "text" });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ averageRating: -1 });

module.exports = mongoose.model("Product", productSchema);

