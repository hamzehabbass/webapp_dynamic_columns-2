import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

import authRoutes from "./routes/authRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

app.use("/api/auth", authRoutes);
app.use("/api/data", dataRoutes);

// CREATE DEFAULT ADMIN IF NOT EXISTS
const init = async () => {
  const u = await User.findOne();
  if (!u) {
    await User.create({
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
    });
    console.log("Admin created");
  }
};
init();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running ${PORT}`));
