"use client";

import { ReactNode, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

export function ClientPageTransition({
  children,
  pageKey,
}: {
  children: ReactNode;
  pageKey: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(root, { clearProps: "all" });
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        root,
        {
          autoAlpha: 0,
          y: 18,
          scale: 0.985,
          filter: "blur(6px)",
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.42,
          ease: "power3.out",
          clearProps: "transform,filter,visibility,opacity",
        },
      );
    }, root);

    return () => context.revert();
  }, [pageKey]);

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col will-change-transform">
      {children}
    </div>
  );
}
