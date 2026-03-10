"use client";

import { useEffect, useState } from "react";

interface LegalLinkProps {
  type: "privacy" | "terms";
  className?: string;
  children: React.ReactNode;
}

const LEGAL_URLS = {
  privacy: {
    page: "https://legal.vaulto.ai/privacy-policy",
    pdf: "https://legal.vaulto.ai/Vaulto%20Privacy%20Policy.pdf",
  },
  terms: {
    page: "https://legal.vaulto.ai/terms-of-service",
    pdf: "https://legal.vaulto.ai/Vaulto%20Terms%20of%20Service.pdf",
  },
};

export function LegalLink({ type, className, children }: LegalLinkProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile using multiple signals:
      // 1. Touch capability
      // 2. Screen width
      // 3. User agent patterns for mobile devices
      const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      // Consider it mobile if it's a small screen OR has mobile user agent
      // Touch alone isn't enough as laptops can have touch screens
      setIsMobile(isSmallScreen || mobileUserAgent);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const urls = LEGAL_URLS[type];
  // On mobile, link directly to PDF for better compatibility
  const href = isMobile ? urls.pdf : urls.page;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
