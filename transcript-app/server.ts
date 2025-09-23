import mongoose from "mongoose";
import bcrypt from "bcrypt";
import cors from "cors";
import express, { type Request, type Response } from 'express';

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB (local or Atlas)
mongoose.connect("mongodb://127.0.0.1:27017/transcriptApp");

interface IUser extends mongoose.Document {
  email: string;
  password: string;
}

const userSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true },
  password: { type: String, required: true }
});

const User = mongoose.model<IUser>("User", userSchema);

// Login endpoint
app.post("/api/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

  res.json({ success: true });
});

app.listen(4000, () => console.log("Server running on http://localhost:4000"));
