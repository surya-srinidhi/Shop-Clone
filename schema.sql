-- Database schema for Amazon Clone
CREATE DATABASE IF NOT EXISTS amazon_clone;
USE amazon_clone;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    original_price DECIMAL(10, 2) NULL,
    rating DECIMAL(2, 1) DEFAULT 4.0,
    rating_count INT DEFAULT 120
);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL, -- NULL allows for guest carts
    session_id VARCHAR(255) NOT NULL, -- To track guest carts
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed Products
INSERT INTO products (title, image, category, price, original_price, rating, rating_count) VALUES
('Health & Personal Care', 'box1_image.png', 'Health', 499.00, 650.00, 4.6, 1250),
('Clothes & Apparel', 'box2_image.png', 'Clothes', 999.00, 1499.00, 4.2, 843),
('Furniture & Home Decor', 'box3_image.png', 'Furniture', 4999.00, 7999.00, 4.8, 310),
('Electronics & Gadgets', 'box4_image.png', 'Electronics', 14999.00, 19999.00, 4.7, 4520),
('Beauty Picks & Cosmetics', 'box5_image.png', 'Beauty', 399.00, 499.00, 4.5, 912),
('Books & Study Materials', 'box6_image.png', 'Books', 299.00, 399.00, 4.4, 230),
('Toys & Games for Kids', 'box7_image.png', 'Toys', 599.00, 799.00, 4.3, 142),
('Women\'s Shoes & Styling', 'box8_image.png', 'Shoes', 1999.00, 2999.00, 4.5, 680)
ON DUPLICATE KEY UPDATE id=id;
