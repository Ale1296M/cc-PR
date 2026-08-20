import { Link } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const links = (
    <>
      <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={signOut}>
        <LogOut /> Sign out
      </Button>
    </>
  );

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/70 bg-card/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link to="/" className="font-display text-xl tracking-tight md:text-2xl">
            Con Cariño PR
          </Link>
          <nav className="hidden items-center gap-3 md:flex">{links}</nav>
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm">
                <SheetHeader>
                  <SheetTitle className="font-display text-2xl">Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-8 flex flex-col gap-3">{links}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">{subtitle}</p>
        </div>
        <div className="grid gap-4 md:gap-6">{children}</div>
      </main>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card p-6 shadow-sm ${className}`}>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="type-subhead truncate">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}