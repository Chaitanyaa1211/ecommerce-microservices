const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name:      { type: String, required: true },
  price:     { type: Number, required: true },
  image:     { type: String },
  quantity:  { type: Number, required: true, min: 1 },
  subtotal:  { type: Number, required: true },
});

const addressSchema = new mongoose.Schema({
  street:  { type: String, required: true },
  city:    { type: String, required: true },
  state:   { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: "India" },
});

const statusHistorySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  message:   { type: String },
  timestamp: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    userId: { type: String, required: true },
    items:  [orderItemSchema],

    shippingAddress: { type: addressSchema, required: true },

    itemsTotal:    { type: Number, required: true },
    shippingCost:  { type: Number, default: 0 },
    discount:      { type: Number, default: 0 },
    grandTotal:    { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ["card", "upi", "netbanking", "cod", "wallet"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentId: { type: String },

    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
    },
    statusHistory: [statusHistorySchema],

    estimatedDelivery: { type: Date },
    deliveredAt:       { type: Date },
    cancelledAt:       { type: Date },
    cancellationReason: { type: String },

    trackingNumber: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

// Auto-generate order number
orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 9000 + 1000);
    this.orderNumber = `ORD-${ts}-${rand}`;

    // Push initial status
    this.statusHistory.push({ status: "pending", message: "Order placed successfully" });

    // Estimated delivery = 5 business days
    const delivery = new Date();
    delivery.setDate(delivery.getDate() + 5);
    this.estimatedDelivery = delivery;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);

