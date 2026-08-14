(() => {
  "use strict";

  const header = document.querySelector("#site-header");
  const revealItems = document.querySelectorAll(".reveal");
  const revealOnLoad = document.querySelectorAll(".reveal-on-load");
  const reviewViewport = document.querySelector("#review-viewport");
  const reviewTrack = document.querySelector("#review-track");

  if (header) {
    let ticking = false;
    const updateHeader = () => {
      header.classList.toggle("is-condensed", window.scrollY > 50);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
    updateHeader();
  }

  revealOnLoad.forEach((item) => item.classList.add("is-visible"));

  if (revealItems.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, revealObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const privacyPanel = document.querySelector("#privacy-policy");

  if (privacyPanel) {
    const openers = document.querySelectorAll(".js-privacy-open");
    const closers = document.querySelectorAll(".js-privacy-close");
    let lastFocus = null;

    const setHash = (url) => {
      try {
        history.replaceState(null, "", url);
      } catch (e) { }
    };

    const openPrivacy = () => {
      lastFocus = document.activeElement;
      privacyPanel.classList.add("is-open");
      privacyPanel.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      if (location.hash !== "#privacy-policy") setHash("#privacy-policy");
      const firstClose = privacyPanel.querySelector(".js-privacy-close");
      if (firstClose) firstClose.focus();
    };

    const closePrivacy = () => {
      privacyPanel.classList.remove("is-open");
      privacyPanel.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (location.hash === "#privacy-policy") setHash(location.pathname + location.search);
      if (lastFocus) lastFocus.focus();
    };

    openers.forEach((el) => el.addEventListener("click", (e) => {
      e.preventDefault();
      openPrivacy();
    }));

    closers.forEach((el) => el.addEventListener("click", closePrivacy));

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && privacyPanel.classList.contains("is-open")) closePrivacy();
    });

    privacyPanel.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(privacyPanel.querySelectorAll("button, a[href]"));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    if (location.hash === "#privacy-policy") openPrivacy();
  }

  if (!reviewViewport || !reviewTrack) return;

  const originalReviews = Array.from(reviewTrack.children);
  const cardCount = originalReviews.length;
  if (!cardCount) return;

  // Triple the cards for seamless infinite looping
  originalReviews.forEach((r) => {
    const c = r.cloneNode(true);
    c.setAttribute("aria-hidden", "true");
    reviewTrack.appendChild(c);
  });
  originalReviews.slice().reverse().forEach((r) => {
    const c = r.cloneNode(true);
    c.setAttribute("aria-hidden", "true");
    reviewTrack.insertBefore(c, reviewTrack.firstChild);
  });

  const getGap = () => parseFloat(getComputedStyle(reviewTrack).gap) || 16;
  const getCardStep = () => {
    const c = reviewTrack.firstElementChild;
    return c ? c.offsetWidth + getGap() : 340;
  };
  const getSetWidth = () => getCardStep() * cardCount;

  /* ───────────────────────────────────────────
     Mobile: transform‑based drag
     Uses translate3d() instead of scrollLeft so
     the browser’s native touch handling never
     fights with JS‑driven movement.
     ─────────────────────────────────────────── */
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  if (isCoarsePointer) {
    reviewViewport.classList.add("is-mobile-drag");
    reviewViewport.style.overflow = "hidden";
    reviewViewport.style.touchAction = "none";
    reviewViewport.style.cursor = "";

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let pos = -getSetWidth(); // start inside the middle (cloned) set
    let vel = 0;
    let animId = null;
    let down = false;
    let pid = null;
    let lastX = 0;
    let deltas = [];

    const applyPos = () => {
      reviewTrack.style.transform = `translate3d(${pos}px, 0, 0)`;
    };

    const wrap = () => {
      const sw = getSetWidth();
      while (pos > -sw * 0.02) pos -= sw;
      while (pos < -sw * 2.98) pos += sw;
    };

    const stopAnim = () => {
      if (animId) { cancelAnimationFrame(animId); animId = null; }
    };

    const startMomentum = (v) => {
      stopAnim();
      if (Math.abs(v) < 0.08 || prefersReducedMotion) { wrap(); applyPos(); return; }
      // Boost the flick a touch so it feels airy and responsive
      vel = v * 1.15;
      const step = () => {
        vel *= 0.985;
        pos += vel;
        const sw = getSetWidth();
        if (pos > -sw * 0.02) pos -= sw;
        else if (pos < -sw * 2.98) pos += sw;
        applyPos();
        if (Math.abs(vel) < 0.015) { animId = null; wrap(); applyPos(); return; }
        animId = requestAnimationFrame(step);
      };
      animId = requestAnimationFrame(step);
    };

    applyPos();

    window.addEventListener("resize", () => {
      stopAnim();
      wrap();
      applyPos();
    }, { passive: true });

    reviewViewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopAnim();
      down = true;
      pid = e.pointerId;
      lastX = e.clientX;
      deltas = [{ x: e.clientX, t: performance.now() }];
      reviewViewport.setPointerCapture(pid);
    });

    reviewViewport.addEventListener("pointermove", (e) => {
      if (!down || e.pointerId !== pid) return;
      const dx = e.clientX - lastX;
      // Ignore tiny movements so taps don’t trigger drag class
      if (deltas.length <= 1 && Math.abs(dx) < 5) return;
      e.preventDefault();
      reviewViewport.classList.add("is-dragging");
      deltas.push({ x: e.clientX, t: performance.now() });
      if (deltas.length > 12) deltas.shift();
      lastX = e.clientX;
      pos += dx;
      const sw = getSetWidth();
      if (pos > -sw * 0.02) pos -= sw;
      else if (pos < -sw * 2.98) pos += sw;
      applyPos();
    });

    const endDrag = () => {
      if (!down) return;
      down = false;
      pid = null;
      reviewViewport.classList.remove("is-dragging");
      if (deltas.length >= 3) {
        // Last 2 samples for a snappier velocity that tracks flick speed
        const recent = deltas.slice(-2);
        const a = recent[0];
        const b = recent[recent.length - 1];
        const dt = b.t - a.t;
        if (dt > 0 && dt < 150) startMomentum((b.x - a.x) / dt);
        else { wrap(); applyPos(); }
      } else {
        wrap();
        applyPos();
      }
      deltas = [];
    };

    reviewViewport.addEventListener("pointerup", endDrag);
    reviewViewport.addEventListener("pointercancel", endDrag);
    reviewViewport.addEventListener("lostpointercapture", endDrag);

    reviewViewport.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      stopAnim();
      pos += e.key === "ArrowRight" ? -getCardStep() : getCardStep();
      wrap();
      applyPos();
    });

  } else {
    /* ───────────────────────────────────────────
       Desktop: scrollLeft-based infinite drag
       ─────────────────────────────────────────── */

    const normalize = () => {
      const sw = getSetWidth();
      if (!sw) return;
      const sl = reviewViewport.scrollLeft;
      let target = sl;
      while (target < sw * 0.5) target += sw;
      while (target > sw * 2) target -= sw;
      if (target === sl) return;
      reviewViewport.style.scrollBehavior = "auto";
      reviewViewport.scrollLeft = target;
      void reviewViewport.offsetWidth;
      reviewViewport.style.scrollBehavior = "";
    };

    reviewViewport.style.scrollBehavior = "auto";
    reviewViewport.scrollLeft = getSetWidth();
    reviewViewport.style.scrollBehavior = "";

    window.addEventListener("resize", () => {
      const sw = getSetWidth();
      if (!sw) return;
      reviewViewport.style.scrollBehavior = "auto";
      if (reviewViewport.scrollLeft < sw) reviewViewport.scrollLeft += sw;
      normalize();
      reviewViewport.style.scrollBehavior = "";
    }, { passive: true });

    reviewViewport.addEventListener("scroll", normalize, { passive: true });

    let momentumRaf = null;

    const stopMomentum = () => {
      if (momentumRaf) { cancelAnimationFrame(momentumRaf); momentumRaf = null; }
    };

    const applyMomentum = (v) => {
      stopMomentum();
      if (Math.abs(v) < 0.25) return;
      const friction = 0.92;
      const step = () => {
        v *= friction;
        reviewViewport.scrollLeft -= v;
        normalize();
        if (Math.abs(v) < 0.1) { momentumRaf = null; return; }
        momentumRaf = requestAnimationFrame(step);
      };
      momentumRaf = requestAnimationFrame(step);
    };

    let down = false, dragging = false, lastX = 0, pid = null;
    let deltas = [];

    const endDrag = () => {
      if (!down) return;
      down = dragging = false;
      pid = null;
      reviewViewport.classList.remove("is-dragging");
      if (deltas.length >= 2) {
        const a = deltas[0], b = deltas[deltas.length - 1];
        const dt = b.t - a.t;
        if (dt > 0) applyMomentum((b.x - a.x) / dt);
      }
      deltas = [];
      normalize();
    };

    reviewViewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopMomentum();
      down = true;
      dragging = false;
      pid = e.pointerId;
      lastX = e.clientX;
      deltas = [{ x: e.clientX, t: performance.now() }];
      reviewViewport.setPointerCapture(pid);
    });

    reviewViewport.addEventListener("pointermove", (e) => {
      if (!down || e.pointerId !== pid) return;
      const dx = e.clientX - lastX;
      if (!dragging && Math.abs(dx) < 5) return;
      dragging = true;
      reviewViewport.classList.add("is-dragging");
      e.preventDefault();
      deltas.push({ x: e.clientX, t: performance.now() });
      if (deltas.length > 5) deltas.shift();
      lastX = e.clientX;
      reviewViewport.scrollLeft -= dx;
      normalize();
    });

    reviewViewport.addEventListener("pointerup", endDrag);
    reviewViewport.addEventListener("pointercancel", endDrag);
    reviewViewport.addEventListener("lostpointercapture", endDrag);

    reviewViewport.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      stopMomentum();
      reviewViewport.scrollLeft += e.key === "ArrowRight" ? getCardStep() : -getCardStep();
      normalize();
    });
  }

})();


