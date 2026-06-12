import { useState, useEffect } from 'react';

export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    document.documentElement.getAttribute('data-theme') !== 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
