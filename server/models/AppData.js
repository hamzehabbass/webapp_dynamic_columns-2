// model
import mongoose from "mongoose";

const AppDataSchema = new mongoose.Schema({
  fleet: { type: Array, default: [] },
  drivers: { type: Array, default: [] },
  columns: { type: Array, default: [] },
  statusOptions: { type: Object, default: {} },
  destinations: { type: Array, default: [] },
  dailyManifest: { type: Object, default: { morning: [], midday: [], evening: [] }},
  lastDate: { type: String, default: "" }
});

export default mongoose.model("AppData", AppDataSchema);
