const axios = require("axios");
const Order = require("../models/Order");

const CART_SERVICE    = process.env.CART_SERVICE_URL;
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL;
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL;
const INTERNAL_TOKEN  = process.env.INTERNAL_SERVICE_TOKEN;

const internalHeaders = { "x-internal-token": INTERNAL_TOKEN };

// ──────────────────────────────────────────
//  POST /api/orders  — Place order
// ──────────────────────────────────────────
exports.placeOrder = async (req, res) => {
  const { shippingAddress, paymentMethod, notes } = req.body;

  if (!shippingAddress || !paymentMethod) {
    return res.status(400).json({ success: false, message: "shippingAddress and paymentMethod required." });
  }

  const userId = req.headers["x-user-id"];

  try {
    // 1. Fetch user's cart
    const cartRes = await axios.get(`${CART_SERVICE}/api/cart/internal/${userId}`, { headers: internalHeaders });
    const cart = cartRes.data.data.cart;

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty." });
    }

    // 2. Validate each product & check stock (in parallel)
    await Promise.all(
      cart.items.map(async (item) => {
        const prodRes = await axios.get(`${PRODUCT_SERVICE}/api/products/internal/${item.productId}`, {
          headers: internalHeaders,
        });
        const product = prodRes.data.data.product;
        if (product.stock < item.quantity) {
          throw { status: 400, message: `"${item.name}" only has ${product.stock} units left.` };
        }
      })
    );

    // 3. Calculate totals
    const itemsTotal = cart.items.reduce((sum, i) => sum + i.subtotal, 0);
    const shippingCost = itemsTotal >= 500 ? 0 : 49; // Free shipping above ₹500
    const grandTotal = parseFloat((itemsTotal + shippingCost).toFixed(2));

    // 4. Create order
    const order = await Order.create({
      userId,
      items: cart.items,
      shippingAddress,
      itemsTotal,
      shippingCost,
      grandTotal,
      paymentMethod,
      notes,
    });

    // 5. Decrement stock for each product (fire-and-forget, could use a queue in production)
    cart.items.forEach((item) => {
      axios
        .patch(`${PRODUCT_SERVICE}/api/products/${item.productId}/stock`,
          { quantity: item.quantity, operation: "decrement" },
          { headers: internalHeaders }
        )
        .catch((err) => console.error("[OrderService] Stock decrement failed:", err.message));
    });

    // 6. Clear the cart
    axios
      .delete(`${CART_SERVICE}/api/cart/internal/${userId}`, { headers: internalHeaders })
      .catch((err) => console.error("[OrderService] Cart clear failed:", err.message));

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      data: { order },
    });
  } catch (err) {
    console.error("[placeOrder]", err);
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: "Could not place order." });
  }
};

// ──────────────────────────────────────────
//  GET /api/orders  — User's order history
// ──────────────────────────────────────────
exports.getUserOrders = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const userId = req.headers["x-user-id"];

  try {
    const [orders, total] = await Promise.all([
      Order.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Order.countDocuments({ userId }),
    ]);

    res.json({
      success: true,
      data: { orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch orders." });
  }
};

// ──────────────────────────────────────────
//  GET /api/orders/:id
// ──────────────────────────────────────────
exports.getOrder = async (req, res) => {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  try {
    const query = userRole === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, userId };

    const order = await Order.findOne(query);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    res.json({ success: true, data: { order } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch order." });
  }
};

// ──────────────────────────────────────────
//  PUT /api/orders/:id/cancel
// ──────────────────────────────────────────
exports.cancelOrder = async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { reason } = req.body;

  try {
    const order = await Order.findOne({ _id: req.params.id, userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    const cancellable = ["pending", "confirmed"];
    if (!cancellable.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in "${order.status}" status.`,
      });
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancellationReason = reason || "Customer requested cancellation";
    order.statusHistory.push({ status: "cancelled", message: order.cancellationReason });
    await order.save();

    // Restore stock
    order.items.forEach((item) => {
      axios
        .patch(`${PRODUCT_SERVICE}/api/products/${item.productId}/stock`,
          { quantity: item.quantity, operation: "increment" },
          { headers: internalHeaders }
        )
        .catch((err) => console.error("[OrderService] Stock restore failed:", err.message));
    });

    res.json({ success: true, message: "Order cancelled.", data: { order } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not cancel order." });
  }
};

// ──────────────────────────────────────────
//  PATCH /api/orders/:id/status  (admin)
// ──────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin only." });
  }

  const { status, message, trackingNumber } = req.body;
  const validStatuses = ["confirmed", "processing", "shipped", "delivered", "refunded"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status. Use: ${validStatuses.join(", ")}` });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (status === "delivered") order.deliveredAt = new Date();
    order.statusHistory.push({ status, message: message || `Order ${status}` });

    await order.save();
    res.json({ success: true, message: "Status updated.", data: { order } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Status update failed." });
  }
};

// ──────────────────────────────────────────
//  GET /api/orders/admin/all  (admin)
// ──────────────────────────────────────────
exports.getAllOrders = async (req, res) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin only." });
  }

  const { status, page = 1, limit = 20 } = req.query;
  const filter = status ? { status } : {};

  try {
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { orders, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not fetch orders." });
  }
};

// ──────────────────────────────────────────
//  GET /api/orders/internal/:id  (payment service)
// ──────────────────────────────────────────
exports.getOrderInternal = async (req, res) => {
  const token = req.headers["x-internal-token"];
  if (token !== INTERNAL_TOKEN) return res.status(403).json({ success: false, message: "Forbidden." });

  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    res.json({ success: true, data: { order } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal lookup failed." });
  }
};

// ──────────────────────────────────────────
//  PATCH /api/orders/internal/:id/payment  (payment service callback)
// ──────────────────────────────────────────
exports.updatePaymentStatus = async (req, res) => {
  const token = req.headers["x-internal-token"];
  if (token !== INTERNAL_TOKEN) return res.status(403).json({ success: false, message: "Forbidden." });

  const { paymentStatus, paymentId } = req.body;

  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    order.paymentStatus = paymentStatus;
    order.paymentId = paymentId;

    if (paymentStatus === "paid") {
      order.status = "confirmed";
      order.statusHistory.push({ status: "confirmed", message: "Payment received, order confirmed" });
    } else if (paymentStatus === "failed") {
      order.status = "cancelled";
      order.statusHistory.push({ status: "cancelled", message: "Payment failed" });
    }

    await order.save();
    res.json({ success: true, data: { order } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Payment status update failed." });
  }
};

