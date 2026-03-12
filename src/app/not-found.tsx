import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-10 px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
const btnOutline = "border border-input bg-background hover:bg-accent hover:text-accent-foreground";
const btnDefault = "bg-primary text-primary-foreground hover:bg-primary/90";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-muted-foreground/50">404</p>
        <h1 className="text-xl font-semibold text-foreground mt-4">Seite nicht gefunden</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link href="/dashboard" className={`${btn} ${btnOutline}`}>
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Link>
          <Link href="/" className={`${btn} ${btnDefault}`}>
            <Home className="w-4 h-4" />
            Start
          </Link>
        </div>
      </div>
    </div>
  );
}
