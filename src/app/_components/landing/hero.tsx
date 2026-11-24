'use client';

// Library Import
import { ChevronDownIcon } from '@radix-ui/react-icons';
import React, { useEffect, useState } from 'react';

export default function HeroSection() {
  const [topValue, setTopValue] = useState('-20%');
  const [isMobile, setIsMobile] = useState(false);
  const [isCircleVisible, setIsCircleVisible] = useState(false);
  const [isTitleVisible, setIsTitleVisible] = useState(false);
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(false);
  const [isHeroSmaller, setIsHeroSmaller] = useState(false);

  // animasi scroll di mobile
  const slowScrollTo = (targetY: number, duration: number = 4000) => {
    const startY = window.pageYOffset;
    const distance = targetY - startY;
    const startTime = performance.now();

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      window.scrollTo(0, startY + distance * easeOutExpo);

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setTopValue('50%');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const circleAnimationTimer = setTimeout(() => {
      setIsCircleVisible(true); // slide up untuk circle
    }, 500);

    const titleAnimationTimer = setTimeout(() => {
      setIsTitleVisible(true); // slide down untuk judul
    }, 500);

    const descriptionAnimationTimer = setTimeout(() => {
      setIsDescriptionVisible(true); // slide up untuk deskripsi
    }, 800);

    // const scrollTimer = setTimeout(() => {
    //   if (isMobile) {
    //     slowScrollTo(window.innerHeight * 0.35, 1000);
    //   }
    // }, 2200);

    const resizeTimer = setTimeout(() => {
      setIsHeroSmaller(true);
    }, 2200);

    // const moveCircleUpTimer = setTimeout(() => {
    //   if (isMobile) {
    //     setTopValue('40%');
    //   }
    // }, 2400);

    return () => {
      clearTimeout(circleAnimationTimer);
      clearTimeout(titleAnimationTimer);
      clearTimeout(descriptionAnimationTimer);
      // clearTimeout(scrollTimer);
      clearTimeout(resizeTimer);
      // clearTimeout(moveCircleUpTimer);
    };
  }, [isMobile]);

  const handleScrollDown = () => {
    window.scrollTo({
      top: window.innerHeight * 0.9,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative flex w-full flex-col items-center">
      <div
        className="relative h-screen w-full transition-all duration-1000"
        style={{ height: isMobile && isHeroSmaller ? '75vh' : '100vh' }}
      >
        {/* Bigger Ellipse */}
        <div
          className={`absolute left-1/2 z-[-3] -translate-x-1/2 -translate-y-1/2 ${isMobile ? 'h-[600px] w-[600px]' : 'h-[1310px] w-[1310px]'}`}
          style={{
            top: topValue,
            borderRadius: '50%',
            border: '5px solid transparent',
            backgroundImage:
              'linear-gradient(white, white), linear-gradient(180deg, #9ACCEA 0%, #99E5E5 0%, #2488C0 18.5%, #99E5E5 47.21%, #2488C0 72.71%, #99E5E5 100%)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            opacity: isCircleVisible ? 1 : 0,
            transform: `translate(-50%, -50%) translateY(${isCircleVisible ? '0px' : '30px'})`,
            transition: 'opacity 1s ease-out, transform 1s ease-out, top 1s',
          }}
        >
          {/* Small Ellipse */}
          <div
            className={`absolute left-1/2 top-1/2 z-[0] -translate-x-1/2 -translate-y-1/2 ${isMobile ? 'h-[432px] w-[432px]' : 'h-[892px] w-[892px]'}`}
            style={{
              borderRadius: '50%',
              border: '5px solid transparent',
              backgroundImage:
                'linear-gradient(white, white), linear-gradient(180deg, rgba(154, 204, 234, 0.00) 0%, rgba(153, 229, 229, 0.00) 0%, rgba(36, 136, 192, 0.13) 18.5%, rgba(153, 229, 229, 0.50) 47.21%, rgba(36, 136, 192, 0.13) 72.71%, rgba(153, 229, 229, 0.00) 100%)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              opacity: isCircleVisible ? 1 : 0,
              transform: `translate(-50%, -50%) translateY(${isCircleVisible ? '0px' : '30px'})`,
              transition: 'opacity 1s ease-out, transform 1s ease-out',
            }}
          />

          {/* Blue Glow */}
          <div
            className={`absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 ${isMobile ? 'h-[200px] w-[200px]' : 'h-[412px] w-[412px]'}`}
            style={{
              borderRadius: '50%',
              opacity: isCircleVisible ? (isMobile ? 0.6 : 0.45) : 0,
              background: '#06A5FF',
              filter: isMobile ? 'blur(120px)' : 'blur(196.8px)',
              transform: `translate(-50%, -50%) translateY(${isCircleVisible ? '0px' : '30px'})`,
              transition: 'opacity 1s ease-out, transform 1s ease-out',
            }}
          />

          {/* Text */}
          <div
            className="absolute left-1/2 top-1/2 z-[2] w-full -translate-x-1/2 -translate-y-1/2 transition-all duration-1000"
            // style={{ top: isMobile && isHeroSmaller ? '65%' : '50%' }}
          >
            <div className="w-full px-6 sm:px-8 lg:px-12">
              <div className="flex flex-col items-center justify-center gap-6 text-center sm:gap-8 lg:gap-10">
                <h1
                  className="max-w-[90vw] text-3xl font-medium leading-tight tracking-tight sm:max-w-full sm:text-4xl md:text-5xl lg:text-7xl"
                  style={{
                    opacity: isTitleVisible ? 1 : 0,
                    transform: `translateY(${isTitleVisible ? '0px' : '-40px'})`,
                    transition:
                      'opacity 0.8s ease-out, transform 0.8s ease-out',
                  }}
                >
                  <span className="block">Pendataan Kemahasiswaan</span>
                  <span className="mt-1 block bg-gradient-to-b from-[#0B5C8A] to-[#00B7B7] bg-clip-text text-transparent sm:mt-2 lg:mt-3">
                    Terintegrasi
                  </span>
                </h1>

                {/* Description */}
                <p
                  className="max-w-xs text-balance px-2 text-base sm:max-w-lg sm:px-4 sm:text-lg lg:max-w-2xl lg:px-6 lg:text-xl"
                  style={{
                    opacity: isDescriptionVisible ? 1 : 0,
                    transform: `translateY(${isDescriptionVisible ? '0px' : '40px'})`,
                    transition:
                      'opacity 0.8s ease-out, transform 0.8s ease-out',
                  }}
                >
                  Cari kegiatan, lembaga, atau anggota KM ITB yang Anda inginkan
                  sekarang
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      {!isMobile && (
        <button
          onClick={handleScrollDown}
          className="group relative z-10 -mt-16 cursor-pointer text-gray-500 transition-colors hover:text-gray-700 sm:-mt-24 lg:-mt-32"
          aria-label="Scroll untuk lanjut"
        >
          <div className="flex animate-bounce flex-col items-center gap-1 sm:gap-2">
            <span className="text-sm font-medium">Scroll untuk lanjut</span>
            <ChevronDownIcon className="h-6 w-6" />
          </div>
        </button>
      )}
    </div>
  );
}
