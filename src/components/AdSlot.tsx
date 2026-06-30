import React, { useEffect, useRef, useState } from 'react';

interface AdSlotProps {
  slot?: string;
  className?: string;
}

const ADSENSE_CLIENT = 'ca-pub-8202479736483548';
const DEFAULT_SLOT = (import.meta as any).env?.VITE_ADSENSE_SLOT as string | undefined;

type AdFormat = {
  w: number;
  h: number;
  format: string;
  label: string;
};

// Escolhe o melhor formato IAB conforme a largura disponível.
// Fallback responsivo: nunca quebra layout em telas menores.
function pickFormat(width: number): AdFormat {
  if (width >= 970) return { w: 970, h: 250, format: 'horizontal', label: '970×250' };
  if (width >= 728) return { w: 728, h: 90, format: 'horizontal', label: '728×90' };
  if (width >= 468) return { w: 468, h: 60, format: 'horizontal', label: '468×60' };
  if (width >= 336) return { w: 336, h: 280, format: 'rectangle', label: '336×280' };
  if (width >= 300) return { w: 300, h: 250, format: 'rectangle', label: '300×250' };
  return { w: 250, h: 250, format: 'rectangle', label: '250×250' };
}

/**
 * Google AdSense ad slot responsivo.
 * Tamanho preferencial: 970×250 (Billboard) em desktop.
 * Em telas menores, alterna automaticamente para 728×90, 468×60,
 * 336×280, 300×250 ou 250×250 — sem quebrar o layout.
 */
const AdSlot: React.FC<AdSlotProps> = ({ slot, className }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [fmt, setFmt] = useState<AdFormat>(() => pickFormat(typeof window !== 'undefined' ? window.innerWidth : 1024));
  const adSlot = slot || DEFAULT_SLOT;

  // Observa largura do contêiner e reescolhe o formato.
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const update = () => {
      const w = el.clientWidth || window.innerWidth;
      setFmt((prev) => {
        const next = pickFormat(w);
        return next.w === prev.w && next.h === prev.h ? prev : next;
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // (Re)inicializa o anúncio sempre que o formato muda — força novo <ins>.
  useEffect(() => {
    if (!adSlot) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // ignore
    }
  }, [adSlot, fmt.w, fmt.h]);

  return (
    <div
      ref={wrapperRef}
      className={`flex justify-center my-4 w-full ${className ?? ''}`}
      aria-label="Espaço publicitário"
    >
      <div
        style={{ maxWidth: fmt.w, width: '100%', height: fmt.h }}
        className="bg-muted/30 border border-border rounded-md overflow-hidden flex items-center justify-center text-xs text-muted-foreground"
      >
        {adSlot ? (
          <ins
            key={`${fmt.w}x${fmt.h}`}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', height: fmt.h }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={adSlot}
            data-ad-format={fmt.format}
            data-full-width-responsive="false"
          />
        ) : (
          <span>Anúncio {fmt.label}</span>
        )}
      </div>
    </div>
  );
};

export default AdSlot;
