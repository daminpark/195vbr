function toggleMenu() {
  var navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    navLinks.classList.toggle('open');
  }
}

// Close the mobile menu after clicking a link (for better UX on one-page nav)
document.querySelectorAll('.nav-links a').forEach(function(link) {
  link.addEventListener('click', function() {
    var navLinks = document.querySelector('.nav-links');
    if (navLinks) {
      navLinks.classList.remove('open');
    }
  });
});
