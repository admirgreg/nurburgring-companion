import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "dev-db.json");

const app = express();
const port = Number(process.env.PORT || 8080);
const jwtSecret = process.env.JWT_SECRET || "dev-only-change-me";
const tokenMaxAge = "14d";
const allowedOrigin = process.env.CORS_ORIGIN || true;
const hasPostgres = Boolean(process.env.DATABASE_URL);

if (process.env.NODE_ENV === "production" && jwtSecret === "dev-only-change-me") {
  console.warn("JWT_SECRET is not set. Set it in production before sharing the app.");
}

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "6mb" }));

const pool = hasPostgres
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false }
    })
  : null;

async function readDevDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(dataFile, "utf8"));
  } catch {
    return { users: [], states: {} };
  }
}

async function writeDevDb(db) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(db, null, 2), "utf8");
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || user.displayName || ""
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: tokenMaxAge });
}

async function initDb() {
  if (!pool) return;
  await pool.query(`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      display_name text,
      password_hash text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists user_states (
      user_id text primary key references users(id) on delete cascade,
      state jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
  `);
}

async function findUserByEmail(email) {
  if (pool) {
    const result = await pool.query("select * from users where email = $1", [email]);
    return result.rows[0] || null;
  }
  const db = await readDevDb();
  return db.users.find((user) => user.email === email) || null;
}

async function findUserById(id) {
  if (pool) {
    const result = await pool.query("select * from users where id = $1", [id]);
    return result.rows[0] || null;
  }
  const db = await readDevDb();
  return db.users.find((user) => user.id === id) || null;
}

async function createUser({ email, displayName, passwordHash }) {
  const user = {
    id: randomUUID(),
    email,
    display_name: displayName || "",
    password_hash: passwordHash
  };

  if (pool) {
    const result = await pool.query(
      `insert into users (id, email, display_name, password_hash)
       values ($1, $2, $3, $4)
       returning *`,
      [user.id, user.email, user.display_name, user.password_hash]
    );
    return result.rows[0];
  }

  const db = await readDevDb();
  db.users.push(user);
  db.states[user.id] = { state: {}, updatedAt: new Date().toISOString() };
  await writeDevDb(db);
  return user;
}

async function getUserState(userId) {
  if (pool) {
    const result = await pool.query("select state, updated_at from user_states where user_id = $1", [userId]);
    return {
      state: result.rows[0]?.state || {},
      updatedAt: result.rows[0]?.updated_at || null
    };
  }
  const db = await readDevDb();
  return db.states[userId] || { state: {}, updatedAt: null };
}

async function saveUserState(userId, state) {
  const now = new Date().toISOString();
  if (pool) {
    const result = await pool.query(
      `insert into user_states (user_id, state, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_id) do update set state = excluded.state, updated_at = now()
       returning state, updated_at`,
      [userId, JSON.stringify(state)]
    );
    return { state: result.rows[0].state, updatedAt: result.rows[0].updated_at };
  }

  const db = await readDevDb();
  db.states[userId] = { state, updatedAt: now };
  await writeDevDb(db);
  return db.states[userId];
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validatePassword(password) {
  return String(password || "").length >= 6;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) return res.status(401).json({ error: "missing_token" });

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: "invalid_token" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storage: hasPostgres ? "postgres" : "file" });
});

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const displayName = String(req.body.displayName || "").trim();

  if (!email.includes("@")) return res.status(400).json({ error: "invalid_email" });
  if (!validatePassword(password)) return res.status(400).json({ error: "weak_password" });
  if (await findUserByEmail(email)) return res.status(409).json({ error: "email_exists" });

  const passwordHash = await bcrypt.hash(password, 11);
  const user = await createUser({ email, displayName, passwordHash });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const user = await findUserByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/state", requireAuth, async (req, res) => {
  res.json(await getUserState(req.user.id));
});

app.put("/api/state", requireAuth, async (req, res) => {
  if (!req.body || typeof req.body.state !== "object" || Array.isArray(req.body.state)) {
    return res.status(400).json({ error: "invalid_state" });
  }
  res.json(await saveUserState(req.user.id, req.body.state));
});

app.use(express.static(distDir));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

await initDb();
app.listen(port, () => {
  console.log(`Nurburgring Companion listening on :${port} (${hasPostgres ? "postgres" : "file"} storage)`);
});
