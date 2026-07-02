import Link from "next/link";
import OnboardingFlow from "./OnboardingFlow";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; source?: string }>;
}) {
  const { ref, source } = await searchParams;

  return (
    <main className="flex-1">
      <div className="editorial pt-8">
        <Link href="/" className="serial hover:text-ink transition-colors">
          ← The Enugu Creative Movement
        </Link>
      </div>
      <OnboardingFlow refCode={ref} source={source} />
    </main>
  );
}
