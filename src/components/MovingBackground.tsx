import { useState, useEffect } from 'react';

const MovingBackground = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setIsMobile(window.innerWidth <= 768);
    
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
      style={{ backgroundColor: 'hsl(220 75% 12%)' }}
    >
      {/* Static Fallback / Poster Background */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/hero-poster.png)' }}
      />

      {/* Video background — deferred until mounted, only plays on desktop */}
      {isMounted && !isMobile && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/hero-poster.png"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoadedData={() => setVideoLoaded(true)}
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* Dark overlay for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg,
            hsl(220 75% 12% / 0.82) 0%,
            hsl(220 60% 18% / 0.75) 40%,
            hsl(224 80% 15% / 0.80) 100%
          )`,
        }}
      />

      {/* Blueprint grid overlay — large grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsl(220 60% 75% / 0.10) 1px, transparent 1px),
            linear-gradient(90deg, hsl(220 60% 75% / 0.10) 1px, transparent 1px)
          `,
          backgroundSize: '140px 140px',
        }}
      />

      {/* Blueprint grid overlay — smaller lines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsl(220 60% 70% / 0.04) 1px, transparent 1px),
            linear-gradient(90deg, hsl(220 60% 70% / 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '35px 35px',
        }}
      />
    </div>
  );
};

export default MovingBackground;
