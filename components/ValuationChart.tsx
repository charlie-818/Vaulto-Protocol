"use client";

import type { PrivateCompany, FundingRound } from "@/lib/vaulto/companies";
import { formatValuation, formatPricePerShare } from "@/lib/vaulto/companies";

type ValuationChartProps = {
  company: PrivateCompany;
};

interface DataPoint {
  date: Date;
  value: number;
  label: string;
}

function extractDataPoints(fundingHistory: FundingRound[]): DataPoint[] {
  return fundingHistory
    .filter(
      (round): round is FundingRound & { postMoneyValuationUsd: number } =>
        round.postMoneyValuationUsd !== undefined &&
        round.postMoneyValuationUsd !== null
    )
    .map((round) => ({
      date: new Date(round.date),
      value: round.postMoneyValuationUsd,
      label: round.type,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Create smooth curve using Catmull-Rom spline converted to cubic bezier
function createSmoothPath(
  points: { x: number; y: number }[],
  tension: number = 0.3
): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + ((p2.x - p0.x) * tension);
    const cp1y = p1.y + ((p2.y - p0.y) * tension);
    const cp2x = p2.x - ((p3.x - p1.x) * tension);
    const cp2y = p2.y - ((p3.y - p1.y) * tension);

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
}

export function ValuationChart({ company }: ValuationChartProps) {
  const points = extractDataPoints(company.fundingHistory);
  const hasData = points.length >= 2;

  // Chart dimensions
  const height = 200;
  const paddingTop = 20;
  const paddingBottom = 30;
  const paddingLeft = 60;
  const paddingRight = 20;

  // Calculate chart bounds
  const chartHeight = height - paddingTop - paddingBottom;

  // Get max value, always start from 0
  const values = points.map((p) => p.value);
  const maxVal = Math.max(...values);

  // Chart range: 0 to max with 10% padding on top
  const paddedMin = 0;
  const paddedMax = maxVal * 1.1;
  const paddedRange = paddedMax - paddedMin;

  // Generate Y-axis labels (4 labels from 0 to max)
  const yLabels: number[] = [];
  const step = paddedRange / 3;
  for (let i = 0; i <= 3; i++) {
    yLabels.push(step * i);
  }

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="w-full bg-muted/10 rounded-lg p-4">
        {hasData ? (
          <svg
            viewBox={`0 0 600 ${height}`}
            className="w-full"
            preserveAspectRatio="none"
            style={{ height: `${height}px` }}
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Y-axis labels */}
            {yLabels.map((val, i) => {
              const y =
                paddingTop +
                chartHeight -
                ((val - paddedMin) / paddedRange) * chartHeight;
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={580}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeDasharray="4,4"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted text-[10px]"
                  >
                    {val === 0 ? "$0" : formatValuation(val)}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            {(() => {
              const minTime = points[0].date.getTime();
              const maxTime = points[points.length - 1].date.getTime();
              const timeRange = maxTime - minTime || 1;
              const chartWidth = 580 - paddingLeft;

              const chartPoints = points.map((p) => ({
                x:
                  paddingLeft +
                  ((p.date.getTime() - minTime) / timeRange) * chartWidth,
                y:
                  paddingTop +
                  chartHeight -
                  ((p.value - paddedMin) / paddedRange) * chartHeight,
              }));

              const linePath = createSmoothPath(chartPoints);
              const areaPath =
                linePath +
                ` L ${chartPoints[chartPoints.length - 1].x},${paddingTop + chartHeight}` +
                ` L ${chartPoints[0].x},${paddingTop + chartHeight} Z`;

              return (
                <>
                  <path d={areaPath} fill="url(#areaGradient)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              );
            })()}

            {/* Data points */}
            {(() => {
              const minTime = points[0].date.getTime();
              const maxTime = points[points.length - 1].date.getTime();
              const timeRange = maxTime - minTime || 1;
              const chartWidth = 580 - paddingLeft;

              return points.map((p, i) => {
                const x =
                  paddingLeft +
                  ((p.date.getTime() - minTime) / timeRange) * chartWidth;
                const y =
                  paddingTop +
                  chartHeight -
                  ((p.value - paddedMin) / paddedRange) * chartHeight;

                return (
                  <g key={i}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#6366f1"
                      stroke="white"
                      strokeWidth="2"
                    />
                    {/* X-axis date label */}
                    {(i === 0 ||
                      i === points.length - 1 ||
                      points.length <= 5) && (
                      <text
                        x={x}
                        y={height - 8}
                        textAnchor="middle"
                        className="fill-muted text-[10px]"
                      >
                        {formatDateShort(p.date)}
                      </text>
                    )}
                  </g>
                );
              });
            })()}
          </svg>
        ) : (
          <div
            className="flex items-center justify-center text-muted text-sm"
            style={{ height: `${height}px` }}
          >
            Insufficient valuation data
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-muted/10 rounded-lg p-3">
          <p className="text-xs text-muted uppercase tracking-wide">
            Current Valuation
          </p>
          <p className="text-lg font-semibold mt-1">
            {formatValuation(company.valuationUsd)}
          </p>
        </div>
        <div className="bg-muted/10 rounded-lg p-3">
          <p className="text-xs text-muted uppercase tracking-wide">
            Total Funding
          </p>
          <p className="text-lg font-semibold mt-1">
            {formatValuation(company.totalFundingUsd)}
          </p>
        </div>
        <div className="bg-muted/10 rounded-lg p-3">
          <p className="text-xs text-muted uppercase tracking-wide">
            Last Round
          </p>
          <p className="text-lg font-semibold mt-1">
            {company.lastFundingRoundType || "—"}
          </p>
          {company.lastFundingDate && (
            <p className="text-xs text-muted">
              {formatDateLong(new Date(company.lastFundingDate))}
            </p>
          )}
        </div>
        <div className="bg-muted/10 rounded-lg p-3">
          <p className="text-xs text-muted uppercase tracking-wide">
            Price/Share
          </p>
          <p className="text-lg font-semibold mt-1">
            {formatPricePerShare(company.lastFundingEstPricePerShareUsd)}
          </p>
        </div>
      </div>
    </div>
  );
}
