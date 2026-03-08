import { IPOValuationCard } from "./IPOValuationCard";
import { IPOBandPositions } from "./IPOBandPositions";
import type { CompanyIPO } from "@/lib/polymarket/ipo-valuations";

type IPOValuationListProps = {
  ipos: CompanyIPO[];
};

export function IPOValuationList({ ipos }: IPOValuationListProps) {
  return (
    <>
      {/* User Positions */}
      <IPOBandPositions ipos={ipos} />

      {/* IPO Cards */}
      <div className="mt-6 space-y-6">
        {ipos.map((ipo) => (
          <IPOValuationCard key={ipo.eventSlug} ipo={ipo} />
        ))}
      </div>
    </>
  );
}
