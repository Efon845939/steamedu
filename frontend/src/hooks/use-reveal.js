import { useEffect } from 'react';

// Fades in every `.reveal` element under `ref` as it scrolls into view.
// The hidden start state lives in index.css and only applies when motion is
// allowed, so without IntersectionObserver (or with Lite / reduced motion)
// content is simply visible.
export const useReveal = (ref) => {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const items = Array.from(root.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ref]);
};
