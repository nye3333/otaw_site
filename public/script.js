(() => {
    'use strict';

    const FLOAT_POS_KEY_DEFAULT = 'otaw_site_float_fig_positions';

    function floatPosKey(floatHost) {
        const k = floatHost && floatHost.dataset && floatHost.dataset.floatPosKey;
        return (k && String(k).trim()) || FLOAT_POS_KEY_DEFAULT;
    }

    /** Slots below this index use CSS placement only (no localStorage apply/save). */
    function minStoredSlot(floatHost) {
        const raw = floatHost && floatHost.dataset && floatHost.dataset.floatMinStoredSlot;
        const n = raw != null && String(raw).trim() !== '' ? parseInt(raw, 10) : 1;
        return Number.isFinite(n) && n > 0 ? n : 1;
    }

    function figSlotId(fig) {
        for (const c of fig.classList) {
            if (/^fv-\d+$/.test(c)) return c;
        }
        return null;
    }

    function clampFigToHost(fig, floatHost) {
        const nx = parseFloat(fig.style.left);
        const ny = parseFloat(fig.style.top);
        if (Number.isNaN(nx) || Number.isNaN(ny)) return;
        const maxX = floatHost.clientWidth - fig.offsetWidth;
        const maxY = floatHost.clientHeight - fig.offsetHeight;
        fig.style.left = `${Math.max(0, Math.min(nx, maxX))}px`;
        fig.style.top = `${Math.max(0, Math.min(ny, maxY))}px`;
    }

    function saveFloatPositions(floatHost) {
        const minSlot = minStoredSlot(floatHost);
        const data = {};
        floatHost.querySelectorAll('.float-fig').forEach(fig => {
            const id = figSlotId(fig);
            if (!id) return;
            const n = fvSlotNumber(fig);
            if (n == null || n < minSlot) return;
            const fr = fig.getBoundingClientRect();
            const cr = floatHost.getBoundingClientRect();
            data[id] = { left: fr.left - cr.left, top: fr.top - cr.top };
        });
        try {
            localStorage.setItem(floatPosKey(floatHost), JSON.stringify(data));
        } catch (_) {
            /* quota / private mode */
        }
    }

    /** Same data as inline snippet; re-applies if inline host lookup failed (e.g. currentScript quirks). */
    function applyFloatPositionsFromStorage(floatHost) {
        let data;
        try {
            data = JSON.parse(localStorage.getItem(floatPosKey(floatHost)) || 'null');
        } catch (_) {
            return;
        }
        if (!data || typeof data !== 'object') return;
        const minSlot = minStoredSlot(floatHost);
        floatHost.querySelectorAll('.float-fig').forEach(fig => {
            const id = figSlotId(fig);
            if (!id || data[id] == null) return;
            const n = fvSlotNumber(fig);
            if (n != null && n < minSlot) return;
            const raw = data[id];
            const left = Number(raw.left);
            const top = Number(raw.top);
            if (!Number.isFinite(left) || !Number.isFinite(top)) return;
            fig.style.left = `${left}px`;
            fig.style.top = `${top}px`;
            fig.style.right = 'auto';
        });
    }

    /** Clamp after layout; requires inline or applyFloatPositionsFromStorage to have set left/top. */
    function clampStoredFloatFigs(floatHost) {
        floatHost.querySelectorAll('.float-fig').forEach(fig => {
            if (fig.style.left) clampFigToHost(fig, floatHost);
        });
    }

    function fvSlotNumber(fig) {
        const id = figSlotId(fig);
        if (!id) return null;
        const m = /^fv-(\d+)$/.exec(id);
        return m ? parseInt(m[1], 10) : null;
    }

    /**
     * Deterministic placement for fv-5+ when nothing is in localStorage yet.
     * Do not use live offsetWidth from <video>: intrinsic dimensions can be ~1920px before
     * CSS applies, which drives maxX/maxY to 0 and stacks every figure at (0,0).
     */
    function scatterExtraFloatFigs(floatHost) {
        const slotW = 168;
        const slotH = 220;
        floatHost.querySelectorAll('.float-fig').forEach(fig => {
            const n = fvSlotNumber(fig);
            if (n == null || n < 5) return;
            if (fig.style.left) return;
            const w = floatHost.clientWidth;
            const h = floatHost.clientHeight;
            if (w <= 0 || h <= 0) return;
            const maxY = Math.max(0, h - slotH);
            const zoneLeft = Math.min(Math.round(w * 0.36), Math.max(0, w - slotW));
            const spanX = Math.max(0, w - slotW - zoneLeft);
            const seed = n * 1103515245 + 12345;
            const rx = ((seed >>> 0) % 1001) / 1000;
            const ry = ((seed >>> 12) % 1001) / 1000;
            fig.style.right = 'auto';
            fig.style.left = `${zoneLeft + Math.round(rx * spanX)}px`;
            fig.style.top = `${Math.round(ry * maxY)}px`;
        });
    }

    function revealFloatingVideos(floatHost) {
        const vids = [...floatHost.querySelectorAll('.float-vid')];
        const imgs = [...floatHost.querySelectorAll('.float-img')];
        let revealed = false;
        const reveal = () => {
            if (revealed) return;
            revealed = true;
            floatHost.classList.add('is-revealed');
        };
        const vidsOk = () => (vids.length ? vids.every(v => v.readyState >= 2) : true);
        const imgsOk = () =>
            imgs.length
                ? imgs.every(img => img.complete && img.naturalWidth > 0)
                : true;
        const maybeReveal = () => {
            if (vidsOk() && imgsOk()) reveal();
        };

        vids.forEach(v => {
            v.addEventListener('loadeddata', maybeReveal);
            v.addEventListener('canplay', maybeReveal);
        });
        imgs.forEach(img => {
            if (img.decode) {
                img.decode().then(maybeReveal).catch(maybeReveal);
            }
            img.addEventListener('load', maybeReveal);
            img.addEventListener('error', maybeReveal);
        });
        maybeReveal();
        setTimeout(reveal, 1800);
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* If later code throws, the layer must not stay at opacity: 0 forever. */
    window.addEventListener('load', () => {
        const el =
            document.getElementById('otaw-floating-videos') ||
            document.querySelector('.floating-videos');
        if (el && !el.classList.contains('is-revealed')) {
            el.classList.add('is-revealed');
        }
    });

    function setFloatVidStartTime(v, offset) {
        const d = v.duration;
        if (!Number.isFinite(d) || d <= 0) return;
        v.currentTime = offset % d;
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            const id = anchor.getAttribute('href');
            const target = id && id.length > 1 ? document.querySelector(id) : null;
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });
        });
    });

    const video = document.querySelector('.video-bg .bg-video');
    const videoHost = document.querySelector('.video-bg');

    if (video && videoHost && !prefersReducedMotion) {
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        video.play().catch(() => {});
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.01 }
        );

        observer.observe(videoHost);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                video.pause();
            } else if (videoHost.getBoundingClientRect().bottom > 0) {
                video.play().catch(() => {});
            }
        });
    } else if (video && prefersReducedMotion) {
        video.pause();
        video.removeAttribute('autoplay');
    }

    const floatingVids = document.querySelectorAll('.float-vid');
    if (prefersReducedMotion) {
        floatingVids.forEach(v => {
            v.pause();
            v.removeAttribute('autoplay');
        });
    } else {
        floatingVids.forEach(v => {
            const offset = parseFloat(v.dataset.offset) || 0;
            v.addEventListener(
                'loadedmetadata',
                () => {
                    setFloatVidStartTime(v, offset);
                    v.play().catch(() => {});
                },
                { once: true }
            );
            if (v.readyState >= 1) {
                setFloatVidStartTime(v, offset);
                v.play().catch(() => {});
            }
        });

        document.addEventListener('visibilitychange', () => {
            floatingVids.forEach(v => {
                if (document.hidden) {
                    v.pause();
                } else {
                    v.play().catch(() => {});
                }
            });
        });
    }

    const floatHost =
        document.getElementById('otaw-floating-videos') ||
        document.querySelector('.floating-videos');
    const floatFigs = floatHost ? floatHost.querySelectorAll('.float-fig') : [];
    if (floatHost && floatFigs.length) {
        applyFloatPositionsFromStorage(floatHost);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scatterExtraFloatFigs(floatHost);
                clampStoredFloatFigs(floatHost);
                revealFloatingVideos(floatHost);
            });
        });

        window.addEventListener('resize', () => {
            floatHost.querySelectorAll('.float-fig').forEach(fig => {
                if (fig.style.left) clampFigToHost(fig, floatHost);
            });
        });

        floatFigs.forEach(fig => {
            fig.addEventListener('pointerdown', e => {
                if (!e.isPrimary) return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                e.preventDefault();

                const figRect = fig.getBoundingClientRect();
                const cRect = floatHost.getBoundingClientRect();
                const leftPx = figRect.left - cRect.left;
                const topPx = figRect.top - cRect.top;

                fig.style.left = `${leftPx}px`;
                fig.style.top = `${topPx}px`;
                fig.style.right = 'auto';

                const offX = e.clientX - figRect.left;
                const offY = e.clientY - figRect.top;

                fig.classList.add('is-dragging');

                const onMove = moveEv => {
                    if (!moveEv.isPrimary) return;
                    const cr = floatHost.getBoundingClientRect();
                    let nx = moveEv.clientX - cr.left - offX;
                    let ny = moveEv.clientY - cr.top - offY;
                    const maxX = floatHost.clientWidth - fig.offsetWidth;
                    const maxY = floatHost.clientHeight - fig.offsetHeight;
                    nx = Math.max(0, Math.min(nx, maxX));
                    ny = Math.max(0, Math.min(ny, maxY));
                    fig.style.left = `${nx}px`;
                    fig.style.top = `${ny}px`;
                };

                const onUp = upEv => {
                    fig.removeEventListener('pointermove', onMove);
                    fig.removeEventListener('pointerup', onUp);
                    fig.removeEventListener('pointercancel', onUp);
                    fig.classList.remove('is-dragging');
                    try {
                        fig.releasePointerCapture(upEv.pointerId);
                    } catch (_) {
                        /* already released */
                    }
                    saveFloatPositions(floatHost);
                };

                fig.addEventListener('pointermove', onMove);
                fig.addEventListener('pointerup', onUp);
                fig.addEventListener('pointercancel', onUp);
                fig.setPointerCapture(e.pointerId);
            });
        });
    }
})();
