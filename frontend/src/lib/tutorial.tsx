"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/auth";

export const TUTORIAL_KEY = "tutorial_v1_step";

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  cta: string;
  finishButton?: boolean;
  noMarketFallback?: boolean;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "nav-markets",
    title: "Your markets",
    body: "These are the yes/no questions your group is betting on. Each one has live odds that shift with every trade.",
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
    body: "Tap YES if you think it'll happen — NO if you don't. Each share pays out 1 pt if you're right. Cheap shares = big upside.",
    cta: "tap YES to continue",
  },
  {
    id: "nav-board",
    title: "The leaderboard",
    body: "See who's winning across the whole group. Rankings update live with every trade.",
    cta: "tap board to continue",
  },
  {
    id: "nav-chat",
    title: "Group chat",
    body: "Talk with your group while markets are live. Good for calling your picks and the inevitable trash talk.",
    cta: "tap chat to continue",
  },
  {
    id: "nav-ideas",
    title: "Pitch a market",
    body: "Have an idea for a bet? Submit it here. Your admin reviews all pitches and posts the best ones as real markets.",
    cta: "tap ideas to continue",
  },
  {
    id: "nav-profile",
    title: "Your profile",
    body: "Track your PnL on every settled market and see your rank. This is your record — wins, losses, and everything in between.",
    cta: "tap your profile to continue",
  },
  // Admin-only steps (indices 7-8):
  {
    id: "nav-manage",
    title: "You're the admin",
    body: "You have one more tab — manage. This is where you post markets, settle them when the outcome is known, and invite your group.",
    cta: "tap manage to continue",
  },
  {
    id: "post-market-form",
    title: "Post your first market",
    body: "Type a yes/no question and hit post. Your group can start betting right away. You settle it once you know the real-world outcome.",
    cta: "you're good to go",
    finishButton: true,
  },
];

const USER_MAX_STEP  = 7; // steps 0-6 for regular members
const ADMIN_MAX_STEP = 9; // steps 0-8 for admins

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
      // Auto-start for users who've already done onboarding (e.g. existing users)
      if (typeof window !== "undefined" && localStorage.getItem("onboarding_v1_seen")) {
        localStorage.setItem(TUTORIAL_KEY, "0");
        setStep(0);
      }
      // New users: start() is called by onboarding onDone callback
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
