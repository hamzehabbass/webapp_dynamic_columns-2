// data routes
import express from "express";
import AppData from "../models/AppData.js";
import Archive from "../models/Archive.js";

const router = express.Router();

// LOAD ALL DATA
router.get("/load", async (req, res) => {
  let app = await AppData.findOne();
  if (!app) app = await AppData.create({});
  res.json(app);
});

// SAVE ALL DATA
router.post("/save", async (req, res) => {
  await AppData.updateOne({}, req.body, { upsert: true });
  res.json({ success: true });
});

// SAVE ARCHIVE DAY
router.post("/archive", async (req, res) => {
  const { date, data, columns } = req.body;
  await Archive.updateOne({ date }, { date, data, columns }, { upsert: true });
  res.json({ success: true });
});

// LOAD ALL ARCHIVES
router.get("/archives", async (req, res) => {
  const arcs = await Archive.find().sort({ date: -1 });
  res.json(arcs);
});

export default router;
