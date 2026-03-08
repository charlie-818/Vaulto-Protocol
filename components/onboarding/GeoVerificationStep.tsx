"use client";

import { useState } from "react";
import { MapPin, Shield, AlertCircle, Loader2 } from "lucide-react";

interface GeoVerificationStepProps {
  onComplete: () => void;
  onBlocked: (reason: string) => void;
}

export function GeoVerificationStep({
  onComplete,
  onBlocked,
}: GeoVerificationStepProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [declarationText, setDeclarationText] = useState("");
  const [declaredCountry, setDeclaredCountry] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/geo-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (data.blocked) {
        onBlocked(data.reason);
        return;
      }

      if (data.requiresDeclaration) {
        setDeclarationText(data.declarationText);
        setShowDeclaration(true);
      } else {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignDeclaration = async () => {
    if (!declaredCountry) {
      setError("Please select your country of residence");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Generate a signature hash from the declaration
      const encoder = new TextEncoder();
      const data = encoder.encode(declarationText + declaredCountry + Date.now());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signatureHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const response = await fetch("/api/onboarding/geo-verify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          declaredNonUs: true,
          declaredCountry,
          signatureHash,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Declaration failed");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsVerifying(false);
    }
  };

  if (showDeclaration) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-foreground" />
          <h2 className="mt-4 text-2xl font-semibold">Non-US Investor Declaration</h2>
          <p className="mt-2 text-muted">
            Please confirm that you are not a U.S. Person
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="max-h-64 overflow-y-auto text-sm text-muted whitespace-pre-wrap">
            {declarationText}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Country of Residence
          </label>
          <select
            value={declaredCountry}
            onChange={(e) => setDeclaredCountry(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
          >
            <option value="">Select your country</option>
            <option value="GB">United Kingdom</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="JP">Japan</option>
            <option value="SG">Singapore</option>
            <option value="HK">Hong Kong</option>
            <option value="AU">Australia</option>
            <option value="CA">Canada</option>
            <option value="CH">Switzerland</option>
            <option value="NL">Netherlands</option>
            <option value="OTHER">Other (Non-US)</option>
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="confirm-declaration"
            className="mt-1 h-5 w-5 rounded border-border"
            required
          />
          <label htmlFor="confirm-declaration" className="text-sm text-muted">
            I have read and agree to the above declaration. I confirm under penalty of
            perjury that I am not a U.S. Person and I am not acquiring tokens for the
            account or benefit of any U.S. Person.
          </label>
        </div>

        <button
          onClick={handleSignDeclaration}
          disabled={isVerifying || !declaredCountry}
          className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isVerifying ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Submitting...
            </span>
          ) : (
            "Sign Declaration & Continue"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <MapPin className="mx-auto h-12 w-12 text-foreground" />
        <h2 className="mt-4 text-2xl font-semibold">Location Verification</h2>
        <p className="mt-2 text-muted">
          We need to verify your location to ensure compliance with Regulation S
        </p>
      </div>

      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">What we check:</h3>
        <ul className="space-y-3 text-sm text-muted">
          <li className="flex items-start gap-3">
            <Shield className="h-5 w-5 flex-shrink-0 text-green-500" />
            <span>Your geographic location based on your IP address</span>
          </li>
          <li className="flex items-start gap-3">
            <Shield className="h-5 w-5 flex-shrink-0 text-green-500" />
            <span>VPN, proxy, or Tor usage detection</span>
          </li>
          <li className="flex items-start gap-3">
            <Shield className="h-5 w-5 flex-shrink-0 text-green-500" />
            <span>Compliance with restricted jurisdictions</span>
          </li>
        </ul>
      </div>

      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-700 dark:text-amber-400">
        <p className="text-sm">
          <strong>Important:</strong> This platform is not available to U.S. Persons or
          residents of sanctioned countries. Using a VPN to bypass geographic restrictions
          is prohibited and may result in account termination.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={isVerifying}
        className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isVerifying ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifying...
          </span>
        ) : (
          "Verify My Location"
        )}
      </button>
    </div>
  );
}
