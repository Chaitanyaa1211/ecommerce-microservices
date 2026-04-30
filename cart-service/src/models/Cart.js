const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  productId:  { type: String, required: true },
  name:       { type: String, required: true },
  price:      { type: Number, required: true },
  image:      { type: String },
  quantity:   { type: Number, required: true, min: 1, default: 1 },
  subtotal:   { type: Number, required: true },
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true, // One cart per user
    },
    items: [cartItemSchema],
    totalItems: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    couponCode: { type: String },
    discount:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-calculate totals before save
cartSchema.pre("save", function (next) {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalPrice = parseFloat(
    this.items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
  );
  next();
});

module.exports = mongoose.model("Cart", cartSchema);

