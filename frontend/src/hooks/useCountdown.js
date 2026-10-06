import { useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

/**
 * Deadline-based countdown.
 *
 *   const { remaining, elapsed, pct } = useCountdown(90, { running, onExpire, resetKey });
 *
 * - remaining: whole seconds left (ceil), elapsed: limit - remaining, pct: remaining as 0-100.
 * - The deadline is wall-clock based, so a throttled background tab doesn't slow the clock down.
 * - Pausing (running=false) clears the interval; resuming continues from the time that was left.
 * - onExpire fires exactly once per limit/resetKey, always with the latest callback.
 * - Changing limitSeconds or resetKey restarts the countdown from the full limit.
 * - A limit of 0 (or less) means "no timer": nothing ticks and onExpire never fires.
 */
export const useCountdown = (limitSeconds, { running = true, onExpire, resetKey } = {}) => {
  const limit = Math.max(0, Math.round(Number(limitSeconds) || 0));
  const [remaining, setRemaining] = useState(limit);
  const remainingRef = useRef(limit);
  const msLeftRef = useRef(limit * 1000);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Runs after every cleanup and before the ticking effect below, so a new limit/key starts clean.
  useEffect(() => {
    msLeftRef.current = limit * 1000;
    remainingRef.current = limit;
    firedRef.current = false;
    setRemaining(limit);
  }, [limit, resetKey]);

  useEffect(() => {
    if (!running || limit <= 0 || firedRef.current) return undefined;
    const deadline = Date.now() + msLeftRef.current;
    let intervalId = null;

    const tick = () => {
      const msLeft = Math.max(0, deadline - Date.now());
      const left = Math.ceil(msLeft / 1000);
      if (left !== remainingRef.current) {
        remainingRef.current = left;
        setRemaining(left);
      }
      if (msLeft <= 0 && !firedRef.current) {
        firedRef.current = true;
        msLeftRef.current = 0;
        clearInterval(intervalId);
        if (onExpireRef.current) onExpireRef.current();
      }
    };

    intervalId = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(intervalId);
      if (!firedRef.current) msLeftRef.current = Math.max(0, deadline - Date.now());
    };
  }, [running, limit, resetKey]);

  const elapsed = Math.max(0, limit - remaining);
  const pct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;
  return { remaining, elapsed, pct };
};

export default useCountdown;
