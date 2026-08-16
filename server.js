require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ---------- RDS MySQL connection ----------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

pool.getConnection()
  .then((conn) => {
    console.log("Connected to RDS MySQL.");
    conn.release();
  })
  .catch((err) => {
    console.error("MySQL connection error:", err.message);
    process.exit(1);
  });

// ---------- S3 client (auth via EC2 IAM role, no keys needed) ----------
const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// ---------- Auth middleware ----------
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided. Please log in first." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token is invalid or has expired." });
    }
    req.user = decoded;
    next();
  });
}

// ---------- POST /api/login ----------
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, username, password_hash FROM users WHERE username = ?",
      [username]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
    );

    return res.json({ message: "Login successful.", token });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error, please try again." });
  }
});

// ---------- GET /api/videos (protected) ----------
app.get("/api/videos", verifyToken, async (req, res) => {
  try {
    const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
    const response = await s3.send(command);

    const videos = (response.Contents || []).map((obj) => ({
      name: obj.Key,
      url: `/api/stream/${encodeURIComponent(obj.Key)}`,
    }));

    return res.json({ videos });
  } catch (err) {
    console.error("Videos fetch error:", err.message);
    return res.status(500).json({ message: "Could not load videos." });
  }
});

// ---------- GET /api/stream/:filename ----------
app.get("/api/stream/:filename", (req, res, next) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token is invalid or has expired." });
    }
    req.user = decoded;
    next();
  });
}, async (req, res) => {
  try {
    const key = req.params.filename;
    const range = req.headers.range;

    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    const fileSize = head.ContentLength;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      const s3Response = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Range: `bytes=${start}-${end}`,
      }));

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", end - start + 1);
      res.setHeader("Content-Type", s3Response.ContentType || "video/mp4");

      s3Response.Body.pipe(res);
    } else {
      const s3Response = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));

      res.setHeader("Content-Type", s3Response.ContentType || "video/mp4");
      res.setHeader("Content-Length", fileSize);
      res.setHeader("Accept-Ranges", "bytes");
      s3Response.Body.pipe(res);
    }
  } catch (err) {
    console.error("Stream error:", err.message);
    res.status(404).json({ message: "Video not found." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server is running at http://localhost:${PORT}`);
});
