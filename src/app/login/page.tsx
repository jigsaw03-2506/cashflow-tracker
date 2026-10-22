import { LoginForm } from "@/components/login-form";
import { safeRedirectPath } from "@/lib/auth";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={safeRedirectPath(typeof next === "string" ? next : undefined)} />;
}
