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

document.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  // List of flag parameters to check for:
  const keys = ['193', '195', 'room1', 'room2', 'room3', 'room4', 'room5', 'room6', 'rooma', 'roomb', 'wholehome', 'sharedb', 'sharedk'];

  keys.forEach(key => {
    if (params.has(key)) {
      // Show all divs that have the corresponding class
      document.querySelectorAll('.variation-' + key).forEach(el => {
        el.style.display = 'inline';
      });
    }
  });
});
