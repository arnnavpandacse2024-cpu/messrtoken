require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MongoDB Connection with Auto-reconnection Logic
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[SUCCESS] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[ERROR] MongoDB Connection Failed: ${error.message}`);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// 1. Settings Schema & Model
const settingsSchema = new mongoose.Schema({
  isBookingOpen: { type: Boolean, default: true },
  openMonday: { type: Boolean, default: true },
  openSaturday: { type: Boolean, default: false },
  specialSundayBreakfast: { type: Boolean, default: false },
  everydayStart: { type: String, default: "18:00" },
  everydayEnd: { type: String, default: "21:30" },
  saturdayStart: { type: String, default: "13:30" },
  saturdayEnd: { type: String, default: "16:30" },
  specialStart: { type: String, default: "18:00" },
  specialEnd: { type: String, default: "21:30" },
  tokenLink: { type: String, default: "https://nist-university-admin.example.com" }
}, { timestamps: true });

const Settings = mongoose.model("Settings", settingsSchema);

// 2. Submission Schema & Model
const submissionSchema = new mongoose.Schema({
  roll: { type: String, required: true },
  name: { type: String, required: true },
  room: { type: String },
  hostel: { type: String },
  mobile: { type: String },
  day: { type: String },
  time: { type: String },
  foodType: { type: String },
  menuItem: { type: String },
  bookingDate: { type: String, required: true },
  tokenId: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Prevent duplicate bookings (Roll + Date)
submissionSchema.index({ roll: 1, bookingDate: 1 }, { unique: true });

const Submission = mongoose.model("Submission", submissionSchema);

// Helper to get or create settings
async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}

// API Routes
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/api/status", async (req, res) => {
  const status = mongoose.connection.readyState;
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({ 
    success: true, 
    status: states[status] || "unknown",
    readyState: status,
    dbName: mongoose.connection.name || "not connected"
  });
});

app.post("/api/settings", async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate({}, req.body, { 
      new: true, 
      upsert: true,
      setDefaultsOnInsert: true 
    });
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/api/list", async (req, res) => {
  try {
    const records = await Submission.find({}).sort({ bookingDate: -1, name: 1 });
    res.json({ success: true, records });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/submit", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload?.roll || !payload?.name) {
      return res.status(400).json({ success: false, message: "Missing required fields (roll or name)." });
    }

    const settings = await getSettings();
    if (!settings.isBookingOpen) {
      return res.status(403).json({ success: false, message: "Booking is currently closed by admin." });
    }

    const bookingDate = payload.bookingDate || new Date().toISOString().slice(0, 10);
    
    // Check for duplicates manually (Mongoose index will also catch it)
    const existing = await Submission.findOne({ 
      roll: payload.roll.toLowerCase(), 
      bookingDate: bookingDate 
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "Roll number already has a token for this day." });
    }

    const newRecord = new Submission({
      ...payload,
      roll: payload.roll.toLowerCase(),
      bookingDate: bookingDate
    });

    await newRecord.save();
    return res.json({ success: true, message: "Booking successful", record: newRecord });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ success: false, message: "Roll number already has a token for this day." });
    }
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=========================================`);
  console.log(`MESS SYSTEM SERVER STARTED (MONGODB READY)`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`=========================================\n`);
});