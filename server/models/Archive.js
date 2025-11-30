// model
import mongoose from "mongoose";

const ArchiveSchema = new mongoose.Schema({
  date: String,
  data: Object,
  columns: Array
});

export default mongoose.model("Archive", ArchiveSchema);
