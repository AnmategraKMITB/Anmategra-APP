'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';

export default function LayoutCarouselBestStaff({
  children,
  itemCount = 0,
}: {
  children: React.ReactNode;
  itemCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollLeft = () => {
    containerRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    containerRef.current?.scrollBy({ left: 300, behavior: 'smooth' });
  };

  const showNavigation = isMobile ? itemCount > 1 : itemCount > 4;

  const wrappedChildren = React.Children.map(children, (child) => (
    <div className="shrink-0 snap-start">{child}</div>
  ));

  return (
    <div className="relative w-full">
      {showNavigation && (
        <Button
          variant="light_blue"
          size="icon"
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-[8px] shadow sm:left-1"
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}
      <div
        ref={containerRef}
        className="flex justify-start gap-4 overflow-x-hidden scroll-smooth pb-4"
      >
        {wrappedChildren}
      </div>
      {showNavigation && (
        <Button
          variant="light_blue"
          size="icon"
          onClick={scrollRight}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-[8px] shadow sm:right-1"
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
