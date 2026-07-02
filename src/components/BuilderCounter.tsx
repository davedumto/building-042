// Live scarcity counter: "042 / 300 builders". Server component reads the
// real count; the number climbing toward the cap makes the test feel exclusive.
import { getBuilderCount } from "@/app/actions";

export default async function BuilderCounter() {
  const { count, cap } = await getBuilderCount();
  const pct = Math.min(100, Math.round((count / cap) * 100));
  const remaining = Math.max(0, cap - count);

  return (
    <div className="max-w-sm">
      <div className="flex items-baseline justify-between mb-2">
        <span className="serial">
          <strong>{String(count).padStart(3, "0")}</strong> / {cap} builders
        </span>
        <span className="serial">{remaining} spots left</span>
      </div>
      <div className="rail">
        <div className="rail-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
