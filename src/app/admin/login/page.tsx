import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function AdminLoginPage() {
  if (await isAuthed()) redirect("/admin");

  return (
    <main className="editorial py-24 max-w-md">
      <span className="pill pill-ink">ADMIN</span>
      <h1 className="display display-md mt-6 mb-2">Sign in</h1>
      <p className="text-muted mb-8">
        The Enugu Creative Movement — builders dashboard.
      </p>
      <LoginForm />
    </main>
  );
}
