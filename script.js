// Toggle Mobile Menu
function toggleMobileMenu() {
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav.classList.contains('open')) {
    mobileNav.classList.remove('open');
  } else {
    mobileNav.classList.add('open');
  }
}

// Close Mobile Menu after clicking a link
function closeMobileMenu() {
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav.classList.contains('open')) {
    mobileNav.classList.remove('open');
  }
}
