const router = require("express").Router();
const c = require("../controllers/cartController");

const auth = (req, res, next) => {
  req.userId = req.headers["x-user-id"];
  if (!req.userId) return res.status(401).json({ success: false, message: "Unauthorized." });
  next();
};

// Internal (service-to-service)
router.get("/internal/:userId", c.getCartInternal);
router.delete("/internal/:userId", c.clearCartInternal);

// User-facing (all require auth)
router.get("/", auth, c.getCart);
router.post("/add", auth, c.addToCart);
router.put("/update", auth, c.updateCartItem);
router.delete("/remove/:productId", auth, c.removeFromCart);
router.delete("/clear", auth, c.clearCart);

module.exports = router;

