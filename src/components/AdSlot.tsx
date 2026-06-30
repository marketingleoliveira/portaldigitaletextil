import React, { useEffect, useRef } from 'react';

interface AdSlotProps {
  slot?: string;
  className?: string;
}

const ADSENSE_CLIENT = 'ca-pub-8202479736483548';
const DEFAULT_SLOT = (import.meta as any).env?.VITE_ADSENSE_SLOT as string | undefined;

/**
 * Google AdSense ad slot - 300x600 (Half Page / Large Skyscraper).
 * Configure the ad unit ID via VITE_ADSENSE_SLOT or pass `slot` prop.
 */
const AdSlot: React.FC<AdSlotProps> = ({ slot, className }) => {
  const ref = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const adSlot = slot || DEFAULT_SLOT;

  useEffect(() => {
    if (pushed.current || !adSlot) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      // ignore
    }
  }, [adSlot]);

  return (
    <div
      className={`flex justify-center my-6 ${className ?? ''}`}
      aria-label="Espaço publicitário"
    >
      <div
        style={{ width: 300, height: 600 }}
        className="bg-muted/30 border border-border rounded-md overflow-hidden flex items-center justify-center text-xs text-muted-foreground"
      >
        {adSlot ? (
          <ins
            ref={ref as any}
            className="adsbygoogle"
            style={{ display: 'block', width: 300, height: 600 }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={adSlot}
            data-ad-format="rectangle"
            data-full-width-responsive="false"
          />
        ) : (
          <span>Anúncio 300×600</span>
        )}
      </div>
    </div>
  );
};

export default AdSlot;
