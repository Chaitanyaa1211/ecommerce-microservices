const router = require("express").Router();
const c = require("../controllers/orderController");

const auth = (req, res, next) => {
  if (!req.headers["x-user-id"]) return res.status(401).json({ success: false, message: "Unauthorized." });
  next();
};

// Internal routes (service-to-service)
router.get("/internal/:id", c.getOrderInternal);
router.patch("/internal/:id/payment", c.updatePaymentStatus);

// Admin routes
router.get("/admin/all", auth, c.getAllOrders);

// User routes
router.post("/", auth, c.placeOrder);
router.get("/", auth, c.getUserOrders);
router.get("/:id", auth, c.getOrder);
router.put("/:id/cancel", auth, c.cancelOrder);
router.patch("/:id/status", auth, c.updateOrderStatus);

module.exports = router;

