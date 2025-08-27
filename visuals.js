import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js';

(function(){
  const canvas = document.getElementById('bg');
  if (!canvas) return;

  const scene  = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 4, 10);

  // Neon grid plane (wireframe)
  const gridGeom = new THREE.PlaneGeometry(100, 100, 40, 40);
  const gridMat  = new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.25 });
  const grid     = new THREE.Mesh(gridGeom, gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -2.2;
  scene.add(grid);

  // Glowy horizon lines using GridHelper
  const gh = new THREE.GridHelper(70, 30, 0x00e5ff, 0x00e5ff);
  gh.material.opacity = 0.12; gh.material.transparent = true;
  scene.add(gh);

  // Foggy depth for vibe
  scene.fog = new THREE.FogExp2(0x02010a, 0.08);

  const clock = new THREE.Clock();
  const mouse = { x: 0, y: 0 };

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function animate() {
    const t = clock.getElapsedTime();
    // Subtle camera drift + parallax
    camera.position.x = Math.sin(t * 0.2) * 0.6 + mouse.x * 0.4;
    camera.position.z = 10 + Math.cos(t * 0.1) * 0.4 + mouse.y * 0.3;
    camera.lookAt(0, -1, 0);
    // Slight grid pulse
    grid.material.opacity = 0.22 + Math.sin(t * 2.0) * 0.03;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ==========================================
 * SVG Neon Connectors + Moving Packets
 * ======================================== */
(function(){
  const svg = document.getElementById('conn-svg');
  const nodesSvg = document.getElementById('conn-nodes');
  if (!svg || !nodesSvg) return;

  const sparksCanvas = document.getElementById('sparks-canvas');
  const sctx = sparksCanvas ? sparksCanvas.getContext('2d') : null;
  let DPR = 1;
  function sizeSparksCanvas(){
    if (!sparksCanvas || !sctx) return;
    DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = window.innerWidth, h = window.innerHeight;
    sparksCanvas.width = Math.round(w * DPR);
    sparksCanvas.height = Math.round(h * DPR);
    sparksCanvas.style.width = w + 'px';
    sparksCanvas.style.height = h + 'px';
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sctx.clearRect(0, 0, w, h);
  }

  const pairs = [
    ['#hero', '#education .glass'],
    ['#hero', '#skills-top'],
    ['#skills-top', '#skills-lang'],
    ['#skills-top', '#skills-web'],
    ['#skills-top', '#skills-ds'],
    ['#skills-top', '#skills-bi'],
    ['#skills-top', '#skills-cloud'],
    ['#skills-top', '#skills-devops'],
    ['#skills', '#education .glass'],
    ['#skills', '#projects']
  ];

  let VW = window.innerWidth, VH = window.innerHeight;

  /** Persistent Pools **/
  let pathObjs = []; // { aSel, bSel, path, nodes:[{el,t,speed}], packets:[{t,speed,rot,hue,history,max,shape,trail}] }
  const MAX_PACKETS = 10; // hard cap across all paths
  function totalPackets(){ return pathObjs.reduce((acc,o)=>acc + (o.packets?.length||0), 0); }

  // Free‑flying green sparks (Canvas-based, independent of paths)
  let sparks = []; // {x,y,vx,vy,hue,r}
  function greenHue(){ return 95 + Math.random()*30; } // neon green band

  // HSL to HEX kept intact above
  function hslToHex(h, s, l){
    s/=100; l/=100;
    const k = n => (n + h/30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n),1)));
    const toHex = x => Math.round(x*255).toString(16).padStart(2,'0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }

  function createPathObj(aSel, bSel, idx){
    const A = document.querySelector(aSel);
    const B = document.querySelector(bSel);
    if (!A || !B) return null;
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('class', `neon-path neon-dash ${idx%2?'alt':''}`);
    p.setAttribute('opacity','0.55');
    svg.appendChild(p);

    const obj = { aSel, bSel, path: p, nodes: [], packets: [], idx };

    // Spawn 1–2 moving nodes per path
    const count = 1; // performance: 1 node per path
    for (let k=0; k<count; k++){
      const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
      const r = 2.2 + Math.random()*2.0;
      c.setAttribute('r', r.toFixed(1));
      c.setAttribute('class', `neon-node ${idx%2?'alt':''}`);
      c.setAttribute('opacity', (0.55 + Math.random()*0.35).toFixed(2));
      nodesSvg.appendChild(c);
      obj.nodes.push({ el: c, t: Math.random(), speed: 0.05 + Math.random()*0.1 });
    }

    return obj;
  }

  function centerOf(el){ const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; }

  function curvePath(a, b, idx){
    const dx = b.x - a.x, dy = b.y - a.y; const arc = 0.24;
    const dir = Math.abs(dx) > 60 ? Math.sign(dx) : (idx % 2 ? 1 : -1);
    const cx = a.x + dx*0.5 - dy*arc*dir; const cy = a.y + dy*0.5 + dx*arc*dir;
    return `M ${a.x},${a.y} Q ${cx},${cy} ${b.x},${b.y}`;
  }

  function updateViewport(){
    const w = window.innerWidth, h = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    nodesSvg.setAttribute('viewBox', `0 0 ${w} ${h}`); nodesSvg.setAttribute('width', w); nodesSvg.setAttribute('height', h);
    VW = w; VH = h;
    if (sparksCanvas) { /* keep canvas logical size in sync (CSS handled in sizeSparksCanvas) */ }
  }

  function updatePaths(){
    // Recompute each path's geometry without destroying elements
    pathObjs.forEach(obj => {
      const A = document.querySelector(obj.aSel);
      const B = document.querySelector(obj.bSel);
      if (!A || !B) return; // keep old path if temporarily missing
      const a = centerOf(A), b = centerOf(B);
      const d = curvePath(a, b, obj.idx);
      obj.path.setAttribute('d', d);
      // cache total length once per geometry refresh
      try { obj.len = obj.path.getTotalLength(); } catch(e){ obj.len = 1; }
      // Build LUT once per path update (reduces per-frame cost)
      const N = 120;
      obj.lut = new Array(N);
      for (let i=0;i<N;i++){
        const pt = obj.path.getPointAtLength(obj.len * (i/(N-1)));
        obj.lut[i] = { x: pt.x, y: pt.y };
      }
    });
  }
  function pointOn(obj, t){
    if (!obj.lut || obj.lut.length === 0){
      const L = obj.len || 1; const pt = obj.path.getPointAtLength(L * t); return { x: pt.x, y: pt.y };
    }
    const N = obj.lut.length; const i = Math.min(N-1, Math.max(0, Math.floor(t * (N-1))));
    return obj.lut[i];
  }

  function spawnPacket(obj){
    if (totalPackets() >= MAX_PACKETS) return;
    const trail = document.createElementNS('http://www.w3.org/2000/svg','polyline');
    trail.setAttribute('class','trail');
    // default visual attributes so trails are visible immediately
    const hue = Math.floor(Math.random()*360);
    trail.setAttribute('stroke', hslToHex(hue, 90, 60));
    trail.setAttribute('fill','none');
    trail.setAttribute('stroke-width','2.5');
    trail.setAttribute('stroke-linecap','round');
    trail.setAttribute('stroke-linejoin','round');
    trail.setAttribute('opacity','0.9');
    nodesSvg.appendChild(trail);

    const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    poly.setAttribute('points','0,-6 6,0 0,6 -6,0');
    poly.setAttribute('class','packet');
    poly.setAttribute('fill', hslToHex(hue, 90, 60));
    poly.setAttribute('opacity','0.95');
    poly.setAttribute('stroke','none');
    nodesSvg.appendChild(poly);

    // Seed the packet object (history will fill on first frame)
    obj.packets.push({ t: Math.random()*0.8, speed: 0.25 + Math.random()*0.25, rot: (Math.random()*2-1)*0.12, hue, history: [], max: 10, shape: poly, trail });
  }

  function spawnSpark(){
    const hue = greenHue();
    const x = Math.random() * VW, y = Math.random() * VH;
    const speed = 40 + Math.random() * 80; // px/sec
    const ang = Math.random() * Math.PI * 2;
    const vx = Math.cos(ang) * speed, vy = Math.sin(ang) * speed;
    const r = 1.6 + Math.random() * 1.6;
    sparks.push({ x, y, vx, vy, hue, r });
  }

  function init(){
    updateViewport();
    // Build once — do not clear on scroll
    pathObjs = [];
    pairs.forEach((pair, i) => {
      const obj = createPathObj(pair[0], pair[1], i);
      if (obj) pathObjs.push(obj);
    });
    // First geometry update
    updatePaths();
    pathObjs.forEach(o => { if (Math.random() < 0.20) spawnPacket(o); });
    // Seed free‑flying sparks
    for (let i=0;i<24;i++) spawnSpark();
  }

  let visToggle = false; // flip-flop to halve DOM writes
  let lastT = performance.now();
  let hidden = false;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
  function animate(now){
    const dt = Math.min(0.05, (now - lastT) / 1000); // clamp dt for stability
    lastT = now;
    if (hidden) { requestAnimationFrame(animate); return; }
    visToggle = !visToggle;

    // Move nodes along their current paths
    pathObjs.forEach(obj => {
      const L = obj.len || 1;
      obj.nodes.forEach(n => {
        n.t += n.speed * dt; if (n.t > 1) n.t -= 1;
        const pt = pointOn(obj, n.t);
        const nx = Math.round(pt.x*2)/2, ny = Math.round(pt.y*2)/2;
        if (visToggle) {
          if (n.el._cx !== nx) { n.el._cx = nx; n.el.setAttribute('cx', nx); }
          if (n.el._cy !== ny) { n.el._cy = ny; n.el.setAttribute('cy', ny); }
        }
      });

      // Packets with color-shifting trails
      obj.packets.forEach(p => {
        const Lp = L;
        p.t += p.speed * dt; if (p.t > 1){ p.t = 0; p.history.length = 0; }
        const pt = pointOn(obj, p.t);
        p.history.push([pt.x.toFixed(1), pt.y.toFixed(1)]);
        if (p.history.length > p.max) p.history.shift();
        // color shift every frame (math), apply visually on decimated frames
        p.hue = (p.hue + 72 * dt) % 360;
        if (visToggle) {
          const pts = p.history.map(q=>q.join(',')).join(' ');
          if (p._pts !== pts) { p._pts = pts; p.trail.setAttribute('points', pts); }
          const col = hslToHex(p.hue, 90, 60);
          if (p._col !== col) { p._col = col; p.trail.setAttribute('stroke', col); }
          const rotDeg = ((p.t*6.283) + p.rot) * 180 / Math.PI;
          const tf = `translate(${pt.x},${pt.y}) rotate(${rotDeg} 0 0)`;
          if (p._tf !== tf) { p._tf = tf; p.shape.setAttribute('transform', tf); }
        }
      });

      // Occasionally spawn extra packets (fireworks vibe)
      if (Math.random() < 0.01 && totalPackets() < MAX_PACKETS) spawnPacket(obj);
    });

    // Update free‑flying sparks (Canvas renderer — no per-element DOM writes)
    if (sctx) {
      // Persistence fade: darken slightly to keep motion trails
      sctx.save();
      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 0.10; // trail persistence
      sctx.fillStyle = 'rgba(0,0,0,1)';
      sctx.fillRect(0, 0, VW, VH);
      sctx.restore();

      // Integrate physics and draw
      const decay = 0.985; // mild friction for nicer curves
      sparks.forEach(s => {
        // integrate motion
        s.vx *= decay; s.vy *= decay;
        s.x += s.vx * dt; s.y += s.vy * dt;
        // slight wandering
        s.vx += (Math.random()-0.5) * 10 * dt;
        s.vy += (Math.random()-0.5) * 10 * dt;

        // wrap around edges
        if (s.x < -20) s.x = VW + 20; else if (s.x > VW + 20) s.x = -20;
        if (s.y < -20) s.y = VH + 20; else if (s.y > VH + 20) s.y = -20;

        // hue drift + draw
        s.hue = (s.hue + 24 * dt) % 360;
        const col = hslToHex(s.hue, 90, 60);
        sctx.beginPath();
        sctx.fillStyle = col;
        sctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        sctx.fill();
      });
    }

    requestAnimationFrame(animate);
  }

  // Throttled path updates on resize/scroll — no clearing, no re-seeding
  let ticking = false;
  function queueUpdate(){ if (!ticking){ ticking = true; requestAnimationFrame(() => { updateViewport(); updatePaths(); ticking = false; }); } }

  window.addEventListener('load', ()=>{ init(); sizeSparksCanvas(); requestAnimationFrame(animate); });
  window.addEventListener('resize', () => { sizeSparksCanvas(); queueUpdate(); }, { passive: true });
  window.addEventListener('scroll', queueUpdate, { passive: true });
})();
