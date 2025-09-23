import mongoose from "mongoose";
import bcrypt from "bcrypt";

const MONGO_URI = "mongodb://127.0.0.1:27017/transcriptApp";

const UserSchema = new mongoose.Schema({ email: String, password: String });
const User = mongoose.model("User", UserSchema);

async function main() {
  await mongoose.connect(MONGO_URI);

  const hashed = await bcrypt.hash("Goharsaeed", 10); // password
  const user = new User({ email: "Gohars.0312@gmail.com", password: hashed });
  await user.save();

  console.log("✅ User created:", user.email);
  process.exit();
}

main().catch(err => console.error(err));
