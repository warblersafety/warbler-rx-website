const DURATION = 18000;
const STEPS = ['scan', 'outreach', 'moving'];
const COPY = {
  scan: ['Reviewing records', 'Ready', 'Queued', 'Queued', 'Queued', 'Clinic-authorized records', 'Routine calls. Human oversight.', 'Scan EHR: identify patients who may need follow-up.'],
  outreach: ['Signals found', 'Reaching out', 'Calling', 'Up next', 'Queued', 'Relevant follow-ups identified', 'Supportive conversations, at scale.', 'Start outreach: a voice agent checks in about visits and medication access.'],
  moving: ['Review complete', 'Clinic review', 'For review', 'Follow-up', 'Follow-up', 'Context connected to outreach', 'Clinical questions → your care team', 'Keep care moving: bring follow-up needs and clinical questions to your care team.']
};

/** A local, illustrative scene; no records are read and no calls are placed. */
export function initWalkthrough(root = document) {
  root.querySelectorAll('[data-walkthrough]').forEach(scene => {
    if (scene.dataset.walkthroughInitialized) return;
    const play = scene.querySelector('[data-walkthrough-play]');
    const label = scene.querySelector('[data-walkthrough-play-label]');
    const timer = scene.querySelector('[data-walkthrough-time]');
    const announcement = scene.querySelector('[data-walkthrough-announcement]');
    const buttons = [...scene.querySelectorAll('[data-walkthrough-select]')];
    if (!play || !label || buttons.length !== 3) return;
    scene.dataset.walkthroughInitialized = 'true';

    const fields = ['ehr-status', 'call-status', 'call-a', 'call-b', 'call-c', 'ehr-note', 'outcome'];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let elapsed = 0;
    let started = 0;
    let frame = 0;
    let playing = false;
    let currentStep = 'scan';
    let inView = false;
    let automaticPlaybackAllowed = true;
    let completed = false;

    function setStep(step) {
      if (step === currentStep && scene.dataset.walkthroughState === 'ready') return;
      currentStep = step;
      scene.dataset.walkthroughStep = step;
      fields.forEach((field, index) => {
        const target = scene.querySelector(`[data-walkthrough-${field}]`);
        if (target) target.textContent = COPY[step][index];
      });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.walkthroughSelect === step)));
      if (announcement) announcement.textContent = COPY[step][7];
    }

    function renderTime() {
      const progress = reducedMotion.matches ? Math.floor(elapsed / 6000) / 3 * 100 : elapsed / DURATION * 100;
      scene.style.setProperty('--walkthrough-progress', `${Math.min(100, progress)}%`);
      if (timer) timer.textContent = `0:${String(Math.floor(elapsed / 1000)).padStart(2, '0')} / 0:18`;
      const next = STEPS[Math.min(2, Math.floor(elapsed / 6000))];
      if (next !== currentStep) setStep(next);
    }

    function pause(complete = false) {
      if (playing) elapsed = Math.min(DURATION, performance.now() - started);
      complete = complete || elapsed >= DURATION;
      playing = false;
      cancelAnimationFrame(frame);
      completed = complete;
      scene.dataset.walkthroughState = complete ? 'complete' : 'paused';
      label.textContent = complete ? 'Replay walkthrough' : 'Play walkthrough';
      play.setAttribute('aria-label', complete ? 'Replay 18-second walkthrough' : 'Play walkthrough');
      renderTime();
      if (complete && announcement) announcement.textContent = 'Walkthrough complete. Replay it or explore any of the three steps.';
    }

    function tick(now) {
      if (!playing) return;
      elapsed = Math.min(DURATION, now - started);
      renderTime();
      if (elapsed >= DURATION) pause(true);
      else frame = requestAnimationFrame(tick);
    }

    function start() {
      if (playing || document.hidden) return;
      playing = true;
      scene.dataset.walkthroughState = 'playing';
      label.textContent = 'Pause walkthrough';
      play.setAttribute('aria-label', 'Pause walkthrough');
      setStep(STEPS[Math.min(2, Math.floor(elapsed / 6000))]);
      renderTime();
      started = performance.now() - elapsed;
      frame = requestAnimationFrame(tick);
    }

    function resumeWhenVisible() {
      if (inView && automaticPlaybackAllowed && !completed && !reducedMotion.matches) start();
    }

    play.addEventListener('click', () => {
      if (playing) {
        automaticPlaybackAllowed = false;
        pause();
        return;
      }
      if (completed) elapsed = 0;
      completed = false;
      automaticPlaybackAllowed = true;
      start();
    });

    buttons.forEach(button => button.addEventListener('click', () => {
      automaticPlaybackAllowed = false;
      pause();
      const step = button.dataset.walkthroughSelect;
      elapsed = STEPS.indexOf(step) * 6000;
      completed = false;
      scene.dataset.walkthroughState = 'paused';
      label.textContent = 'Play walkthrough';
      play.setAttribute('aria-label', 'Play walkthrough');
      setStep(step);
      renderTime();
    }));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (playing) pause(); }
      else resumeWhenVisible();
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) { if (playing) pause(); }
      else resumeWhenVisible();
    });

    // Observe the actual illustration, so the same threshold works on mobile.
    // Keep playing near the viewport edge; pause only when fully out of view.
    if ('IntersectionObserver' in window) {
      const target = scene.querySelector('.walkthrough-scene') || scene;
      const observer = new window.IntersectionObserver(entries => {
        const entry = entries.find(item => item.target === target);
        if (!entry) return;
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        if (!entry.isIntersecting || entry.intersectionRatio <= 0) {
          if (playing) pause();
        } else resumeWhenVisible();
      }, { threshold: [0, 0.35] });
      observer.observe(target);
    }
  });
}
