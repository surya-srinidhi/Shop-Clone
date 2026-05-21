require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MySQL Database Connection & Initialization
let pool;

async function initDB() {
  try {
    // 1. Connect without a specific database first, to ensure database exists
    const setupConnection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "surya12@",
    });

    console.log("Connected to MySQL server. Setting up database...");
    await setupConnection.query("CREATE DATABASE IF NOT EXISTS amazon_clone");
    await setupConnection.end();

    // 2. Establish connection pool with the database
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "surya12@",
      database: process.env.DB_NAME || "amazon_clone",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log("Connected to database pool. Initializing tables...");

    // 3. Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        image VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        original_price DECIMAL(10, 2) NULL,
        rating DECIMAL(2, 1) DEFAULT 4.0,
        rating_count INT DEFAULT 120
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        session_id VARCHAR(255) NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 4. Seed initial products if none exist
    const [products] = await pool.query("SELECT COUNT(*) as count FROM products");
    if (products[0].count === 0) {
      console.log("Seeding products...");
      const seedQuery = `
        INSERT INTO products (title, image, category, price, original_price, rating, rating_count) VALUES
        ('Health & Personal Care', 'box1_image.png', 'Health', 499.00, 650.00, 4.6, 1250),
        ('Clothes & Apparel', 'box2_image.png', 'Clothes', 999.00, 1499.00, 4.2, 843),
        ('Furniture & Home Decor', 'box3_image.png', 'Furniture', 4999.00, 7999.00, 4.8, 310),
        ('Electronics & Gadgets', 'box4_image.png', 'Electronics', 14999.00, 19999.00, 4.7, 4520),
        ('Beauty Picks & Cosmetics', 'box5_image.png', 'Beauty', 399.00, 499.00, 4.5, 912),
        ('Books & Study Materials', 'box6_image.png', 'Books', 299.00, 399.00, 4.4, 230),
        ('Toys & Games for Kids', 'box7_image.png', 'Toys', 599.00, 799.00, 4.3, 142),
        ('Women\\'s Shoes & Styling', 'box8_image.png', 'Shoes', 1999.00, 2999.00, 4.5, 680)
      `;
      await pool.query(seedQuery);
      console.log("Product seeding completed!");
    }

    console.log("Database and tables initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
}

// REST API Endpoints

// 1. Get Products (Search and Filters)
app.get("/api/products", async (req, res) => {
  try {
    const { q } = req.query;
    if (q) {
      const searchQuery = `%${q}%`;
      const [rows] = await pool.query(
        "SELECT * FROM products WHERE title LIKE ? OR category LIKE ? ORDER BY id ASC",
        [searchQuery, searchQuery]
      );
      return res.json(rows);
    }
    const [rows] = await pool.query("SELECT * FROM products ORDER BY id ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// 2. Get Cart Items
app.get("/api/cart", async (req, res) => {
  try {
    const { userId, sessionId } = req.query;
    let rows;
    if (userId && userId !== "null") {
      [rows] = await pool.query(
        `SELECT c.id, c.product_id, c.quantity, p.title, p.price, p.image, p.category, p.rating 
         FROM cart_items c 
         JOIN products p ON c.product_id = p.id 
         WHERE c.user_id = ?`,
        [userId]
      );
    } else {
      [rows] = await pool.query(
        `SELECT c.id, c.product_id, c.quantity, p.title, p.price, p.image, p.category, p.rating 
         FROM cart_items c 
         JOIN products p ON c.product_id = p.id 
         WHERE c.session_id = ? AND c.user_id IS NULL`,
        [sessionId]
      );
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cart items" });
  }
});

// 3. Add to Cart (or update quantity)
app.post("/api/cart", async (req, res) => {
  try {
    const { userId, sessionId, productId, quantity = 1 } = req.body;
    
    let existing;
    if (userId && userId !== "null") {
      [existing] = await pool.query(
        "SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?",
        [userId, productId]
      );
    } else {
      [existing] = await pool.query(
        "SELECT * FROM cart_items WHERE session_id = ? AND product_id = ? AND user_id IS NULL",
        [sessionId, productId]
      );
    }

    if (existing.length > 0) {
      // Update quantity
      const newQty = existing[0].quantity + parseInt(quantity);
      await pool.query("UPDATE cart_items SET quantity = ? WHERE id = ?", [newQty, existing[0].id]);
      res.json({ message: "Cart item quantity updated", itemId: existing[0].id, quantity: newQty });
    } else {
      // Insert new item
      const userVal = userId && userId !== "null" ? userId : null;
      const [result] = await pool.query(
        "INSERT INTO cart_items (user_id, session_id, product_id, quantity) VALUES (?, ?, ?, ?)",
        [userVal, sessionId, productId, quantity]
      );
      res.json({ message: "Item added to cart", itemId: result.insertId, quantity });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

// 4. Update Cart Item Quantity
app.put("/api/cart/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    if (quantity <= 0) {
      await pool.query("DELETE FROM cart_items WHERE id = ?", [id]);
      return res.json({ message: "Cart item deleted" });
    }
    await pool.query("UPDATE cart_items SET quantity = ? WHERE id = ?", [quantity, id]);
    res.json({ message: "Cart item quantity updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update quantity" });
  }
});

// 5. Delete Cart Item
app.delete("/api/cart/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM cart_items WHERE id = ?", [id]);
    res.json({ message: "Cart item deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete cart item" });
  }
});

// 6. User Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user exists
    const [existing] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // Insert user (plain text for simplicity in this demo, but real-world would use hashing)
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, password]
    );

    res.json({
      message: "Registration successful!",
      user: { id: result.insertId, name, email }
    });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// 7. User Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = users[0];
    if (user.password !== password) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // Connect user guest cart items to their user account
    const { sessionId } = req.body;
    if (sessionId) {
      // Fetch user's existing cart
      const [userCart] = await pool.query("SELECT * FROM cart_items WHERE user_id = ?", [user.id]);
      const [guestCart] = await pool.query("SELECT * FROM cart_items WHERE session_id = ? AND user_id IS NULL", [sessionId]);
      
      for (const guestItem of guestCart) {
        const dup = userCart.find(i => i.product_id === guestItem.product_id);
        if (dup) {
          // Add guest quantity to user quantity
          await pool.query("UPDATE cart_items SET quantity = quantity + ? WHERE id = ?", [guestItem.quantity, dup.id]);
          await pool.query("DELETE FROM cart_items WHERE id = ?", [guestItem.id]);
        } else {
          // Link guest item to user
          await pool.query("UPDATE cart_items SET user_id = ? WHERE id = ?", [user.id, guestItem.id]);
        }
      }
    }

    res.json({
      message: "Login successful!",
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Serve frontend fallback for any other routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start Server after DB setup
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
});
