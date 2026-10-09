require("dotenv").config();
require("express-async-errors"); 

const express = require("express");
const cors = require("cors");

// Import routes
const authenticate = require("./middleware/authenticate");
const authRoutes = require("./routes/auth");
const worldRoutes = require("./routes/worlds");
const imageRoutes = require("./routes/routes");
const {
    nested: documentNestedRoutes,
    standalone: documentStandaloneRoutes,
} = require("./routes/documents");

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
// Middleware
app.use(cors());
app.use(express.json());
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
app.use("/auth", authRoutes);

// vaild JWT token is required for all routes below this line
app.use(authenticate);

app.use("/worlds", worldRoutes);
app.use("/worlds/:worldId/documents", documentNestedRoutes);
app.use("/documents", documentStandaloneRoutes);
app.use("/images", imageRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});