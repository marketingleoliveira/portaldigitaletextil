import React, { useEffect, useRef } from 'react';

interface AdSlotProps {
  slot?: string;
  className?: string;
}

const ADSENSE_CLIENT = 'ca-pub-8202479736483548';
const ADSENSE_SCRIPT_ID = 'google-adsense-script';
const DEFAULT_SLOT =
  ((import.meta as any).env?.VITE_ADSENSE_SLOT as string | undefined) || '2729027690';

/**
 * Google AdSense — slot 100% responsivo (largura e altura).
 * Usa data-ad-format="auto" + data-full-width-responsive="true",
 * exatamente como o snippet oficial fornecido pelo AdSense.
 */
const AdSlot: React.FC<AdSlotProps> = ({ slot, className }) => {
  const insRef = useRef<HTMLModElement | null>(null);
  const adSlot = slot || DEFAULT_SLOT;

  // Carrega o script do AdSense uma única vez.
  useEffect(() => {
    if (document.getElementById(ADSENSE_SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }, []);

  // Inicializa o anúncio.
  useEffect(() => {
    if (!adSlot) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore */
    }
  }, [adSlot]);

  return (
    <div
      className={`flex justify-center my-4 w-full ${className ?? ''}`}
      aria-label="Espaço publicitário"
    >
      <ins
        ref={insRef as any}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSlot;
