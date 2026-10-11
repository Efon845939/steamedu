import React from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { useMotion } from './motion-tokens';

export { MOTION_TOKENS, tokensFor, useMotion } from './motion-tokens';

// Wrap a page (or the part of it that animates) in <MotionScope> and use the `m`
// components inside it: import * as m from 'motion/react-m'.
//
// Only lazy route pages import this file, so motion stays out of the main bundle and
// loads with the first page that needs it. Never import it from App, Navbar or the
// landing page. Inside a route chunk the features are already loaded at first render,
// so an m.* element with initial opacity 0 can never get stuck invisible.
//
// Page-load entrances should still be CSS (animate-rise, animate-fade); use motion for
// what answers the person: answer reveals, the arena verdict, side panels, springs.
export const MotionScope = ({ children }) => {
  const mo = useMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={mo.full ? 'never' : 'always'} transition={mo.spring}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
};
