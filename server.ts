import express from "express";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from "vite";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

let firebaseConfig: any = {};
try {
  const configRaw = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8');
  firebaseConfig = JSON.parse(configRaw);
} catch(e) {
  console.error("Failed to load firebase config", e);
}

const firebaseApp = initializeApp(firebaseConfig);
const dbStore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const DB_DOC_REF = doc(dbStore, "db", "main");

// Default DB state with one Admin user
const DEFAULT_DB = {
  users: [
    { id: "admin", username: "admin", password: "password123", role: "admin" }
  ],
  tickets: [],
  products: ["Laptop", "Monitor", "Keyboard", "Mouse", "Docking Station", "Desk", "Chair"],
  customers: ["Acme Corp", "Tech Solutions Inc", "Global Industries"],
  vendors: ["Supra Supplies", "ElectroMart", "FastDelivery"]
};

// Helper to read DB
async function readDB() {
  try {
    const dbSnap = await getDoc(DB_DOC_REF);
    if (!dbSnap.exists()) {
      await setDoc(DB_DOC_REF, DEFAULT_DB);
      return DEFAULT_DB;
    }
    const parsedData = dbSnap.data();
    if (!parsedData.customers) parsedData.customers = [];
    if (!parsedData.vendors) parsedData.vendors = [];
    return parsedData;
  } catch (error) {
    console.error("Firebase read error", error);
    return DEFAULT_DB;
  }
}

// Helper to write DB
async function writeDB(data: any) {
  try {
    await setDoc(DB_DOC_REF, data);
  } catch (error) {
    console.error("Firebase write error", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ====== API ROUTES ======

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt for username: "${username}"`);
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const db = await readDB();
    const cleanUsername = username.trim().toLowerCase();
    const user = db.users.find((u: any) => u.username.trim().toLowerCase() === cleanUsername);
    
    if (!user) {
      console.log(`Login failed: User "${cleanUsername}" not found in database. Existing users: ${db.users.map((u: any) => u.username).join(', ')}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.password !== password) {
      console.log(`Login failed: Password mismatch for user "${cleanUsername}"`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    console.log(`Login successful for: ${user.username} (${user.role})`);
    res.json({ user: { id: user.id, username: user.username.trim(), role: user.role } });
  });

  // Admin: Get all employees
  app.get("/api/users", async (req, res) => {
    const db = await readDB();
    const employees = db.users.filter((u: any) => u.role === "employee").map((u: any) => ({
      id: u.id,
      username: u.username.trim(),
      password: u.password
    }));
    res.json(employees);
  });

  // Admin: Create employee
  app.post("/api/users", async (req, res) => {
    const { username, password } = req.body;
    const db = await readDB();
    const cleanUsername = username.trim();
    if (db.users.some((u: any) => u.username.trim() === cleanUsername)) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const newUser = { id: uuidv4(), username: cleanUsername, password, role: "employee" };
    db.users.push(newUser);
    await writeDB(db);
    res.json({ user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  });

  // Admin: Update employee
  app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;
    const db = await readDB();
    
    const userIndex = db.users.findIndex((u: any) => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    if (username) {
      const cleanUsername = username.trim();
      // Check if another user has this username
      if (db.users.some((u: any) => u.username.trim() === cleanUsername && u.id !== id)) {
        return res.status(400).json({ error: "Username already exists" });
      }
      db.users[userIndex].username = cleanUsername;
    }
    
    if (password) {
      db.users[userIndex].password = password;
    }

    await writeDB(db);
    res.json({ user: { id: db.users[userIndex].id, username: db.users[userIndex].username, role: db.users[userIndex].role } });
  });

  // Admin: Delete employee
  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const db = await readDB();
    
    if (id === 'admin') {
      return res.status(400).json({ error: "Cannot delete admin user" });
    }

    db.users = db.users.filter((u: any) => u.id !== id);
    await writeDB(db);
    res.json({ success: true });
  });

  // Tickets: Get all tickets (Admin)
  app.get("/api/tickets", async (req, res) => {
    const db = await readDB();
    res.json(db.tickets);
  });

  // Tickets: Create ticket
  app.post("/api/tickets", async (req, res) => {
    const ticket = req.body;
    const db = await readDB();
    
    // Add any new custom products or vendors to global specific lists
    ticket.items.forEach((item: any) => {
      if (item.productName && !db.products.includes(item.productName)) {
        db.products.push(item.productName);
      }
      if (item.vendorName && !db.vendors.includes(item.vendorName)) {
        db.vendors.push(item.vendorName);
      }
    });

    if (ticket.customerName && !db.customers.includes(ticket.customerName)) {
      db.customers.push(ticket.customerName);
    }

    const newTicket = { ...ticket, id: uuidv4() };
    db.tickets.push(newTicket);
    await writeDB(db);
    res.json(newTicket);
  });

  // Products: Get list for autocomplete
  app.get("/api/products", async (req, res) => {
    const db = await readDB();
    res.json(db.products);
  });

  // Products: Add new product directly
  app.post("/api/products", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Valid product name is required" });
    }
    const cleanName = name.trim();
    const db = await readDB();
    
    // Case-insensitive check to avoid duplicates
    if (!db.products.some((p: string) => p.toLowerCase() === cleanName.toLowerCase())) {
      db.products.push(cleanName);
      await writeDB(db);
    }
    res.json({ product: cleanName });
  });

  // Customers: Get list for autocomplete
  app.get("/api/customers", async (req, res) => {
    const db = await readDB();
    res.json(db.customers);
  });

  // Customers: Add new customer directly
  app.post("/api/customers", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Valid customer name is required" });
    }
    const cleanName = name.trim();
    const db = await readDB();
    
    // Case-insensitive check to avoid duplicates
    if (!db.customers.some((c: string) => c.toLowerCase() === cleanName.toLowerCase())) {
      db.customers.push(cleanName);
      await writeDB(db);
    }
    res.json({ customer: cleanName });
  });

  // Vendors: Get list for autocomplete
  app.get("/api/vendors", async (req, res) => {
    const db = await readDB();
    res.json(db.vendors);
  });

  // Vendors: Add new vendor directly
  app.post("/api/vendors", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Valid vendor name is required" });
    }
    const cleanName = name.trim();
    const db = await readDB();
    
    // Case-insensitive check to avoid duplicates
    if (!db.vendors.some((v: string) => v.toLowerCase() === cleanName.toLowerCase())) {
      db.vendors.push(cleanName);
      await writeDB(db);
    }
    res.json({ vendor: cleanName });
  });

  // ====== VITE MIDDLEWARE ======
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
