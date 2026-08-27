import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layers3, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f7f8fa] px-4">
      <Card className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <CardContent className="p-8 text-center sm:p-12">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            <Layers3 className="h-6 w-6" />
          </div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Рабочая область SiteCraft</p>

          <h1 className="mb-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">404</h1>

          <h2 className="mb-4 text-xl font-semibold text-slate-700">
            Эта страница недоступна
          </h2>

          <p className="mb-8 leading-relaxed text-slate-500">
            Страница могла быть перемещена, удалена или не относится к этой рабочей области.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="min-h-11 rounded-xl bg-slate-950 px-6 text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              <Home className="w-4 h-4 mr-2" />
              На главную
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
