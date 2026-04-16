document.addEventListener("DOMContentLoaded", () => {
    // Back to top functionality
    const backToTopBtn = document.querySelector(".foot-panel1");
    if (backToTopBtn) {
        backToTopBtn.addEventListener("click", () => {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        });
    }
});
