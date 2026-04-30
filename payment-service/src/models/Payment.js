const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
    },
    orderId:  { type: String, required: true },
    userId:   { type: String, required: true },
    amount:   { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    method: {
      type: String,
      enum: ["card", "upi", "netbanking", "cod", "wallet"],
      required: true,
    },

    // Simulated payment gateway fields
    gatewayTransactionId: { type: String },
    gatewayResponse:      { type: Object },

    status: {
      type: String,
      enum: ["initiated", "processing", "success", "failed", "refunded", "partially_refunded"],
      default: "initiated",
    },

    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String },
    refundedAt:   { type: Date },

    metadata: { type: Object },  // For storing UPI ID, card last4, etc.
  },
  { timestamps: true }
);

paymentSchema.pre("save", function (next) {
  if (this.isNew) {
    const ts = Date.now().toString().slice(-8);
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.transactionId = `TXN-${ts}-${rand}`;
  }
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);

