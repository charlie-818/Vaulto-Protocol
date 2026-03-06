import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WaitlistSuccess } from "@/components/WaitlistSuccess";

export default async function WaitlistSuccessPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Vaulto employees get immediate access to the platform
  if (session.user.isVaultoEmployee) {
    redirect("/swap");
  }

  return <WaitlistSuccess user={session.user} />;
}
