import { createFileRoute, Link } from "@tanstack/react-router";
import { SignupWizard } from "@/components/auth/SignupWizard";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Create your workspace · Con Cariño PR" },
      { name: "description", content: "Set up your Con Cariño PR caregiving workspace in three steps." },
      { property: "og:title", content: "Create your workspace · Con Cariño PR" },
      { property: "og:description", content: "Account, role and workspace setup in three quick steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SignupPage() {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 md:px-8">
        <Link to="/" className="font-display text-2xl">Con Cariño PR</Link>
        <Link to="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </div>
      <main className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <SignupWizard />
      </main>
    </div>
  );
}