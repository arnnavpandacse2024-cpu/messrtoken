const mongoose = require("mongoose");
require("dotenv").config();

const uri = process.env.MONGODB_URI;
console.log("Testing connection to:", uri.replace(/:([^@]+)@/, ":****@"));

mongoose.connect(uri)
  .then(() => {
    console.log("SUCCESS: Connected to MongoDB");
    process.exit(0);
  })
  .catch((err) => {
    console.error("FAILURE: Could not connect to MongoDB");
    console.error(err.message);
    process.exit(1);
  });
