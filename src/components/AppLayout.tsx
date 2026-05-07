import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Wrench, Users, Package, CalendarDays, BarChart3, LogOut, Menu, X, ShieldCheck } from "lucide-react";
import { useRole } from "@/hooks/use-role";

const navAll = [
  { to: "/", label: "Chamados", icon: LayoutDashboard, end: true, staffOnly: false },
  { to: "/clients", label: "Clientes", icon: Users, staffOnly: false },
  { to: "/parts", label: "Estoque", icon: Package, staffOnly: false },
  { to: "/reminders", label: "Agenda", icon: CalendarDays, staffOnly: false },
  { to: "/reports", label: "Relatórios", icon: BarChart3, staffOnly: true },
  { to: "/team", label: "Equipe", icon: ShieldCheck, staffOnly: true },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/auth", { replace: true });
      else setEmail(session.user.email ?? "");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth", { replace: true });
      else setEmail(data.session.user.email ?? "");
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:flex-col w-60 border-r border-sidebar-border bg-sidebar p-4 sticky top-0 h-screen">
        <Brand />
        <NavList />
        <Footer email={email} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 border-b border-border bg-background/85 backdrop-blur-md flex items-center justify-between px-4">
        <Brand compact />
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}><Menu className="w-5 h-5" /></Button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border p-4 flex flex-col">
            <div className="flex items-center justify-between">
              <Brand />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div onClick={() => setOpen(false)}><NavList /></div>
            <Footer email={email} />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1 mb-6">
      <div className="w-9 h-9 rounded-xl gradient-brand grid place-items-center glow-brand">
        <Wrench className="w-4 h-4 text-primary-foreground" />
      </div>
      {!compact && (
        <div>
          <div className="font-display font-semibold text-base tracking-tight">FixFlow</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">OS · Gestão</div>
        </div>
      )}
    </div>
  );
}

function NavList() {
  const { isStaff } = useRole();
  const items = navAll.filter((n) => !n.staffOnly || isStaff);
  return (
    <nav className="flex-1 flex flex-col gap-0.5">
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
            }`
          }
        >
          <n.icon className="w-4 h-4" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Footer({ email }: { email: string }) {
  return (
    <div className="mt-4 pt-4 border-t border-sidebar-border space-y-2">
      <div className="text-[11px] text-muted-foreground truncate px-1">{email}</div>
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => supabase.auth.signOut()}>
        <LogOut className="w-4 h-4" /> Sair
      </Button>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
