import { API_BASE_URL } from "@/constants/api";
import { kvStorage, StorageKeys } from "./storage";

export interface MobileUserSession {
  userId: string;
  phoneNumber: string;
  fullName: string;
  role: string;
  companyId?: string | null;
  stationId?: string | null;
  token: string;
}


export function isPompiste(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === "pumpattendant" || r === "pompiste";
}

export function isCashier(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === "stationcashier" || r === "cashier" || r === "caissiere";
}

export function isFleetManager(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === "client" || r === "fleetmanager";
}


type AuthListener = (user: MobileUserSession | null) => void;
type OnboardingListener = (hasSeen: boolean) => void;

class MobileAuthService {
  private currentUser: MobileUserSession | null = null;
  private hasSeenOnboardingState = false;
  private authListeners: Set<AuthListener> = new Set();
  private onboardingListeners: Set<OnboardingListener> = new Set();

  constructor() {
    this.hydrate();
  }

  private hydrate() {
    try {
      this.hasSeenOnboardingState = kvStorage.getBoolean(
        StorageKeys.HAS_SEEN_ONBOARDING,
        false,
      );
      const savedUser = kvStorage.getObject<MobileUserSession>(
        StorageKeys.AUTH_SESSION,
      );
      if (savedUser && savedUser.token) {
        this.currentUser = savedUser;
      }
    } catch (err) {
      console.warn("Error hydrating auth state:", err);
    }
  }

  getUser(): MobileUserSession | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  hasSeenOnboarding(): boolean {
    return this.hasSeenOnboardingState;
  }

  completeOnboarding() {
    this.hasSeenOnboardingState = true;
    kvStorage.setBoolean(StorageKeys.HAS_SEEN_ONBOARDING, true);
    this.notifyOnboarding();
  }

  resetOnboarding() {
    this.hasSeenOnboardingState = false;
    kvStorage.setBoolean(StorageKeys.HAS_SEEN_ONBOARDING, false);
    this.notifyOnboarding();
  }

  subscribe(listener: AuthListener): () => void {
    this.authListeners.add(listener);
    listener(this.currentUser);
    return () => this.authListeners.delete(listener);
  }

  subscribeOnboarding(listener: OnboardingListener): () => void {
    this.onboardingListeners.add(listener);
    listener(this.hasSeenOnboardingState);
    return () => this.onboardingListeners.delete(listener);
  }

  private notifyAuth() {
    this.authListeners.forEach((fn) => fn(this.currentUser));
  }

  private notifyOnboarding() {
    this.onboardingListeners.forEach((fn) => fn(this.hasSeenOnboardingState));
  }

  async login(
    phone: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone.trim(), password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          this.currentUser = {
            userId: data.userId,
            phoneNumber: data.phoneNumber,
            fullName: data.fullName,
            role: data.role,
            companyId: data.companyId,
            stationId: data.stationId,
            token: data.token,
          };
          kvStorage.setObject(StorageKeys.AUTH_SESSION, this.currentUser);
          kvStorage.setString(StorageKeys.LAST_ROLE, data.role);
          this.notifyAuth();
          return { success: true };
        }
      }

      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || "Numéro de téléphone ou mot de passe incorrect",
      };
    } catch {
      return {
        success: false,
        error: "Impossible de joindre le serveur central",
      };
    }
  }


  logout() {
    this.currentUser = null;
    kvStorage.removeItem(StorageKeys.AUTH_SESSION);
    this.notifyAuth();
  }
}

export const mobileAuth = new MobileAuthService();
