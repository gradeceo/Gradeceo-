import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  BookOpen, 
  Crown, 
  Bookmark, 
  User, 
  Trophy, 
  Coins, 
  LogOut,
  ChevronRight,
  Calendar,
  GraduationCap,
  Stethoscope,
  Calculator,
  Briefcase,
  Edit2,
  CheckCircle,
  AlertCircle,
  Search,
  X,
  ExternalLink
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  onSnapshot 
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  isFirebaseConfigured, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import type { StudentProfile, Tab } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-700 text-left overflow-auto max-h-40 font-mono">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isEditing, setIsEditing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchSources, setSearchSources] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form State for Onboarding/Edit
  const [formData, setFormData] = useState({
    name: '',
    studentClass: '',
    isDropper: false,
    preparingFor: '',
    dob: '',
    futureGoal: ''
  });

  // Splash Screen Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Auth Listener
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch profile
        const path = `students/${firebaseUser.uid}`;
        try {
          const docRef = doc(db, 'students', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile(docSnap.data() as StudentProfile);
            setFormData({
              name: docSnap.data().name,
              studentClass: docSnap.data().studentClass,
              isDropper: docSnap.data().isDropper,
              preparingFor: docSnap.data().preparingFor,
              dob: docSnap.data().dob,
              futureGoal: docSnap.data().futureGoal
            });
          } else {
            setProfile(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time profile listener (for coins/achievements)
  useEffect(() => {
    if (!user) return;
    const path = `students/${user.uid}`;
    const unsubscribe = onSnapshot(doc(db, 'students', user.uid), (doc) => {
      if (doc.exists()) {
        setProfile(doc.data() as StudentProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const newProfile: StudentProfile = {
      uid: user.uid,
      ...formData,
      coins: 0,
      achievements: [],
      createdAt: new Date().toISOString()
    };

    const path = `students/${user.uid}`;
    try {
      await setDoc(doc(db, 'students', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const path = `students/${user.uid}`;
    try {
      await updateDoc(doc(db, 'students', user.uid), formData);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResult(null);
    setSearchSources([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: searchQuery,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      setSearchResult(response.text);
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        setSearchSources(chunks.filter((c: any) => c.web).map((c: any) => c.web));
      }
    } catch (error) {
      console.error("Search failed", error);
      setSearchResult("Sorry, I couldn't find any information on that right now.");
    } finally {
      setIsSearching(false);
    }
  };

  // --- RENDERING ---

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <div className="w-32 h-32 bg-orange-500 rounded-3xl flex items-center justify-center shadow-xl mb-6">
            <GraduationCap className="w-20 h-20 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-orange-600 tracking-tight">Gradeceo</h1>
          <p className="text-gray-400 mt-2 font-medium">Empowering Students</p>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Firebase Setup Required</h2>
          <p className="text-gray-500">
            To enable login and data storage, please click the <span className="font-bold text-orange-600">"Set up Firebase"</span> button in the AI Studio interface.
          </p>
          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 text-sm text-orange-700">
            Once you accept the terms, the app will refresh and connect automatically.
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-gray-900">Welcome to Gradeceo</h2>
            <p className="text-gray-500">Your journey to excellence starts here.</p>
          </div>
          <div className="py-10">
            <GraduationCap className="w-24 h-24 text-orange-500 mx-auto" />
          </div>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-semibold py-4 px-6 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-8 mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tell us about yourself</h2>
          <form onSubmit={handleOnboardingSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                required
                type="text"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  required
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.studentClass}
                  onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
                >
                  <option value="">Select Class</option>
                  <option value="9">9th</option>
                  <option value="10">10th</option>
                  <option value="11">11th</option>
                  <option value="12">12th</option>
                  <option value="Graduate">Graduate</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dropper?</label>
                <div className="flex items-center gap-4 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dropper"
                      checked={formData.isDropper}
                      onChange={() => setFormData({ ...formData, isDropper: true })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dropper"
                      checked={!formData.isDropper}
                      onChange={() => setFormData({ ...formData, isDropper: false })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preparing For</label>
              <input
                required
                type="text"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="e.g. JEE, NEET, UPSC"
                value={formData.preparingFor}
                onChange={(e) => setFormData({ ...formData, preparingFor: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                required
                type="date"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Future Goal</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Engineer', icon: GraduationCap },
                  { id: 'Doctor', icon: Stethoscope },
                  { id: 'CA', icon: Calculator },
                  { id: 'IAS', icon: Briefcase },
                  { id: 'Other', icon: Edit2 }
                ].map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, futureGoal: goal.id })}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
                      formData.futureGoal === goal.id 
                        ? "bg-orange-50 border-orange-500 text-orange-600" 
                        : "bg-white border-gray-200 text-gray-500 hover:border-orange-200"
                    )}
                  >
                    <goal.icon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold">{goal.id}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 mt-4"
            >
              Continue to Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP UI ---

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-100">
        <h1 className="text-2xl font-black text-orange-600 tracking-tighter">Gradeceo</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
            <Trophy className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold text-orange-700">{profile.achievements.length}</span>
          </div>
          <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-bold text-yellow-700">{profile.coins}</span>
          </div>
          <button 
            onClick={() => setShowSearch(true)}
            className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100"
          >
            <Search className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="bg-orange-500 rounded-3xl p-6 text-white shadow-xl shadow-orange-100 relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-xl font-bold mb-1">Hello, {profile.name}!</h2>
                  <p className="text-orange-100 text-sm opacity-90">Ready to boost your {profile.preparingFor} prep today?</p>
                  <button className="mt-4 bg-white text-orange-600 px-6 py-2 rounded-full text-sm font-bold shadow-sm">
                    Start Learning
                  </button>
                </div>
                <GraduationCap className="absolute -right-4 -bottom-4 w-32 h-32 text-orange-400 opacity-30 rotate-12" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                    <BookOpen className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="font-bold text-gray-900">Courses</h3>
                  <p className="text-xs text-gray-400 mt-1">12 active topics</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-3">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <h3 className="font-bold text-gray-900">Tests</h3>
                  <p className="text-xs text-gray-400 mt-1">4 pending</p>
                </div>
              </div>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Recent Activity</h3>
                  <button className="text-orange-500 text-xs font-bold">View All</button>
                </div>
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
                      <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-800">Mathematics Quiz #{i}</h4>
                        <p className="text-xs text-gray-400">Completed 2 hours ago</p>
                      </div>
                      <div className="text-orange-500">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'test' && (
            <motion.div
              key="test"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 flex flex-col items-center justify-center h-full text-center space-y-4"
            >
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-gray-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">No Tests Available</h2>
              <p className="text-gray-400 text-sm">Check back later for new test series.</p>
            </motion.div>
          )}

          {activeTab === 'premium' && (
            <motion.div
              key="premium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 flex flex-col items-center justify-center h-full text-center space-y-4"
            >
              <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center">
                <Crown className="w-10 h-10 text-yellow-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Premium Coming Soon</h2>
              <p className="text-gray-400 text-sm">Unlock exclusive features and content.</p>
            </motion.div>
          )}

          {activeTab === 'bookmark' && (
            <motion.div
              key="bookmark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 flex flex-col items-center justify-center h-full text-center space-y-4"
            >
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                <Bookmark className="w-10 h-10 text-gray-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Empty Bookmarks</h2>
              <p className="text-gray-400 text-sm">Save important questions or topics here.</p>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 space-y-6"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center border-4 border-white shadow-md">
                    <User className="w-12 h-12 text-orange-500" />
                  </div>
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className="absolute bottom-0 right-0 bg-orange-500 text-white p-2 rounded-full shadow-lg border-2 border-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mt-4">{profile.name}</h2>
                <p className="text-sm text-gray-400">{user.email}</p>
                
                <div className="grid grid-cols-3 w-full mt-6 border-t border-gray-50 pt-6 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{profile.coins}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Coins</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{profile.achievements.length}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Badges</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">12</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Rank</p>
                  </div>
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <h3 className="font-bold text-gray-900 mb-2">Edit Information</h3>
                  <div className="space-y-3">
                    <input
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Name"
                    />
                    <select
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      value={formData.studentClass}
                      onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
                    >
                      <option value="9">9th</option>
                      <option value="10">10th</option>
                      <option value="11">11th</option>
                      <option value="12">12th</option>
                    </select>
                    <input
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      value={formData.preparingFor}
                      onChange={(e) => setFormData({ ...formData, preparingFor: e.target.value })}
                      placeholder="Preparing For"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-100"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <h3 className="font-bold text-gray-900 mb-4">Student Details</h3>
                  <div className="space-y-4">
                    <DetailItem icon={GraduationCap} label="Class" value={`${profile.studentClass}th ${profile.isDropper ? '(Dropper)' : ''}`} />
                    <DetailItem icon={Trophy} label="Preparing For" value={profile.preparingFor} />
                    <DetailItem icon={Calendar} label="Date of Birth" value={profile.dob} />
                    <DetailItem icon={Crown} label="Future Goal" value={profile.futureGoal} />
                  </div>
                  <button 
                    onClick={() => signOut(auth)}
                    className="w-full mt-6 py-4 flex items-center justify-center gap-2 text-red-500 font-bold text-sm border border-red-50 border-t-0 pt-6"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 px-4 py-3 flex items-center justify-between z-20">
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={Home} label="Home" />
        <NavButton active={activeTab === 'test'} onClick={() => setActiveTab('test')} icon={BookOpen} label="Test" />
        <NavButton active={activeTab === 'premium'} onClick={() => setActiveTab('premium')} icon={Crown} label="Premium" />
        <NavButton active={activeTab === 'bookmark'} onClick={() => setActiveTab('bookmark')} icon={Bookmark} label="Save" />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={User} label="Profile" />
      </nav>

      {/* Search Modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Search Material</h3>
                <button onClick={() => setShowSearch(false)} className="p-2 bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                <form onSubmit={handleSearch} className="relative mb-6">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Ask anything about your studies..."
                    className="w-full p-4 pr-12 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button 
                    type="submit"
                    disabled={isSearching}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-orange-500 text-white rounded-xl disabled:opacity-50"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </form>

                {isSearching && (
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                    <p className="text-sm text-gray-400">Searching for the best resources...</p>
                  </div>
                )}

                {searchResult && (
                  <div className="space-y-6 pb-6">
                    <div className="prose prose-sm max-w-none text-gray-700 markdown-body">
                      <Markdown>{searchResult}</Markdown>
                    </div>

                    {searchSources.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sources</h4>
                        <div className="space-y-2">
                          {searchSources.map((source, idx) => (
                            <a 
                              key={idx}
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-orange-200 transition-all"
                            >
                              <span className="text-sm font-medium text-gray-700 truncate mr-4">{source.title}</span>
                              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-1 rounded-2xl transition-all duration-300",
        active ? "text-orange-500" : "text-gray-400"
      )}
    >
      <Icon className={cn("w-6 h-6", active && "animate-pulse")} />
      <span className="text-[10px] font-bold">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-orange-500 rounded-full" />}
    </button>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}
