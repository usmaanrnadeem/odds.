"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/auth";

export const TUTORIAL_KEY = "tutorial_v1_step";

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  cta?: string;            // shown below tooltip when element click is required
  nextButton?: boolean;    // show "next →" button (no element click needed)
  finishButton?: boolean;  // show "done ✓" or "next →" depending on isLast
  noSpotlight?: boolean;   // floating bottom card, no dim, full page visible
  noMarketFallback?: boolean; // show demo card if market-card element not found
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "nav-markets",
    title: "Your markets",
    body: "This is where all the action is. Each card is a yes/no question your group is betting on — live odds, real stakes.",
    cta: "tap markets to continue",
  },
  {
    id: "market-card-first",
    title: "Open a market",
    body: "Tap any market to see the live odds and place a bet. The % shows what the group collectively thinks will happen.",
    cta: "tap the market to continue",
    noMarketFallback: true,
  },
  {
    id: "yes-button",
    title: "Place a bet",
    body: "Tap YES if you think it'll happen — NO if you don't. Each share pays 1 pt if you're right. Cheap shares = big upside.",
    cta: "tap YES to continue",
  },
  {
    id: "nav-board",
    title: "The leaderboard",
    body: "See who's winning. Rankings update live with every trade.",
    cta: "tap board to continue",
  },
  {
    id: "landing-board",
    title: "Rankings, live",
    body: "Every trade across the group shifts the standings in real time. The person at the top is making the right calls.",
    nextButton: true,
    noSpotlight: true,
  },
  {
    id: "nav-chat",
    title: "Group chat",
    body: "Talk with your group while markets are live. Call your picks.",
    cta: "tap chat to continue",
  },
  {
    id: "landing-chat",
    title: "Chat",
    body: "Message your group in real time. Good for trash talk, calling your picks, and arguing about the odds.",
    nextButton: true,
    noSpotlight: true,
  },
  {
    id: "nav-ideas",
    title: "Pitch a market",
    body: "Got an idea for a bet? Submit it here — your admin picks the best ones to post.",
    cta: "tap ideas to continue",
  },
  {
    id: "landing-ideas",
    title: "Market ideas",
    body: "Anyone in the group can pitch a market. The admin reviews them and posts the best ones. Your ideas become real bets.",
    nextButton: true,
    noSpotlight: true,
  },
  {
    id: "nav-profile",
    title: "Your profile",
    body: "Track your PnL on every settled market and see your rank.",
    cta: "tap your profile to continue",
  },
  {
    id: "landing-profile",
    title: "Your record",
    body: "Every market you traded shows here — what you made or lost. This is how you know if your instincts are any good.",
    finishButton: true,
    noSpotlight: true,
  },
  // Admin-only steps (11-12):
  {
    id: "nav-manage",
    title: "One more thing",
    body: "You're also the admin. The manage tab is where you post markets, settle them once you know the outcome, and invite people.",
    cta: "tap manage to continue",
  },
  {
    id: "post-market-form",
    title: "Post your first market",
    body: "Type a yes/no question and hit post. Your group can start betting immediately. You settle it once you know the real-world outcome.",
    finishButton: true,
  },
];

const USER_MAX_STEP  = 11; // steps 0-10
const ADMIN_MAX_STEP = 13; // steps 0-12

type TutorialContextType = {
  step: number;
  isActive: boolean;
  currentStep: TutorialStep | null;
  totalSteps: number;
  start: () => void;
  advance: () => void;
  skipSteps: (n: number) => void;
  skipAll: () => void;
  reset: () => void;
};

const Ctx = createContext<TutorialContextType>({
  step: -1, isActive: false, currentStep: null, totalSteps: USER_MAX_STEP,
  start: () => {}, advance: () => {}, skipSteps: () => {}, skipAll: () => {}, reset: () => {},
});

export const useTutorial = () => useContext(Ctx);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [step, setStep] = useState(-1);

  const maxStep = user?.group_role === "admin" ? ADMIN_MAX_STEP : USER_MAX_STEP;

  useEffect(() => {
    if (!user?.group_id) return;
    const saved = localStorage.getItem(TUTORIAL_KEY);
    if (saved === null) {
      // Auto-start for users who've already done onboarding (returning users)
      if (typeof window !== "undefined" && localStorage.getItem("onboarding_v1_seen")) {
        localStorage.setItem(TUTORIAL_KEY, "0");
        setStep(0);
      }
      // New users: start() is called from onboarding onDone
    } else {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= 0 && n < maxStep) setStep(n);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  const start = useCallback(() => {
    if (typeof window !== "undefined" && localStorage.getItem(TUTORIAL_KEY) !== null) return;
    localStorage.setItem(TUTORIAL_KEY, "0");
    setStep(0);
  }, []);

  const advance = useCallback(() => {
    setStep(prev => {
      const next = prev + 1;
      if (next >= maxStep) {
        localStorage.setItem(TUTORIAL_KEY, String(maxStep));
        return -1;
      }
      localStorage.setItem(TUTORIAL_KEY, String(next));
      return next;
    });
  }, [maxStep]);

  const skipSteps = useCallback((n: number) => {
    setStep(prev => {
      const next = prev + n;
      if (next >= maxStep) {
        localStorage.setItem(TUTORIAL_KEY, String(maxStep));
        return -1;
      }
      localStorage.setItem(TUTORIAL_KEY, String(next));
      return next;
    });
  }, [maxStep]);

  const skipAll = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, String(maxStep));
    setStep(-1);
  }, [maxStep]);

  const reset = useCallback(() => {
    localStorage.removeItem(TUTORIAL_KEY);
    localStorage.setItem(TUTORIAL_KEY, "0");
    setStep(0);
  }, []);

  const isActive = step >= 0 && step < TUTORIAL_STEPS.length;
  const currentStep = isActive ? TUTORIAL_STEPS[step] : null;

  return (
    <Ctx.Provider value={{ step, isActive, currentStep, totalSteps: maxStep, start, advance, skipSteps, skipAll, reset }}>
      {children}
    </Ctx.Provider>
  );
}
