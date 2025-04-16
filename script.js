/* ---------------------------------------------------
   BASE
--------------------------------------------------- */
html,body{margin:0;padding:0;font-family:Arial,sans-serif;background:#fff;color:#333;}
.container{max-width:800px;margin:0 auto;padding:1em;}
section,h2{scroll-margin-top:80px;}   /* avoids overlap with fixed headers */
.variation{display:none;}             /* default hidden spans */

/* Optional logo header -------------------------------------------- */
.site-header{display:flex;justify-content:center;padding:.5em;}
.logo{height:40px;width:auto;}

/* ---------------------------------------------------
   PROFESSIONAL ACCORDION
--------------------------------------------------- */
section{border-bottom:1px solid #e0e0e0;padding:.5rem 0;}

.accordion-header{
  cursor:pointer;position:relative;user-select:none;margin:0;padding-right:2rem;
}
/* Chevron (CSS‑drawn) */
.accordion-header::after{
  content:'';position:absolute;top:50%;right:.5rem;width:.6rem;height:.6rem;
  border-right:2px solid currentColor;border-bottom:2px solid currentColor;
  transform:translateY(-50%) rotate(45deg);          /* ► */
  transition:transform .25s ease;
}
/* Rotated when open */
section:not(.collapsed) .accordion-header::after{
  transform:translateY(-50%) rotate(135deg);         /* ▼ */
}

/* Content wrapper */
.accordion-content{display:none;padding:.5rem 0 0 0;}
section:not(.collapsed) .accordion-content{
  display:block;animation:fade .25s ease-in;
}

/* Fade‑in */
@keyframes fade{from{opacity:0;}to{opacity:1;}}
