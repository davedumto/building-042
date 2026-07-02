"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/actions";

const initial: LoginState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoFocus
          autoComplete="current-password"
        />
      </div>
      {state.error && <p className="error-text">{state.error}</p>}
      <button type="submit" className="btn btn-ink w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in →"}
      </button>
    </form>
  );
}
