/**
 * Auth middleware for user-service.
 * The API Gateway has already verified the JWT and forwarded user info
 * as x-user-id, x-user-email, x-user-role headers.
 */
const protect = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  req.userId = userId;
  req.userRole = userRole;
  next();
};

const adminOnly = (req, res, next) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required." });
  }
  next();
};

module.exports = { protect, adminOnly };

