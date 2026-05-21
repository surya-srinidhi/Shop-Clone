document.addEventListener("DOMContentLoaded", () => {
    // ==========================================================================
    // State Management
    // ==========================================================================
    let state = {
        user: null,
        products: [],
        cart: [],
        sessionId: getOrCreateSessionId(),
        currentSlide: 0,
        activeTab: "login"
    };

    const API_BASE = ""; // Relative paths since server serves static files

    // Helper: Session ID for guest cart
    function getOrCreateSessionId() {
        let sid = localStorage.getItem("amazon_clone_session_id");
        if (!sid) {
            sid = "session_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            localStorage.setItem("amazon_clone_session_id", sid);
        }
        return sid;
    }

    // Helper: Format currency
    function formatCurrency(val) {
        return parseFloat(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ==========================================================================
    // Initialization & Event Listeners
    // ==========================================================================
    async function init() {
        // Load user session from localStorage if exists
        const cachedUser = localStorage.getItem("amazon_clone_user");
        if (cachedUser) {
            state.user = JSON.parse(cachedUser);
            updateUserHeader();
        }

        // Fetch products and cart items
        await fetchProducts();
        await fetchCart();

        // Setup sliders, search, drawer, modal, and toasts
        setupHeroSlider();
        setupSearch();
        setupCartDrawer();
        setupAuthModal();
        setupBackToTop();
    }

    init();

    // ==========================================================================
    // API Requests
    // ==========================================================================

    // Fetch Products
    async function fetchProducts(query = "") {
        try {
            const url = query ? `${API_BASE}/api/products?q=${encodeURIComponent(query)}` : `${API_BASE}/api/products`;
            const res = await fetch(url);
            state.products = await res.json();
            renderProducts();
        } catch (error) {
            console.error("Error fetching products:", error);
            showToast("Failed to fetch products. Is the server running?");
        }
    }

    // Fetch Cart Items
    async function fetchCart() {
        try {
            const userId = state.user ? state.user.id : null;
            const res = await fetch(`${API_BASE}/api/cart?userId=${userId}&sessionId=${state.sessionId}`);
            state.cart = await res.json();
            updateCartBadge();
            renderCartDrawer();
        } catch (error) {
            console.error("Error fetching cart:", error);
        }
    }

    // Add to Cart
    async function addToCart(productId) {
        try {
            const userId = state.user ? state.user.id : null;
            const res = await fetch(`${API_BASE}/api/cart`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    sessionId: state.sessionId,
                    productId,
                    quantity: 1
                })
            });
            const data = await res.json();
            
            // Re-fetch cart and notify user
            await fetchCart();
            
            const product = state.products.find(p => p.id === productId);
            const title = product ? product.title : "Product";
            showToast(`<i class="fa-solid fa-circle-check"></i> Added ${title} to cart!`);
            
            // Pop badge effect
            const badge = document.getElementById("cart-badge");
            badge.classList.add("pop");
            setTimeout(() => badge.classList.remove("pop"), 300);

        } catch (error) {
            console.error("Error adding to cart:", error);
            showToast("Failed to add item to cart.");
        }
    }

    // Update Quantity
    async function updateCartQuantity(itemId, newQty) {
        try {
            const res = await fetch(`${API_BASE}/api/cart/${itemId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quantity: newQty })
            });
            await fetchCart();
        } catch (error) {
            console.error("Error updating cart quantity:", error);
        }
    }

    // Remove from Cart
    async function removeFromCart(itemId) {
        try {
            const res = await fetch(`${API_BASE}/api/cart/${itemId}`, {
                method: "DELETE"
            });
            await fetchCart();
            showToast("Removed item from cart.");
        } catch (error) {
            console.error("Error deleting cart item:", error);
        }
    }

    // ==========================================================================
    // Render Functions
    // ==========================================================================

    // Render Product Cards
    function renderProducts() {
        const grid = document.getElementById("products-grid");
        if (!grid) return;

        if (state.products.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 15px; color: #ccc;"></i>
                    <h3>No products found matching your search.</h3>
                    <p>Try searching for clothes, electronics, or books.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = state.products.map(product => {
            // Render stars
            const fullStars = Math.floor(product.rating);
            const hasHalfStar = product.rating % 1 !== 0;
            let starsHTML = "";
            for (let i = 1; i <= 5; i++) {
                if (i <= fullStars) {
                    starsHTML += '<i class="fa-solid fa-star"></i>';
                } else if (i === fullStars + 1 && hasHalfStar) {
                    starsHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
                } else {
                    starsHTML += '<i class="fa-regular fa-star"></i>';
                }
            }

            // Pricing details
            const originalPriceHTML = product.original_price 
                ? `<span class="original-price">₹${formatCurrency(product.original_price)}</span>` 
                : "";
            
            const discountBadgeHTML = product.original_price
                ? `<span class="discount-badge">-${Math.round((1 - (product.price / product.original_price)) * 100)}%</span>`
                : "";

            return `
                <div class="box" data-id="${product.id}">
                    <div class="box-content">
                        <h2>${product.title}</h2>
                        <div class="box-img" style="background-image: url('${product.image}');"></div>
                        <div class="box-rating">
                            <span class="stars">${starsHTML}</span>
                            <span class="rating-count">(${product.rating_count})</span>
                        </div>
                        <div class="box-price-container">
                            <span class="box-price">${formatCurrency(product.price)}</span>
                            ${originalPriceHTML}
                            ${discountBadgeHTML}
                        </div>
                        <div class="box-action-container">
                            <a class="box-view-details">See Details</a>
                            <button class="add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        // Attach listeners to new "Add to Cart" buttons
        grid.querySelectorAll(".add-to-cart-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.target.dataset.productId);
                addToCart(id);
            });
        });
    }

    // Update Cart Badge Count
    function updateCartBadge() {
        const badge = document.getElementById("cart-badge");
        const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (badge) {
            badge.innerText = count;
        }
        const drawerCount = document.getElementById("drawer-cart-count");
        if (drawerCount) {
            drawerCount.innerText = count;
        }
    }

    // Render Side Cart Drawer
    function renderCartDrawer() {
        const content = document.getElementById("cart-drawer-content");
        const totalPriceEl = document.getElementById("cart-subtotal-price");
        if (!content || !totalPriceEl) return;

        if (state.cart.length === 0) {
            content.innerHTML = `
                <div class="empty-cart-msg">
                    <i class="fa-solid fa-cart-flatbed-suitcases"></i>
                    <p>Your shopping cart is currently empty.</p>
                </div>
            `;
            totalPriceEl.innerText = "₹0.00";
            return;
        }

        content.innerHTML = state.cart.map(item => `
            <div class="cart-item" data-item-id="${item.id}">
                <div class="cart-item-img" style="background-image: url('${item.image}');"></div>
                <div class="cart-item-info">
                    <h4>${item.title}</h4>
                    <div class="cart-item-price">₹${formatCurrency(item.price * item.quantity)}</div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn dec-qty" data-item-id="${item.id}" data-qty="${item.quantity}">-</button>
                        <span class="cart-item-qty">${item.quantity}</span>
                        <button class="quantity-btn inc-qty" data-item-id="${item.id}" data-qty="${item.quantity}">+</button>
                        <button class="delete-item-btn" data-item-id="${item.id}"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </div>
            </div>
        `).join("");

        // Calculate Subtotal
        const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalPriceEl.innerText = `₹${formatCurrency(total)}`;

        // Hook controls listeners
        content.querySelectorAll(".dec-qty").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const itemId = parseInt(e.target.dataset.itemId);
                const currentQty = parseInt(e.target.dataset.qty);
                updateCartQuantity(itemId, currentQty - 1);
            });
        });

        content.querySelectorAll(".inc-qty").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const itemId = parseInt(e.target.dataset.itemId);
                const currentQty = parseInt(e.target.dataset.qty);
                updateCartQuantity(itemId, currentQty + 1);
            });
        });

        content.querySelectorAll(".delete-item-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const button = e.target.closest("button");
                const itemId = parseInt(button.dataset.itemId);
                removeFromCart(itemId);
            });
        });
    }

    // ==========================================================================
    // Interactive Layout Components (Slider, Drawer, Modal, Search)
    // ==========================================================================

    // Hero Section Image Slider Carousel
    function setupHeroSlider() {
        const slides = document.querySelectorAll(".slide");
        const prev = document.getElementById("prev-slide");
        const next = document.getElementById("next-slide");
        if (slides.length === 0) return;

        function showSlide(index) {
            slides[state.currentSlide].classList.remove("active");
            state.currentSlide = (index + slides.length) % slides.length;
            slides[state.currentSlide].classList.add("active");
        }

        prev?.addEventListener("click", () => showSlide(state.currentSlide - 1));
        next?.addEventListener("click", () => showSlide(state.currentSlide + 1));

        // Auto slide change every 5 seconds
        setInterval(() => {
            showSlide(state.currentSlide + 1);
        }, 6000);
    }

    // Search input hooking
    function setupSearch() {
        const searchInput = document.getElementById("search-input");
        const searchBtn = document.getElementById("search-btn");

        if (!searchInput) return;

        // Keyup filtering with debounce fallback
        let debounceTimer;
        searchInput.addEventListener("keyup", (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchProducts(searchInput.value.trim());
            }, 300);
        });

        searchBtn?.addEventListener("click", () => {
            fetchProducts(searchInput.value.trim());
        });
    }

    // Cart Drawer sliding sidepanel
    function setupCartDrawer() {
        const navCart = document.getElementById("nav-cart");
        const cartDrawer = document.getElementById("cart-drawer");
        const overlay = document.getElementById("drawer-overlay");
        const closeBtn = document.getElementById("close-drawer-btn");
        const checkoutBtn = document.getElementById("checkout-btn");

        if (!navCart || !cartDrawer || !overlay) return;

        function openDrawer() {
            cartDrawer.classList.add("open");
            overlay.classList.add("active");
        }

        function closeDrawer() {
            cartDrawer.classList.remove("open");
            overlay.classList.remove("active");
        }

        navCart.addEventListener("click", openDrawer);
        closeBtn?.addEventListener("click", closeDrawer);
        overlay.addEventListener("click", closeDrawer);

        checkoutBtn?.addEventListener("click", () => {
            if (state.cart.length === 0) return;
            showToast("<i class='fa-solid fa-circle-check'></i> Order Placed Successfully!");
            
            // Clear cart
            state.cart = [];
            updateCartBadge();
            renderCartDrawer();
            closeDrawer();
        });
    }

    // Account login authentication overlays
    function setupAuthModal() {
        const navSignin = document.getElementById("nav-signin");
        const authModal = document.getElementById("auth-modal");
        const closeBtn = document.getElementById("close-auth-btn");
        const tabLogin = document.getElementById("tab-login");
        const tabRegister = document.getElementById("tab-register");
        const loginForm = document.getElementById("login-form");
        const registerForm = document.getElementById("register-form");

        if (!navSignin || !authModal || !closeBtn) return;

        function openModal() {
            if (state.user) {
                // If clicked while logged in, trigger LOG OUT
                logoutUser();
                return;
            }
            authModal.classList.add("open");
        }

        function closeModal() {
            authModal.classList.remove("open");
        }

        navSignin.addEventListener("click", openModal);
        closeBtn.addEventListener("click", closeModal);

        // Tab Switching
        tabLogin?.addEventListener("click", () => {
            tabLogin.classList.add("active");
            tabRegister?.classList.remove("active");
            loginForm?.classList.add("active");
            registerForm?.classList.remove("active");
            state.activeTab = "login";
        });

        tabRegister?.addEventListener("click", () => {
            tabRegister.classList.add("active");
            tabLogin?.classList.remove("active");
            registerForm?.classList.add("active");
            loginForm?.classList.remove("active");
            state.activeTab = "register";
        });

        // Submit Forms
        loginForm?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;

            try {
                const res = await fetch(`${API_BASE}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, sessionId: state.sessionId })
                });

                const data = await res.json();
                if (res.ok) {
                    loginUser(data.user);
                    closeModal();
                    loginForm.reset();
                } else {
                    showToast(data.error || "Login failed");
                }
            } catch (error) {
                console.error("Login Error:", error);
                showToast("Server error during login.");
            }
        });

        registerForm?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("register-name").value;
            const email = document.getElementById("register-email").value;
            const password = document.getElementById("register-password").value;

            try {
                const res = await fetch(`${API_BASE}/api/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await res.json();
                if (res.ok) {
                    showToast("Registration successful! Logging you in...");
                    // Directly log in
                    loginUser(data.user);
                    closeModal();
                    registerForm.reset();
                } else {
                    showToast(data.error || "Registration failed");
                }
            } catch (error) {
                console.error("Registration Error:", error);
                showToast("Server error during registration.");
            }
        });
    }

    // Authenticate user state
    function loginUser(userData) {
        state.user = userData;
        localStorage.setItem("amazon_clone_user", JSON.stringify(userData));
        updateUserHeader();
        fetchCart(); // Load and sync user cart items
        showToast(`<i class="fa-solid fa-face-smile"></i> Welcome back, ${userData.name}!`);
    }

    // Log out user
    function logoutUser() {
        showToast("Signed out successfully.");
        state.user = null;
        localStorage.removeItem("amazon_clone_user");
        updateUserHeader();
        fetchCart(); // Reload guest session cart items
    }

    // Update greeting name in top bar
    function updateUserHeader() {
        const greeting = document.getElementById("user-greeting");
        const parent = document.getElementById("nav-signin");
        if (greeting) {
            greeting.innerText = state.user ? `Hello, ${state.user.name.split(" ")[0]}` : "Hello, sign in";
        }
        if (parent) {
            parent.title = state.user ? "Click to Sign Out" : "Click to Sign In";
        }
    }

    // Back to top scroll button
    function setupBackToTop() {
        const backToTopBtn = document.querySelector(".foot-panel1");
        if (backToTopBtn) {
            backToTopBtn.addEventListener("click", () => {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            });
        }
    }

    // ==========================================================================
    // Dynamic Status Toasts
    // ==========================================================================
    function showToast(message) {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = message;
        
        container.appendChild(toast);

        // Slide out and remove toast after 3.5 seconds
        setTimeout(() => {
            toast.classList.add("removing");
            toast.addEventListener("transitionend", () => {
                toast.remove();
            });
        }, 3500);
    }
});
