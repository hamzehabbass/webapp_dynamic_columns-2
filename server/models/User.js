// model
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  passwordHash: String
});

export default mongoose.model("User", UserSchema);
