const router = require("express").Router();
const { body } = require("express-validator");
const controller = require("../controllers/userController");
const { protect, adminOnly } = require("../middleware/auth");

// ── Validation rules ──────────────────────
const registerRules = [
  body("name").trim().isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 chars"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 6 }).withMessage("Password min 6 chars"),
  body("phone").optional().isMobilePhone("en-IN").withMessage("Valid Indian phone required"),
];

const loginRules = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty().withMessage("Password required"),
];

const updateRules = [
  body("name").optional().trim().isLength({ min: 2, max: 50 }),
  body("phone").optional().isMobilePhone("en-IN"),
];

// ── Public routes ─────────────────────────
router.post("/register", registerRules, controller.register);
router.post("/login", loginRules, controller.login);

// ── Protected routes ──────────────────────
router.get("/profile", protect, controller.getProfile);
router.put("/profile", protect, updateRules, controller.updateProfile);
router.post("/addresses", protect, controller.addAddress);
router.delete("/addresses/:addressId", protect, controller.removeAddress);

// ── Internal route (service-to-service) ───
router.get("/internal/:id", controller.getUserById);

// ── Admin routes ──────────────────────────
router.get("/", protect, adminOnly, controller.getAllUsers);

module.exports = router;

