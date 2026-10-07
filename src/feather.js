// Original Warbler feather; audio levels come from the existing voice session.
// This renderer never opens a second microphone stream.
export function createFeather(canvas, getState, getVolume) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, visible = true, dirty = true;
  let energy = 0, gather = 0, opacity = 1, previous = 0, frame = 0, lastState;
  const resize = new ResizeObserver(() => {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    dirty = true;
  });
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; dirty = true; });
  resize.observe(canvas); observer.observe(canvas);

  function draw(ms) {
    frame = requestAnimationFrame(draw);
    const t = ms / 1000;
    const dt = previous ? Math.min(.1, t - previous) : .016;
    previous = t;
    if (!visible || document.hidden || !width || !height) return;
    const state = getState();
    if (state !== lastState) { dirty = true; lastState = state; }
    if (reduced.matches && !dirty) return;
    dirty = false;
    const animated = !reduced.matches;
    const time = animated ? t : 0;
    const level = ['listening', 'speaking'].includes(state) ? getVolume(state) : 0;
    const target = Number.isFinite(level) ? Math.max(0, Math.min(1, level * 2.5)) : 0;
    energy += (target - energy) * (1 - Math.exp(-dt * (target > energy ? 11 : 3.8)));
    gather += ((['processing', 'connecting'].includes(state) ? 1 : 0) - gather) * (1 - Math.exp(-dt * 3));
    opacity += ((['muted', 'error'].includes(state) ? .28 : 1) - opacity) * (1 - Math.exp(-dt * 4));
    const movement = animated ? energy : 0;
    const fold = animated ? gather : ['processing', 'connecting'].includes(state) ? 1 : 0;
    const alpha = animated ? opacity : ['muted', 'error'].includes(state) ? .28 : 1;
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width / 2, height / 2 + 7);
    const scale = Math.min(width / 180, height / 190);
    ctx.scale(scale, scale);
    ctx.rotate(-.42 + (animated && state !== 'muted' ? .025 * Math.sin(time * .7) : 0));
    const breath = animated && !['muted', 'error'].includes(state) ? Math.sin(time * 1.7) * .025 : 0;
    ctx.scale(1 + breath, 1 + breath);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const h = 155, w = 46 * (1 - .55 * fold);
    const spine = y => 10 * Math.sin((y / h + .5) * Math.PI) + movement * 6 * Math.sin(time * 3 + y * .025) * (1 - fold);
    ctx.globalAlpha = alpha * .65; ctx.strokeStyle = '#253b31'; ctx.lineWidth = 1.15;
    ctx.beginPath();
    for (let j = 0; j <= 60; j++) {
      const y = h / 2 + 15 - j * (h + 15) / 60;
      if (!j) ctx.moveTo(spine(y), y); else ctx.lineTo(spine(y), y);
    }
    ctx.stroke();
    for (let i = 0; i < 30; i++) {
      const u = (i + 1) / 32, y = h / 2 - u * h;
      const spread = w * Math.pow(Math.sin(Math.PI * u), .8) * (1 + .1 * Math.sin(u * 5));
      for (const side of [-1, 1]) {
        const wave = movement * (4 + 9 * Math.sin(Math.PI * u)) * Math.sin(time * 5 - u * 8 + side * .8);
        const x = spine(y) + side * spread * (side === 1 ? 1 : .78);
        const endY = y - 22 * Math.sin(Math.PI * u) + wave;
        ctx.strokeStyle = i % 4 === 0 ? '#253b31' : '#7f9c63';
        ctx.globalAlpha = alpha * (.28 + .48 * Math.sin(Math.PI * u));
        ctx.lineWidth = i % 4 === 0 ? 1 : .75;
        ctx.beginPath(); ctx.moveTo(spine(y), y);
        ctx.bezierCurveTo(spine(y) + side * spread * .35, y - 9 + wave * .2, x - side * spread * .25, endY + 4, x, endY);
        ctx.stroke();
      }
    }
    if (animated && fold > .01) {
      ctx.fillStyle = '#7f9c63';
      for (let i = 0; i < 5; i++) {
        const q = (time * .25 + i / 5) % 1, y = h / 2 - q * h;
        ctx.globalAlpha = alpha * fold * .6 * Math.sin(q * Math.PI);
        ctx.beginPath(); ctx.arc(spine(y), y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  const refresh = () => { dirty = true; };
  const pause = () => cancelAnimationFrame(frame);
  const resume = () => { pause(); previous = 0; dirty = true; frame = requestAnimationFrame(draw); };
  reduced.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  resume();
  return { destroy() {
    pause(); resize.disconnect(); observer.disconnect();
    reduced.removeEventListener('change', refresh);
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('pagehide', pause); window.removeEventListener('pageshow', resume);
  } };
}
