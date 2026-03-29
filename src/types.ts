export type StudentProfile = {
  uid: string;
  name: string;
  studentClass: string;
  isDropper: boolean;
  preparingFor: string;
  dob: string;
  futureGoal: string;
  coins: number;
  achievements: string[];
  createdAt: string;
};

export type AppState = 'splash' | 'login' | 'onboarding' | 'home';
export type Tab = 'home' | 'test' | 'premium' | 'bookmark' | 'profile';
