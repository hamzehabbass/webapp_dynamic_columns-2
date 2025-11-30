// auth routes
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { password } = req.body;
  const user = await User.findOne();

  if (!user) return res.status(404).json({ error: "Admin not set" });

  const ok = await bcrypt.compare(password, user.passwordHash);

  if (!ok) return res.status(401).json({ error: "Wrong password" });

  res.json({ success: true });
});

export default router;
