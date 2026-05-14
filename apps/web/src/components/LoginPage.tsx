import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Boxes, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

interface LoginLocationState {
  from?: {
    pathname: string;
    search: string;
  };
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LoginLocationState | null;
  const redirectTo = state?.from ? `${state.from.pathname}${state.from.search}` : "/";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await login(username.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch {
      setError("Username or password is incorrect.");
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7FAF8] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#00684A] text-white shadow-[0_12px_24px_rgba(0,104,74,0.2)]">
            <Boxes size={24} />
          </div>
          <div>
            <p className="text-2xl font-medium text-[#10231B]">Aeroventory</p>
            <p className="text-sm font-semibold text-[#5B6B63]">Inventory Core Console</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your inventory account to open the workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">Username</span>
                <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">Password</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>

              <Button type="submit" size="lg" className="w-full" disabled={loading || !username.trim() || !password}>
                <LogIn size={18} />
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
