const router = require("express").Router();
const { body } = require("express-validator");
const c = require("../controllers/productController");

// ── Middleware: admin check ───────────────
const adminOnly = (req, res, next) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required." });
  }
  next();
};

const authRequired = (req, res, next) => {
  if (!req.headers["x-user-id"]) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  next();
};

// ── Product rules ─────────────────────────
const productRules = [
  body("name").trim().notEmpty().withMessage("Name required"),
  body("description").trim().notEmpty().withMessage("Description required"),
  body("price").isFloat({ min: 0 }).withMessage("Valid price required"),
  body("category").isMongoId().withMessage("Valid category ID required"),
  body("stock").isInt({ min: 0 }).withMessage("Valid stock required"),
];

// ── Product routes ────────────────────────
router.get("/search", c.searchProducts);
router.get("/internal/:id", c.getProductInternal);
router.get("/:id", c.getProduct);
router.get("/", c.getProducts);
router.post("/", authRequired, adminOnly, productRules, c.createProduct);
router.put("/:id", authRequired, adminOnly, c.updateProduct);
router.patch("/:id/stock", c.updateStock);                    // internal
router.delete("/:id", authRequired, adminOnly, c.deleteProduct);
router.post("/:id/reviews", authRequired, c.addReview);

module.exports = router;

