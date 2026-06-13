import { Link } from "react-router-dom";
import { LandingNav } from "@/components/landing/LandingNav";
import { WelcomeFeedbackSection } from "@/components/landing/WelcomeFeedbackSection";
import { NodentWordmark } from "@/components/branding/NodentWordmark";

export default function FeedbackPage() {
  return (
    <div className="landing-root min-h-screen bg-[#f8fbff] text-[#0b0f19]">
      <LandingNav />
      <main className="pt-24">
        <WelcomeFeedbackSection visible />
      </main>
      <footer className="border-t border-slate-200/80 py-10 text-center">
        <NodentWordmark size="sm" variant="onCream" className="mx-auto" />
        <p className="mt-4 text-sm text-slate-500">
          <Link to="/" className="hover:text-brand-dark">
            Back to Nodent
          </Link>
        </p>
      </footer>
    </div>
  );
}
