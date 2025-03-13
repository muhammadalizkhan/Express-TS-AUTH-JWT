import { model, Schema } from "mongoose";

const userSchema = new Schema({
  name: String,
  email: String,
  password: String,
});

export const User = model("User", userSchema);
