import { useEffect, useState } from 'react';
import { COUNTDOWN_INITIAL, RELEASE_DATE_MS, computeTimeLeft } from '../../lib/homeLogic';

/** Ticks every second until the release date; after it the display simply stops updating. */
export function useCountdown() {
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_INITIAL);

  useEffect(() => {
    const interval = setInterval(() => {
      const left = computeTimeLeft(RELEASE_DATE_MS, new Date().getTime());
      if (!left) {
        clearInterval(interval);
        return;
      }
      setTimeLeft(left);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}
