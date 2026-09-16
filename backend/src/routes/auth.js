const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../lib/prisma");


// Number of rounds to use when hashing passwords. Higher is more secure but slower.
const SALT_ROUNDS = 10;

// Create a router for authentication-related routes
const router = express.Router();

// Define Zod schemas for validating request bodies
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
});

// Define Zod schema for login request body
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Function to sign a JWT token for a user
function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

// Route for user registration
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, name } = parsed.data;
  // Check if a user with the given email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }
  // Hash the password and create a new user in the database
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  const token = signToken(user);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

// Route for user login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;
  // Find the user by email in the database
  const user = await prisma.user.findUnique({ where: { email } });
  // Deliberately vague error on both "no such user" and "wrong password" -
  // don't leak which one it was, it's a user-enumeration side channel.
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  // Compare the provided password with the stored password hash
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

module.exports = router;