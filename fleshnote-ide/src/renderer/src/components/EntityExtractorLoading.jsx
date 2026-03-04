import React, { useState, useEffect, useRef } from 'react';

// The old Hungarian characters to use as particles
const RUNES = ['𐲆', '𐲗', '𐲖', '𐲨', '𐲀', '𐲁', '𐲂', '𐲃', '𐲄', '𐲅', '𐲈', '𐲉'];

const LOADING_PHRASES = [
    "Interrogating side characters...",
    "Measuring magic system hardness...",
    "Categorizing shiny McGuffins...",
    "Twisting plot threads...",
    "Visiting planets...",
    "Untangling timelines...",
    "Adding purple dye to prose...",
    "Preparing em dashes...",
    "Mapping fictional continents...",
    "Decoding ancient prophecies...",
    "Filing lore dump #402...",
    "Cataloging suspicious taverns...",
    "Calculating sci-fi jargon density...",
    "Analyzing species stereotypes...",
    "Bribing the narrator...",
    "Dusting off forgotten plot threads...",
    "Sorting out the chosen ones...",
    "Translating made-up languages...",
    "Reticulating narrative splines..."
];

export default function EntityExtractorLoading({ subtitle }) {
    // --- SETTINGS (Fine-tuned for smaller display) ---
    const settings = {
        maxParticles: 80,
        spawnRate: 5,
        baseVelocity: 0.15,
        acceleration: 0.05,
        fillPerParticle: 4.0,
        startSize: 10,
        endSize: 4,
        explosionForce: 10,
        waveAmplitude: 0.08,
        waveSpeed: 3.0,
    };

    // --- ANIMATION STATE ---
    const canvasRef = useRef(null);
    const maskPathRef = useRef(null);
    const logoWrapperRef = useRef(null);
    const progressRef = useRef(0);
    const displayedProgressRef = useRef(0);
    const phaseRef = useRef('building'); // 'building' | 'shaking' | 'exploding'
    const particlesRef = useRef([]);
    const shakeTimerRef = useRef(0);
    const spawnAccumulatorRef = useRef(0);

    const settingsRef = useRef(settings);

    const [isShaking, setIsShaking] = useState(false);
    const [loadingText, setLoadingText] = useState(LOADING_PHRASES[0]);

    // --- TEXT CYCLING LOOP ---
    useEffect(() => {
        const interval = setInterval(() => {
            setLoadingText(LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // --- GAME LOOP ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const spawnParticle = (x, y, isExplosion = false) => {
            const s = settingsRef.current;
            const char = RUNES[Math.floor(Math.random() * RUNES.length)];
            const size = s.startSize + Math.random() * (s.endSize - s.startSize);

            if (isExplosion) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * s.explosionForce + 1.2;
                particlesRef.current.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    char, size, alpha: 1, life: 1,
                    type: 'outbound'
                });
            } else {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.max(canvas.width, canvas.height) / 2 + 20;
                const spawnX = canvas.width / 2 + Math.cos(angle) * dist;
                const spawnY = canvas.height / 2 + Math.sin(angle) * dist;

                particlesRef.current.push({
                    x: spawnX, y: spawnY,
                    vx: 0, vy: 0,
                    char, size, alpha: 0, life: 1,
                    type: 'inbound'
                });
            }
        };

        const loop = () => {
            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;
            const s = settingsRef.current;

            ctx.clearRect(0, 0, w, h);

            if (phaseRef.current === 'building') {
                const currentInbound = particlesRef.current.filter(p => p.type === 'inbound').length;
                spawnAccumulatorRef.current += s.spawnRate / 60;

                while (spawnAccumulatorRef.current >= 1) {
                    spawnAccumulatorRef.current -= 1;
                    if (currentInbound < s.maxParticles) {
                        spawnParticle(cx, cy, false);
                    }
                }
            } else if (phaseRef.current === 'shaking') {
                shakeTimerRef.current -= 1;
                if (shakeTimerRef.current <= 0) {
                    phaseRef.current = 'exploding';
                    progressRef.current = 0;
                    setIsShaking(false);

                    if (logoWrapperRef.current) {
                        logoWrapperRef.current.style.opacity = 0;
                    }

                    for (let i = 0; i < s.maxParticles * 1.5; i++) {
                        spawnParticle(cx, cy, true);
                    }
                }
            }

            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];

                if (p.type === 'inbound') {
                    const dx = cx - p.x;
                    const dy = cy - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx);

                    p.vx += Math.cos(angle) * s.acceleration;
                    p.vy += Math.sin(angle) * s.acceleration;

                    p.x += p.vx + Math.cos(angle) * s.baseVelocity;
                    p.y += p.vy + Math.sin(angle) * s.baseVelocity;

                    if (p.alpha < 1) p.alpha += 0.05;

                    if (dist < 10 && phaseRef.current === 'building') {
                        particlesRef.current.splice(i, 1);
                        progressRef.current = Math.min(100, progressRef.current + s.fillPerParticle);

                        if (progressRef.current > 0 && logoWrapperRef.current) {
                            logoWrapperRef.current.style.opacity = 1;
                        }

                        if (progressRef.current >= 100) {
                            phaseRef.current = 'shaking';
                            shakeTimerRef.current = 40;
                            setIsShaking(true);
                            particlesRef.current = particlesRef.current.filter(part => part.type !== 'inbound');
                        }
                        continue;
                    }
                } else if (p.type === 'outbound') {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.alpha -= 0.025;

                    if (p.alpha <= 0) {
                        particlesRef.current.splice(i, 1);
                        continue;
                    }
                }

                ctx.font = `${p.size}px "Noto Sans Old Hungarian"`;
                ctx.fillStyle = `rgba(212, 168, 71, ${Math.max(0, p.alpha)})`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(p.char, p.x, p.y);
            }

            if (phaseRef.current === 'exploding' && particlesRef.current.length === 0) {
                phaseRef.current = 'building';
                displayedProgressRef.current = 0;
            }

            if (maskPathRef.current) {
                displayedProgressRef.current += (progressRef.current - displayedProgressRef.current) * 0.08;

                const time = performance.now() * 0.001 * s.waveSpeed;
                const maxRadius = 260;
                const baseRadius = (displayedProgressRef.current / 100) * maxRadius;
                const numWaves = 7;

                let d = "";
                const points = 60;
                for (let i = 0; i <= points; i++) {
                    const angle = (i / points) * Math.PI * 2;
                    const wave = Math.sin(angle * numWaves + time) * (baseRadius * s.waveAmplitude);
                    const wave2 = Math.cos(angle * 11 - time * 1.5) * (baseRadius * s.waveAmplitude * 0.4);
                    const r = Math.max(0, baseRadius + wave + wave2);

                    const x = 357 / 2 + Math.cos(angle) * r;
                    const y = 416 / 2 + Math.sin(angle) * r;

                    if (i === 0) d += `M ${x} ${y} `;
                    else d += `L ${x} ${y} `;
                }
                d += "Z";
                maskPathRef.current.setAttribute('d', d);
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div style={{ position: 'relative', width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: 'var(--font-sans)', borderRadius: '6px' }}>
            {/* CANVAS BACKDROP */}
            <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
            />

            {/* SVG LOGO & TEXT OVERLAY */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none', marginTop: '-10px' }}>
                <div
                    ref={logoWrapperRef}
                    className={isShaking ? 'animate-shake' : ''}
                    style={{ opacity: 0, transition: 'transform 75ms' }}
                >
                    <svg width="71" height="83" viewBox="0 0 357 416" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 10px 8px rgba(0,0,0,0.5))' }}>
                        <defs>
                            <clipPath id="wavy-mask-loader">
                                <path ref={maskPathRef} d="" />
                            </clipPath>
                            <filter id="filter-inner-shadow" x="0" y="0" width="357" height="419.724" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                                <feOffset dy="4" />
                                <feGaussianBlur stdDeviation="2" />
                                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                                <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.31 0" />
                                <feBlend mode="normal" in2="shape" result="effect1_innerShadow_9_115" />
                            </filter>
                            <linearGradient id="paint-gold-gradient" x1="202.646" y1="293.935" x2="285.646" y2="376.935" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#D4A847" />
                                <stop offset="0.716346" stopColor="#A18036" />
                            </linearGradient>
                        </defs>
                        <g clipPath="url(#wavy-mask-loader)">
                            <g filter="url(#filter-inner-shadow)">
                                <path d="M141.5 15.5819L141.5 5.58186L141.5 15.5819ZM226 80.1864H236C236 77.8613 235.19 75.6088 233.709 73.8165L226 80.1864ZM226 354.285L233.661 360.712C235.172 358.911 236 356.636 236 354.285H226ZM225.929 308.582L218.858 315.653L219.209 315.987L225.929 308.582ZM226 15.5037L230.124 6.39369L216 4.76837e-06V15.5037H226ZM228.587 16.741L224.105 25.6806L224.105 25.6806L228.587 16.741ZM243.365 25.3142L237.942 33.7158V33.7158L243.365 25.3142ZM286.484 60.993L293.694 54.0627V54.0627L286.484 60.993ZM347 208.136H357V208.136H347ZM226 401.504H216V411.614L226.109 411.503L226 401.504ZM141.5 15.5819L141.5 25.5819C140.063 25.5819 139.152 25.2178 139.703 25.3867C139.879 25.4404 140.28 25.5774 140.943 25.842C142.248 26.3632 144.163 27.2179 146.612 28.4419C151.491 30.8801 158.193 34.6339 165.944 39.7504C181.463 49.9949 200.903 65.5132 218.291 86.5563L226 80.1864L233.709 73.8165C214.784 50.9146 193.734 34.1306 176.962 23.0591C168.567 17.5176 161.173 13.36 155.552 10.5513C152.751 9.15173 150.315 8.04908 148.362 7.26879C147.395 6.8827 146.441 6.53294 145.557 6.26251C145.05 6.10735 143.377 5.58188 141.5 5.58186L141.5 15.5819ZM226 80.1864H216V354.285H226H236V80.1864H226ZM226 354.285L218.339 347.858C192.806 378.294 162.243 391.582 141.5 391.582V401.582V411.582C169.598 411.582 205.365 394.442 233.661 360.712L226 354.285ZM141.5 401.582V391.582C100.007 391.582 20 337.67 20 208.582H10H0C0 345.493 85.9931 411.582 141.5 411.582V401.582ZM10 208.582H20C20 145.271 49.6802 99.4409 80.5083 69.1526C95.9335 53.9975 111.548 42.8451 123.616 35.51C129.649 31.8433 134.732 29.1686 138.39 27.4452C140.229 26.5784 141.625 25.9913 142.546 25.6457C143.015 25.4697 143.257 25.396 143.31 25.3808C143.653 25.2842 142.805 25.5819 141.5 25.5819L141.5 15.5819L141.5 5.58186C139.82 5.58185 138.364 5.99574 137.879 6.1324C137.106 6.35056 136.302 6.62719 135.523 6.91959C133.946 7.5108 132.031 8.33239 129.864 9.35329C125.51 11.4053 119.805 14.422 113.228 18.4193C100.077 26.4124 83.1915 38.4786 66.4917 54.8861C33.0698 87.7228 0 138.393 0 208.582H10ZM31.9289 317.511L39 324.582L230 133.582L222.929 126.511L215.858 119.44L24.8579 310.44L31.9289 317.511ZM225.929 308.582L233 301.511L43.0711 111.582L36 118.653L28.9289 125.724L218.858 315.653L225.929 308.582ZM162.536 194.046L155.464 201.117L216.464 262.117L223.536 255.046L230.607 247.975L169.607 186.975L162.536 194.046ZM190.536 168.046L183.464 175.117L216.464 208.117L223.536 201.046L230.607 193.975L197.607 160.975L190.536 168.046ZM112.071 342.653L105 335.582L39 401.582L46.0711 408.653L53.1421 415.724L119.142 349.724L112.071 342.653ZM110.999 92.7232L118.07 85.6521L54 21.5819L46.9289 28.6529L39.8579 35.724L103.928 99.7943L110.999 92.7232ZM226 15.5037L221.876 24.6138C222.482 24.8882 223.228 25.2405 224.105 25.6806L228.587 16.741L233.068 7.8014C231.96 7.24599 230.977 6.77979 230.124 6.39369L226 15.5037ZM228.587 16.741L224.105 25.6806C227.409 27.3365 232.18 29.9965 237.942 33.7158L243.365 25.3142L248.789 16.9127C242.481 12.841 237.081 9.81315 233.068 7.80139L228.587 16.741ZM243.365 25.3142L237.942 33.7158C249.469 41.1568 264.463 52.5148 279.275 67.9232L286.484 60.993L293.694 54.0627C277.647 37.3709 261.405 25.0569 248.789 16.9127L243.365 25.3142ZM286.484 60.993L279.275 67.9232C308.847 98.6849 337 144.756 337 208.136H347H357C357 138.259 325.806 87.4672 293.694 54.0627L286.484 60.993ZM347 208.136H337C337 340.588 260.18 391.13 225.891 391.504L226 401.504L226.109 411.503C275.084 410.968 357 347.404 357 208.136H347ZM226 401.504H236V15.5037H226H216V401.504H226ZM225.929 308.582L219.209 315.987L286.351 376.916L293.071 369.511L299.791 362.105L232.649 301.176L225.929 308.582Z" fill="url(#paint-gold-gradient)" />
                            </g>
                        </g>
                    </svg>
                </div>
            </div>

            <div style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 20, pointerEvents: 'none' }}>
                <div className="animate-pulse" style={{ color: 'var(--accent-amber)', opacity: 0.8, fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                    {loadingText}
                </div>
                {subtitle && (
                    <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0', textAlign: 'center', maxWidth: '90%', padding: '0 16px', paddingBottom: '8px' }}>
                        {subtitle}
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-shake {
          animation: shake 0.3s infinite;
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }
      `}} />
        </div>
    );
}


