import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SESSION_COOKIE = "job_agent_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function createId() {
  return crypto.randomUUID();
}

function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    createdAt: user.createdAt,
    profile: user.profile ?? null
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, passwordRecord) {
  const candidate = hashPassword(password, passwordRecord.salt);
  return crypto.timingSafeEqual(Buffer.from(candidate.hash, "hex"), Buffer.from(passwordRecord.hash, "hex"));
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...value] = part.split("=");
        return [key, decodeURIComponent(value.join("="))];
      })
  );
}

export class AuthStore {
  constructor(rootDir) {
    this.dbPath = path.join(rootDir, "data", "app-db.json");
    this.writeQueue = Promise.resolve();
  }

  async readDb() {
    try {
      const text = await fs.readFile(this.dbPath, "utf8");
      const db = JSON.parse(text);
      return {
        users: Array.isArray(db.users) ? db.users : [],
        sessions: Array.isArray(db.sessions) ? db.sessions : [],
        applications: Array.isArray(db.applications) ? db.applications : []
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return { users: [], sessions: [], applications: [] };
    }
  }

  async writeDb(db) {
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
      const tempPath = `${this.dbPath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tempPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
      await fs.rename(tempPath, this.dbPath);
    });
    return this.writeQueue;
  }

  async register({ username, password, displayName }) {
    const normalizedUsername = normalizeUsername(username);
    if (normalizedUsername.length < 3) {
      throw new Error("Username must contain at least 3 characters.");
    }
    if (String(password ?? "").length < 6) {
      throw new Error("Password must contain at least 6 characters.");
    }

    const db = await this.readDb();
    if (db.users.some((user) => user.username === normalizedUsername)) {
      throw new Error("Username already exists.");
    }

    const user = {
      id: createId(),
      username: normalizedUsername,
      displayName: String(displayName || username).trim() || normalizedUsername,
      password: hashPassword(password),
      profile: null,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    await this.writeDb(db);
    return publicUser(user);
  }

  async login({ username, password }) {
    const db = await this.readDb();
    const user = db.users.find((entry) => entry.username === normalizeUsername(username));
    if (!user || !verifyPassword(password, user.password)) {
      throw new Error("Invalid username or password.");
    }

    const session = {
      id: createId(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    };
    db.sessions.push(session);
    await this.writeDb(db);

    return { user: publicUser(user), session };
  }

  async getUserFromRequest(request) {
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    if (!sessionId) return null;

    const db = await this.readDb();
    const session = db.sessions.find((entry) => entry.id === sessionId);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
    const user = db.users.find((entry) => entry.id === session.userId);
    return user ? publicUser(user) : null;
  }

  async logout(request) {
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    if (!sessionId) return;

    const db = await this.readDb();
    db.sessions = db.sessions.filter((session) => session.id !== sessionId);
    await this.writeDb(db);
  }

  sessionCookie(session) {
    return `${SESSION_COOKIE}=${encodeURIComponent(session.id)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  }

  clearSessionCookie() {
    return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  }

  async saveProfile(userId, profile) {
    const db = await this.readDb();
    const user = db.users.find((entry) => entry.id === userId);
    if (!user) throw new Error("User was not found.");
    user.profile = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    await this.writeDb(db);
    return publicUser(user);
  }

  async listApplications(userId) {
    const db = await this.readDb();
    return db.applications
      .filter((item) => item.userId === userId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async saveApplication(userId, item) {
    const db = await this.readDb();
    const now = new Date().toISOString();
    const application = {
      id: String(item.id || createId()),
      userId,
      company: String(item.company || ""),
      role: String(item.role || item.position || ""),
      category: String(item.category || ""),
      fitPercent: item.fitPercent ?? item.matchPercent ?? "",
      priority: String(item.priority || ""),
      status: String(item.status || "Saved"),
      source: String(item.source || item.appliedVia || "Manual"),
      location: String(item.location || ""),
      workModel: String(item.workModel || ""),
      mainFit: String(item.mainFit || ""),
      mainGap: String(item.mainGap || ""),
      recommendedAction: String(item.recommendedAction || ""),
      notes: String(item.notes || item.nextStep || ""),
      documents: Array.isArray(item.documents) ? item.documents.map((document) => ({
        id: String(document.id || createId()),
        name: String(document.name || "Document"),
        type: String(document.type || ""),
        size: Number(document.size || 0),
        uploadedAt: String(document.uploadedAt || now)
      })) : [],
      applyUrl: String(item.applyUrl || ""),
      addedAt: String(item.addedAt || now),
      updatedAt: now
    };

    const existingIndex = db.applications.findIndex((entry) => entry.userId === userId && entry.id === application.id);
    if (existingIndex >= 0) {
      db.applications[existingIndex] = {
        ...db.applications[existingIndex],
        ...application,
        addedAt: db.applications[existingIndex].addedAt || application.addedAt
      };
    } else {
      db.applications.push(application);
    }

    await this.writeDb(db);
    return application;
  }

  async deleteApplication(userId, id) {
    const db = await this.readDb();
    db.applications = db.applications.filter((item) => !(item.userId === userId && item.id === id));
    await this.writeDb(db);
  }
}
