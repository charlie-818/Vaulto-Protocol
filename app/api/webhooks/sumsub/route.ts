import { NextResponse } from "next/server";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  verifyWebhookSignature,
  parseWebhookPayload,
  mapReviewStatus,
} from "@/lib/onboarding/sumsub";
import { auditHelpers } from "@/lib/onboarding/audit";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const dbError = requireDatabase();
    if (dbError) return dbError;

    const rawBody = await request.text();
    const signature = request.headers.get("x-payload-digest") || "";

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature);

    // Parse webhook payload
    const payload = parseWebhookPayload(rawBody);

    // Store webhook for audit
    const webhookRecord = await getDb().sumsubWebhook.create({
      data: {
        webhookId: crypto.randomUUID(),
        applicantId: payload.applicantId,
        eventType: payload.type,
        reviewStatus: payload.reviewStatus,
        reviewResult: payload.reviewResult
          ? JSON.stringify(payload.reviewResult)
          : null,
        rawPayload: rawBody,
        signatureValid: isValid,
      },
    });

    // If signature is invalid, log but don't process
    if (!isValid) {
      console.error("Invalid Sumsub webhook signature");
      await getDb().sumsubWebhook.update({
        where: { id: webhookRecord.id },
        data: {
          processingError: "Invalid signature",
          processedAt: new Date(),
        },
      });
      // Still return 200 to prevent retries
      return NextResponse.json({ received: true });
    }

    // Find the user by applicant ID
    const kycVerification = await getDb().kycVerification.findUnique({
      where: { sumsubApplicantId: payload.applicantId },
      include: { user: true },
    });

    if (!kycVerification) {
      console.error(`KYC verification not found for applicant: ${payload.applicantId}`);
      await getDb().sumsubWebhook.update({
        where: { id: webhookRecord.id },
        data: {
          processingError: "KYC verification not found",
          processedAt: new Date(),
        },
      });
      return NextResponse.json({ received: true });
    }

    // Process webhook based on event type
    switch (payload.type) {
      case "applicantCreated":
        // Applicant created - no action needed
        break;

      case "applicantPending":
        // Documents submitted, waiting for review
        await getDb().kycVerification.update({
          where: { id: kycVerification.id },
          data: {
            status: "IN_REVIEW",
            submittedAt: new Date(),
          },
        });
        await getDb().user.update({
          where: { id: kycVerification.userId },
          data: { onboardingStatus: "KYC_IN_REVIEW" },
        });
        await auditHelpers.kycSubmitted(
          kycVerification.userId,
          kycVerification.id
        );
        break;

      case "applicantReviewed":
        // Review completed
        const newStatus = mapReviewStatus(
          payload.reviewStatus || "",
          payload.reviewResult?.reviewAnswer
        );

        await getDb().kycVerification.update({
          where: { id: kycVerification.id },
          data: {
            status: newStatus,
            reviewResult: payload.reviewResult
              ? JSON.stringify(payload.reviewResult)
              : null,
            reviewedAt: new Date(),
            documentVerified: payload.reviewResult?.reviewAnswer === "GREEN",
            livenessVerified: payload.reviewResult?.reviewAnswer === "GREEN",
            amlScreeningPassed: payload.reviewResult?.reviewAnswer === "GREEN",
          },
        });

        if (newStatus === "APPROVED") {
          await getDb().user.update({
            where: { id: kycVerification.userId },
            data: { onboardingStatus: "KYC_APPROVED" },
          });
          await auditHelpers.kycApproved(
            kycVerification.userId,
            kycVerification.id,
            payload.reviewResult
          );
        } else if (newStatus === "REJECTED") {
          await getDb().user.update({
            where: { id: kycVerification.userId },
            data: { onboardingStatus: "KYC_REJECTED" },
          });
          await auditHelpers.kycRejected(
            kycVerification.userId,
            kycVerification.id,
            payload.reviewResult?.rejectLabels?.join(", ") || "Unknown reason",
            payload.reviewResult
          );
        }
        break;

      case "applicantOnHold":
        // Application on hold - treat as in review
        await getDb().kycVerification.update({
          where: { id: kycVerification.id },
          data: { status: "IN_REVIEW" },
        });
        break;

      case "applicantActionPending":
        // Action required from applicant
        // Could send notification here
        break;

      case "applicantDeleted":
        // Applicant deleted - mark as expired
        await getDb().kycVerification.update({
          where: { id: kycVerification.id },
          data: { status: "EXPIRED" },
        });
        break;

      default:
        console.log(`Unhandled Sumsub webhook type: ${payload.type}`);
    }

    // Mark webhook as processed
    await getDb().sumsubWebhook.update({
      where: { id: webhookRecord.id },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Sumsub webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
