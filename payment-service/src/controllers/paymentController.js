const axios = require("axios");
const Payment = require("../models/Payment");

const ORDER_SERVICE  = process.env.ORDER_SERVICE_URL;
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const internalHeaders = { "x-internal-token": INTERNAL_TOKEN };

// ──────────────────────────────────────────
//  Simulate payment gateway (mock)
//  In production: integrate Razorpay / Stripe
// ──────────────────────────────────────────
const simulateGateway = (method, amount, metadata) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 90% success rate simulation
      const success = Math.random() > 0.1;
      resolve({
        success,
        gatewayTransactionId: `GW-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        message: success ? "Payment authorised" : "Payment declined by bank",
        code: success ? "00" : "51",
      });
    }, 300); // Simulate 300ms gateway latency
  });
};

// ──────────────────────────────────────────
//  POST /api/payments/process
// ──────────────────────────────────────────
exports.processPayment = async (req, res) => {
  const { orderId, method, metadata } = req.body;
  const userId = req.headers["x-user-id"];

  if (!orderId || !method) {
    return res.status(400).json({ success: false, message: "orderId and method required." });
  }

  try {
    // 1. Fetch order
    const orderRes = await axios.get(`${ORDER_SERVICE}/api/orders/internal/${orderId}`, {
      headers: internalHeaders,
    });
    const order = orderRes.data.data.order;

    if (order.userId !== userId) {
      return res.status(403).json({ success: false, message: "Order does not belong to you." });
    }
    if (order.paymentStatus === "paid") {
      return res.status(409).json({ success: false, message: "Order already paid." });
    }

    // 2. Create payment record
    const payment = await Payment.create({
      orderId,
      userId,
      amount: order.grandTotal,
      method,
      metadata,
      status: "processing",
    });

    // 3. Simulate gateway
    const gatewayResult = await simulateGateway(method, order.grandTotal, metadata);

    // 4. Update payment record
    payment.status = gatewayResult.success ? "success" : "failed";
    payment.gatewayTransactionId = gatewayResult.gatewayTransactionId;
    payment.gatewayResponse = gatewayResult;
    await payment.save();

    // 5. Notify order service of payment result
    await axios.patch(
      `${ORDER_SERVICE}/api/orders/internal/${orderId}/payment`,
      {
        paymentStatus: gatewayResult.success ? "paid" : "failed",
        paymentId: payment._id,
      },
      { headers: internalHeaders }
    );

    if (gatewayResult.success) {
      return res.status(200).json({
        success: true,
        message: "Payment successful! 🎉",
        data: {
          transactionId: payment.transactionId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          gatewayTransactionId: payment.gatewayTransactionId,
        },
      });
    } else {
      return res.status(402).json({
        success: false,
        message: "Payment failed. Please try again.",
        data: {
          transactionId: payment.transactionId,
          reason: gatewayResult.message,
        },
      });
    }
  } catch (err) {
    console.error("[processPayment]", err.message);
    res.status(500).json({ success: false, message: "Payment processing error." });
  }
};

// ──────────────────────────────────────────
//  GET /api/payments/:orderId
// ──────────────────────────────────────────
exports.getPaymentByOrder = async (req, res) => {
  const userId = req.headers["x-user-id"];

  try {
    const payment = await Payment.findOne({ orderId: req.params.orderId, userId });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });

    res.json({ success: true, data: { payment } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch payment." });
  }
};

// ──────────────────────────────────────────
//  GET /api/payments/history
// ──────────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
  const userId = req.headers["x-user-id"];
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const [payments, total] = await Promise.all([
      Payment.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Payment.countDocuments({ userId }),
    ]);

    res.json({
      success: true,
      data: { payments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch payment history." });
  }
};

// ──────────────────────────────────────────
//  POST /api/payments/refund/:paymentId
// ──────────────────────────────────────────
exports.refundPayment = async (req, res) => {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];
  const { reason, amount } = req.body;

  try {
    const query = userRole === "admin"
      ? { _id: req.params.paymentId }
      : { _id: req.params.paymentId, userId };

    const payment = await Payment.findOne(query);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });

    if (payment.status !== "success") {
      return res.status(400).json({ success: false, message: "Only successful payments can be refunded." });
    }

    const refundAmount = amount || payment.amount;
    if (refundAmount > payment.amount) {
      return res.status(400).json({ success: false, message: "Refund amount exceeds payment amount." });
    }

    // Simulate refund gateway
    payment.status = refundAmount === payment.amount ? "refunded" : "partially_refunded";
    payment.refundAmount = refundAmount;
    payment.refundReason = reason || "Customer request";
    payment.refundedAt = new Date();
    await payment.save();

    // Notify order service
    await axios.patch(
      `${ORDER_SERVICE}/api/orders/internal/${payment.orderId}/payment`,
      { paymentStatus: "refunded", paymentId: payment._id },
      { headers: internalHeaders }
    ).catch(() => {}); // Non-critical

    res.json({
      success: true,
      message: `Refund of ₹${refundAmount} initiated.`,
      data: { transactionId: payment.transactionId, refundAmount, status: payment.status },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Refund failed." });
  }
};

// ──────────────────────────────────────────
//  GET /api/payments/admin/all  (admin)
// ──────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin only." });
  }

  const { status, page = 1, limit = 20 } = req.query;
  const filter = status ? { status } : {};

  try {
    const [payments, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
      Payment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { payments, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch payments." });
  }
};

