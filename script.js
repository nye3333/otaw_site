(() => {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
            v.addEventListener('loadedmetadata', () => {
                v.currentTime = offset % v.duration;
                v.play().catch(() => {});
            }, { once: true });
            if (v.readyState >= 1) {
                v.currentTime = offset % v.duration;
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
})();
