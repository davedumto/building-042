import Link from "next/link";
import { Suspense } from "react";
import BuilderCounter from "@/components/BuilderCounter";

// The HOOK. "Who Is Building Enugu?" — the campaign question that drives
// everything. Warm Editorial: huge asymmetric headline, air, green pills.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; source?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.ref) query.set("ref", params.ref);
  if (params.source) query.set("source", params.source);
  const joinHref = `/join${query.toString() ? `?${query.toString()}` : ""}`;

  return (
    <main className="flex-1">
      {/* ---------- HERO ---------- */}
      <section className="editorial pt-16 sm:pt-24 pb-20">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-end">
          <div className="rise">
            <span className="pill mb-8">THE BIG IDEA</span>
            <h1 className="display display-xl mt-6">
              Who is
              <br />
              building
              <br />
              <span className="text-green">Enugu?</span>
            </h1>
            <p className="mt-8 text-lg sm:text-xl text-ink-soft max-w-xl leading-relaxed">
              We are not launching a community. We are launching a movement.
              Rankings, competitions, real results, and a mission bigger than
              any event. This is how we own attention instead of competing for
              it.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href={joinHref} className="btn btn-primary">
                Claim your spot →
              </Link>
              <span className="serial">Builder No. ???? / Enugu, yours next</span>
            </div>

            <div className="mt-12">
              <Suspense
                fallback={<div className="serial">Loading the count…</div>}
              >
                <BuilderCounter />
              </Suspense>
            </div>
          </div>

          {/* Right column: who a "builder" is */}
          <div className="rise space-y-3" style={{ animationDelay: "80ms" }}>
            <BuilderTag accent="green">
              The designer. The fashion entrepreneur. The makeup artist. The
              photographer.
            </BuilderTag>
            <BuilderTag accent="ink">
              The writer. The startup founder. The student entrepreneur. The
              marketer.
            </BuilderTag>
            <BuilderTag accent="blue">
              A creative is anyone willing and able to build something. That
              definition is our edge.
            </BuilderTag>
          </div>
        </div>
      </section>

      {/* ---------- VALUE STRIP ---------- */}
      <section className="border-t border-line bg-base-deep/40">
        <div className="editorial py-16">
          <span className="pill pill-blue">POSITIONING</span>
          <h2 className="display display-md mt-6 max-w-3xl">
            We don&apos;t teach people how to post. We teach them how to build.
          </h2>
          <div className="grid sm:grid-cols-3 gap-8 mt-12">
            <ValueCard title="What we teach">
              Revenue, clients, partnerships, and opportunity. Never vanity
              metrics.
            </ValueCard>
            <ValueCard title="What you walk away with">
              The confidence, and the network, to grow a real creative business
              in Enugu.
            </ValueCard>
            <ValueCard title="Our authority">
              We back it with data, rankings, real results, and the Enugu
              Creative Report.
            </ValueCard>
          </div>
        </div>
      </section>

      {/* ---------- CLOSING CTA ---------- */}
      <section className="editorial py-20 text-center">
        <h2 className="display display-lg max-w-3xl mx-auto">
          Find the builders. Put them in the same room.
        </h2>
        <div className="mt-8">
          <Link href={joinHref} className="btn btn-ink">
            I&apos;m building Enugu →
          </Link>
        </div>
      </section>

      <footer className="editorial py-10 border-t border-line">
        <p className="serial">
          THE ENUGU CREATIVE MOVEMENT · Go To Market &amp; Execution
        </p>
      </footer>
    </main>
  );
}

function BuilderTag({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: "green" | "ink" | "blue";
}) {
  const bg =
    accent === "green"
      ? "bg-green text-white"
      : accent === "ink"
        ? "bg-ink text-base"
        : "bg-muted/80 text-white";
  return (
    <div
      className={`${bg} rounded-2xl rounded-tl-sm px-5 py-4 text-base leading-relaxed`}
    >
      {children}
    </div>
  );
}

function ValueCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold mb-2">
        {title}
      </h3>
      <p className="text-muted leading-relaxed">{children}</p>
    </div>
  );
}
