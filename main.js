// Dynamic greeting
(function(){
  const hour = new Date().getHours();
  const g = document.getElementById('greeting');
  if (g) {
    const msg = hour < 12 ? 'Good morning!' : (hour < 18 ? 'Good afternoon!' : 'Good evening!');
    g.textContent = msg;
  }
})();

// FX canvases: DPR-aware sizing (no scroll-time resizing/clearing)
(function(){
  const lines = document.getElementById('fx-lines');
  const trails = document.getElementById('fx-trails');
  const glow = document.getElementById('fx-glow');
  if (!lines || !trails || !glow) return; // if not present, do nothing

  const ctxL = lines.getContext('2d');
  const ctxT = trails.getContext('2d');
  const ctxG = glow.getContext('2d');

  function dpr(){ return Math.max(1, Math.floor(window.devicePixelRatio || 1)); }

  function size(){
    const DPR = dpr();
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Style size (CSS pixels)
    [lines, trails, glow].forEach(c => {
      c.style.width = w + 'px';
      c.style.height = h + 'px';
    });
    // Backing store size (device pixels)
    [lines, trails, glow].forEach(c => { c.width = Math.round(w * DPR); c.height = Math.round(h * DPR); });
    // Logical units = CSS pixels
    [ctxL, ctxT, ctxG].forEach(ctx => ctx.setTransform(DPR, 0, 0, DPR, 0, 0));
    // Do not clear on scroll; we only clear explicitly in renderers if needed
  }

  window.addEventListener('load', size, { passive: true });
  window.addEventListener('resize', size, { passive: true });
  window.addEventListener('orientationchange', size, { passive: true });
  size();
})();

// 3D hologram gentle hover tilt
(function(){
  const wrap = document.getElementById('hero');
  const holo = document.getElementById('holo');
  if (!wrap || !holo) return;
  function tilt(e){
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    const rx = (-y * 10).toFixed(2), ry = (x * 14).toFixed(2);
    holo.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  }
  function reset(){ holo.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0)'; }
  wrap.addEventListener('mousemove', tilt);
  wrap.addEventListener('mouseleave', reset);
})();

// Fixed header: neon border + body offset for layout
(function(){
  const header = document.querySelector('header.sticky-header');
  if (!header) return;
  const setOffset = () => {
    const h = header.offsetHeight;
    document.body.style.paddingTop = h + 'px';
    document.documentElement.style.scrollPaddingTop = h + 'px';
  };
  const onScroll = () => {
    if (window.scrollY > 8) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  setOffset();
  window.addEventListener('load', setOffset);
  window.addEventListener('resize', setOffset);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();

// Education collapsible
(function(){
  const card = document.getElementById('edu-card');
  const panel = document.getElementById('edu-modules');
  const chev = document.getElementById('edu-chev');
  if (!card || !panel) return;
  function toggle(){
    const open = panel.classList.toggle('open');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    card.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (chev) chev.classList.toggle('open', open);
  }
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); toggle(); }});
})();

// Neon scroll‑spy: highlight nav link whose section is in view
(function(){
  const links = Array.from(document.querySelectorAll('header nav a.nav-link'));
  const sections = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  // Make first link active on load
  function setActive(hash){
    links.forEach(a => {
      const active = a.getAttribute('href') === hash;
      a.classList.toggle('active', active);
      if (active) { a.setAttribute('aria-current','page'); } else { a.removeAttribute('aria-current'); }
    });
  }

  // Observer highlights section centered in viewport
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = '#' + e.target.id;
        setActive(id);
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

  sections.forEach(sec => io.observe(sec));

  // Also set active on click for snappy feedback
  links.forEach(a => a.addEventListener('click', () => setActive(a.getAttribute('href'))));
})();

// Neon-frame scroll activation (adds a brief glow when cards enter view)
(function(){
  const frames = Array.from(document.querySelectorAll('.neon-frame'));
  if (!frames.length) return;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // respect user setting

  function pulse(el){
    el.classList.add('glow-on');
    clearTimeout(el._glowTimer);
    el._glowTimer = setTimeout(() => { el.classList.remove('glow-on'); el._glowTimer = null; }, 1200);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) pulse(e.target); });
  }, { rootMargin: '0px 0px -20% 0px', threshold: 0.35 });

  frames.forEach(el => io.observe(el));
  window.addEventListener('pagehide', () => io.disconnect());
})();
