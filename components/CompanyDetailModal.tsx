"use client";

import { useEffect, useCallback } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ValuationChart } from "@/components/ValuationChart";
import { FundingBarChart } from "@/components/FundingBarChart";

type CompanyDetailModalProps = {
  company: PrivateCompany;
  onClose: () => void;
};

export function CompanyDetailModal({ company, onClose }: CompanyDetailModalProps) {
  // Handle ESC key to close modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const hasProducts = company.products && company.products.length > 0;
  const hasWebsite = company.website && company.website.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-background p-6">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded hover:bg-muted/50 transition-colors"
          aria-label="Close modal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 pr-8">
          <CompanyLogo name={company.name} website={company.website} size={56} />
          <div>
            <h2 className="text-xl font-semibold">{company.name}</h2>
            <p className="text-sm text-muted">
              {company.industry}
              {company.employees > 0 && ` | ${company.employees.toLocaleString()} employees`}
              {company.ceo && ` | CEO: ${company.ceo}`}
            </p>
          </div>
        </div>

        {/* Valuation Chart with Key Metrics */}
        <div className="mt-6">
          <ValuationChart company={company} />
        </div>

        {/* Funding History */}
        <div className="mt-6">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Funding History</h3>
          <FundingBarChart fundingHistory={company.fundingHistory} />
        </div>

        {/* Products section (if available) */}
        {hasProducts && (
          <div className="mt-6">
            <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Products</h3>
            <ul className="space-y-2">
              {company.products.map((product, index) => (
                <li key={index} className="text-sm">
                  <span className="font-medium">{product.name}</span>
                  {product.description && (
                    <span className="text-muted">: {product.description}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Website link */}
        {hasWebsite && (
          <div className="mt-6">
            <a
              href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded border border-border hover:bg-muted/50 transition-colors"
            >
              Visit Website
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
