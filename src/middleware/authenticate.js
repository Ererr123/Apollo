const jwt = require("jsonwebtoken");
// Verifies the JWT in the Authorization header and attaches the decoded
// payload (userId, email) to req.user. Every route below /worlds and
// /documents sits behind this.
function authenticate(req, res, next) {

    // Check for the Authorization header and ensure it starts with "Bearer "
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
    }
    const token = header.slice("Bearer ".length);

    // Verify the JWT and attach the decoded payload to req.user
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.sub, email: decoded.email };
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

module.exports = authenticate;