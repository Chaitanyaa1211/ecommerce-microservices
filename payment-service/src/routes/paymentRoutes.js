const router = require("express").Router();
const c = require("../controllers/paymentController");

const auth = (req, res, next) => {
  if (!req.headers["x-user-id"]) return res.status(401).json({ success: false, message: "Unauthorized." });
  next();
};

router.get("/admin/all", auth, c.getAllPayments);
router.get("/history", auth, c.getPaymentHistory);
router.post("/process", auth, c.processPayment);
router.get("/:orderId", auth, c.getPaymentByOrder);
router.post("/refund/:paymentId", auth, c.refundPayment);

module.exports = router;

