import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  getDoc 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  ChefHat, 
  Users, 
  Play, 
  Timer, 
  CheckCircle2, 
  Utensils,
  Trophy,
  Skull,
  Volume2,
  VolumeX,
  Zap,
  Waves,
  HandMetal,
  Thermometer,
  Eraser,
  Wind,
  Hand,
  AlertCircle,
  BookOpen
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyD_YGPU1QiWCsbKk7i7uLTRdvwNjock5HQ",
      authDomain: "stir-the-pot-game.firebaseapp.com",
      projectId: "stir-the-pot-game",
      storageBucket: "stir-the-pot-game.firebasestorage.app",
      messagingSenderId: "490697693148",
      appId: "1:490697693148:web:3515513c66df65f987e119"
    };

// Initialize Firebase safely
let app, auth, db;
const isConfigValid = firebaseConfig && firebaseConfig.apiKey !== "";

if (isConfigValid) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'stir-the-pot-game';

// --- Constants ---
const ROUND_TIME = 60;
const DISH_NAMES = [
  "The Sunday Morning Mistake",
  "The Boss's Retirement Party",
  "A Wedding to Forget",
  "The Health Inspector's Nightmare",
  "Roommate's Mystery Tupperware",
  "The First Date Disaster",
  "Midnight Gas Station Run",
  "Grandma's Secret 'Medicine'",
  "Overcooked Ambition",
  "The Soggy Sandwich Special"
];

const ROUND_RULES = [
  { 
    id: 1, 
    title: "THE PREP SHIFT", 
    rule: "SAY ANYTHING!", 
    sub: "No skips allowed. Describe the ingredient however you want!",
    allowSkip: false 
  },
  { 
    id: 2, 
    title: "THE LUNCH RUSH", 
    rule: "ONE WORD ONLY!", 
    sub: "Skips allowed (-200 pts). One single word per ingredient!",
    allowSkip: true 
  },
  { 
    id: 3, 
    title: "KITCHEN NIGHTMARE", 
    rule: "CHARADES & SOUNDS!", 
    sub: "Skips allowed (-200 pts). No talking allowed!",
    allowSkip: true 
  }
];

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('LANDING'); 
  const [role, setRole] = useState(null); 
  const [inputCode, setInputCode] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  
  const introAudio = useRef(null);

  useEffect(() => {
    introAudio.current = new Audio('intro.mp3');
    introAudio.current.loop = true;
    introAudio.current.volume = 0.6;
    
    return () => {
      if (introAudio.current) {
        introAudio.current.pause();
        introAudio.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (introAudio.current && roomData) {
      const targetVolume = roomData.status === 'PLAYING' ? 0.15 : 0.6;
      introAudio.current.volume = isMuted ? 0 : targetVolume;
    }
  }, [roomData?.status, isMuted]);

  if (!isConfigValid) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-stone-950 to-stone-950">
        <div className="bg-orange-600/20 p-6 rounded-full mb-6 border border-orange-500/50">
          <AlertCircle className="text-orange-500" size={48} />
        </div>
        <h1 className="text-3xl font-black text-white mb-4 uppercase italic tracking-tighter">Missing Kitchen Equipment</h1>
        <p className="text-stone-400 max-w-md leading-relaxed mb-8">
          The Firebase configuration is missing or invalid. Please ensure your API key and Project ID are correctly set in the <code className="bg-stone-900 px-2 py-1 rounded text-orange-500">firebaseConfig</code> object.
        </p>
      </div>
    );
  }

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
        setError("Connection failed. Check your internet or Firebase rules.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeRoomCode || !user || !db) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', activeRoomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomData(data);
        
        const isHost = data.hostId === user.uid;
        const isJoinedPlayer = data.players && data.players[user.uid];

        if (isHost || isJoinedPlayer) {
          if (data.status === 'LOBBY') setView('LOBBY');
          if (data.status === 'INTERMISSION') setView('INTERMISSION');
          if (data.status === 'PLAYING') setView('PLAYING');
          if (data.status === 'GAME_OVER') setView('RESULTS');
        }
      } else if (role === 'PLAYER') {
        setError('Room closed.');
        setView('LANDING');
      }
    }, (err) => console.error("Sync Error:", err));
    return () => unsubscribe();
  }, [activeRoomCode, user, role]);

  const requestPermissions = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try { await DeviceMotionEvent.requestPermission(); } catch(e) { console.error(e); }
    }
  };

  const createRoom = async () => {
    if (!user || !db) return;
    const newCode = generateRoomCode();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newCode);
    const initialData = {
      code: newCode,
      status: 'LOBBY',
      hostId: user.uid,
      players: {},
      pantry: [],
      deck: [],
      discard: [],
      currentRound: 1,
      currentChefIndex: 0,
      currentIngredient: '',
      dishName: '',
      timer: 0,
      activeChefId: '',
      completedIngredients: [],
      chefSuccessCount: 0,
      turnOrder: [],
      sabotages: {},
      lastChefStats: null,
      isChefReady: false,
      intermissionTimer: 0
    };
    try {
      await setDoc(roomRef, initialData);
      setRole('HOST');
      setActiveRoomCode(newCode);
      setView('LOBBY');
      if (introAudio.current) {
        introAudio.current.play().catch(e => console.log("Audio play blocked"));
      }
    } catch (e) { setError("Failed to create room."); }
  };

  const joinRoom = async () => {
    if (!user || !inputCode || !playerName || !db) {
      setError("Name and Code required.");
      return;
    }
    await requestPermissions();
    const cleanCode = inputCode.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', cleanCode);
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) { setError('Room not found.'); return; }
      const updates = {};
      updates[`players.${user.uid}`] = {
        id: user.uid,
        name: playerName,
        score: 0,
        isLockedOut: false,
        ready: false,
        sabotageCharges: 12 // UPDATED TO 12
      };
      await updateDoc(roomRef, updates);
      setRole('PLAYER');
      setActiveRoomCode(cleanCode);
      setView('LOBBY');
    } catch (e) { setError("Join failed."); }
  };

  if (!user && !error) return <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-orange-500 font-black uppercase tracking-widest"><Utensils className="animate-spin mb-4" size={48} />Preheating...</div>;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-orange-500 overflow-hidden">
      {role === 'HOST' && view !== 'LANDING' && view !== 'RESULTS' && (
        <div className="fixed bottom-6 right-6 z-50 flex gap-3">
          <button 
            onClick={() => { if(introAudio.current) { introAudio.current.muted = !isMuted; setIsMuted(!isMuted); } }} 
            className="p-4 bg-stone-800 rounded-full border-4 border-stone-700 shadow-2xl hover:bg-stone-700 transition-all active:scale-95"
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
        </div>
      )}
      
      {view === 'LANDING' && <LandingView setInputCode={setInputCode} inputCode={inputCode} setPlayerName={setPlayerName} createRoom={createRoom} joinRoom={joinRoom} error={error} />}
      {view === 'LOBBY' && <LobbyView roomCode={activeRoomCode} roomData={roomData} role={role} user={user} appId={appId} />}
      {view === 'INTERMISSION' && <IntermissionView roomCode={activeRoomCode} roomData={roomData} role={role} user={user} appId={appId} requestPermissions={requestPermissions} />}
      {view === 'PLAYING' && <GameView roomCode={activeRoomCode} roomData={roomData} user={user} role={role} appId={appId} />}
      {view === 'RESULTS' && <ResultsView roomData={roomData} roomCode={activeRoomCode} role={role} appId={appId} />}
    </div>
  );
}

// --- Views ---

function LandingView({ setInputCode, inputCode, setPlayerName, createRoom, joinRoom, error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-900/30 via-stone-950 to-stone-950">
      <div className="mb-12 text-center">
        <div className="bg-orange-600 p-6 rounded-[2rem] rotate-12 shadow-2xl mb-8 inline-block shadow-orange-900/50">
          <Utensils size={64} className="text-white -rotate-12" />
        </div>
        <h1 className="text-7xl font-black italic tracking-tighter uppercase leading-none text-white drop-shadow-2xl">Stir the <span className="text-orange-500 underline decoration-8 decoration-orange-600/50 underline-offset-8">Pot</span></h1>
        <p className="text-stone-400 mt-6 font-bold uppercase tracking-[0.4em] text-xs">High-Stakes Kitchen Sabotage</p>
      </div>
      <div className="w-full max-w-sm space-y-4 bg-stone-900/60 p-8 rounded-[2.5rem] border-2 border-stone-800 backdrop-blur-xl shadow-2xl">
        <input type="text" placeholder="CHEF NAME" className="w-full bg-stone-800 border-2 border-stone-700 rounded-xl p-4 text-center font-black text-lg uppercase focus:border-orange-500 outline-none transition-all" onChange={(e) => setPlayerName(e.target.value)} />
        <input type="text" placeholder="ROOM CODE" value={inputCode} className="w-full bg-stone-800 border-2 border-stone-700 rounded-xl p-4 text-center font-black text-lg uppercase focus:border-orange-500 outline-none transition-all" onChange={(e) => setInputCode(e.target.value.toUpperCase())} />
        <button onClick={joinRoom} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-xl text-xl uppercase shadow-xl transform active:scale-95 transition-all">Join Game</button>
        <button onClick={createRoom} className="w-full bg-stone-800 text-stone-300 font-bold py-4 rounded-xl uppercase transition-all">Host on TV</button>
        {error && <div className="text-red-500 font-black text-center text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/50">{error}</div>}
      </div>
    </div>
  );
}

function LobbyView({ roomCode, roomData, role, user, appId }) {
  const [items, setItems] = useState(['', '', '', '', '']);
  const [localError, setLocalError] = useState('');
  const [showRules, setShowRules] = useState(false); // NEW STATE FOR MODAL
  
  const players = roomData?.players ? Object.values(roomData.players) : [];
  const isReady = roomData?.players?.[user.uid]?.ready;
  const isHost = role === 'HOST';

  const submitPantry = async () => {
    setLocalError('');
    if (items.some(i => i.trim() === '')) {
      setLocalError("Fill all 5 boxes!");
      return;
    }
    const cleanItems = items.map(i => i.trim().toUpperCase());
    
    const uniqueSubmission = new Set(cleanItems);
    if (uniqueSubmission.size !== cleanItems.length) {
      setLocalError("Submission contains duplicates!");
      return;
    }

    const existingPantry = roomData.pantry || [];
    const duplicate = cleanItems.find(item => existingPantry.includes(item));
    if (duplicate) {
      setLocalError(`DUPLICATE FOUND: "${duplicate}"`);
      return;
    }

    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      await updateDoc(roomRef, { pantry: arrayUnion(...cleanItems) });
      const up = {}; up[`players.${user.uid}.ready`] = true;
      await updateDoc(roomRef, up);
    } catch (e) { console.error(e); }
  };

  const startGame = async () => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const turnOrder = players.map(p => p.id).sort(() => Math.random() - 0.5);
    const shuffledDeck = [...roomData.pantry].sort(() => Math.random() - 0.5);
    await updateDoc(roomRef, { 
      deck: shuffledDeck, 
      discard: [], 
      status: 'INTERMISSION', 
      activeChefId: turnOrder[0],
      turnOrder: turnOrder,
      currentRound: 1,
      currentChefIndex: 0,
      isChefReady: false,
      intermissionTimer: 0
    });
  };

  if (isHost) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-10 max-w-[1200px] mx-auto w-full">
        <div className="w-full flex justify-between items-start mb-16">
          <div className="bg-white text-black p-8 rounded-[2.5rem] shadow-2xl transform -rotate-3 border-b-8 border-stone-300">
            <p className="text-[10px] font-black opacity-40 uppercase mb-1">Room Code</p>
            <p className="text-8xl font-black leading-none tracking-tighter">{roomCode}</p>
          </div>
          <div className="text-right">
            <h2 className="text-5xl font-black italic text-orange-500 uppercase tracking-tighter">Kitchen Lobby</h2>
            <p className="text-stone-500 font-bold uppercase tracking-[0.3em] text-sm mt-2 animate-pulse">Waiting for Staff...</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6 w-full">
          {players.map(p => (
            <div key={p.id} className={`bg-stone-900/50 border-2 p-8 rounded-[2.5rem] text-center space-y-3 transition-all duration-500 ${p.ready ? 'border-green-500 bg-green-950/10' : 'border-stone-800'}`}>
              <ChefHat className={`mx-auto ${p.ready ? 'text-green-500' : 'text-stone-600'}`} size={40} />
              <p className="text-xl font-black uppercase truncate tracking-tighter">{p.name}</p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${p.ready ? 'text-green-500' : 'text-stone-600'}`}>{p.ready ? 'Ready' : 'Entering items...'}</p>
            </div>
          ))}
        </div>
        <button disabled={players.length < 2 || !players.every(p => p.ready)} onClick={startGame} className="mt-16 px-16 py-6 bg-orange-600 text-white font-black text-3xl rounded-[2.5rem] shadow-2xl disabled:opacity-30 uppercase transition-all">Start Game</button>
      </div>
    );
  }

  // --- PLAYER VIEW ---
  return (
    <div className="min-h-screen p-6 flex flex-col bg-stone-950 overflow-y-auto pb-24">
      {/* SHOW MODAL */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      <div className="text-center mb-8 relative">
        {/* RULES BUTTON */}
        <button 
          onClick={() => setShowRules(true)}
          className="absolute right-0 top-0 p-3 bg-stone-800 rounded-full border-2 border-stone-700 text-stone-400 hover:text-white hover:border-orange-500 transition-all"
        >
          <BookOpen size={24} />
        </button>

        <h2 className="text-3xl font-black italic text-orange-500 uppercase tracking-tighter">Stock the Pantry</h2>
        <p className="text-stone-500 font-bold uppercase text-[10px] tracking-widest mt-2 px-8">Add your items below to stock the shared kitchen deck.</p>
      </div>
      {!isReady ? (
        <div className="space-y-3">
          {items.map((v, i) => (
            <div key={i} className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/30 font-black italic text-xl">{i+1}</span>
               <input maxLength={30} type="text" placeholder="Add an item..." className={`w-full bg-stone-900 pl-10 pr-4 py-4 rounded-xl font-black uppercase outline-none focus:border-orange-500 border-2 ${localError.includes(v.toUpperCase()) && v !== '' ? 'border-red-500 animate-pulse' : 'border-stone-800'} transition-all text-lg`} value={v} onChange={(e) => { const n = [...items]; n[i] = e.target.value; setItems(n); }} />
            </div>
          ))}
          {localError && <div className="p-3 bg-red-600/20 border border-red-500 text-red-500 font-black text-xs uppercase text-center rounded-xl">{localError}</div>}
          <button onClick={submitPantry} className="w-full bg-orange-600 font-black py-6 rounded-[2rem] text-2xl uppercase shadow-2xl mt-8 transition-all">Confirm Ingredients</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-20">
          <CheckCircle2 size={80} className="text-green-500 animate-bounce" />
          <p className="text-4xl font-black uppercase italic tracking-tighter">Ready!</p>
          <p className="text-stone-500 font-black uppercase tracking-widest text-xs">Wait for Host to open the kitchen...</p>
          
          {/* ALSO ADD BUTTON HERE */}
          <button onClick={() => setShowRules(true)} className="flex items-center gap-2 text-stone-500 hover:text-white font-bold uppercase text-xs tracking-widest border border-stone-800 px-6 py-3 rounded-full hover:bg-stone-900 transition-all">
            <BookOpen size={16} /> Read Rules Again
          </button>
        </div>
      )}
    </div>
  );
}

function IntermissionView({ roomCode, roomData, role, user, appId, requestPermissions }) {
  const isHost = role === 'HOST';
  const isNextChef = roomData.activeChefId === user.uid;
  const nextChefName = roomData.players[roomData.activeChefId]?.name || "Someone";
  const lastChefStats = roomData.lastChefStats;
  const currentRule = ROUND_RULES[roomData.currentRound - 1] || ROUND_RULES[0];

  const startCountdown = async () => {
    if (!db) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    let count = 5;
    await updateDoc(roomRef, { intermissionTimer: count });
    
    const interval = setInterval(async () => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        await updateDoc(roomRef, { status: 'PLAYING', timer: 0, intermissionTimer: 0 });
      } else {
        await updateDoc(roomRef, { intermissionTimer: count });
      }
    }, 1000);
  };

  const handleChefReady = async () => {
    if (!db) return;
    await requestPermissions();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    await updateDoc(roomRef, { isChefReady: true });
    if (isHost) startCountdown(); 
  };

  useEffect(() => {
    if (isHost && roomData.isChefReady && roomData.intermissionTimer === 0) {
      startCountdown();
    }
  }, [roomData.isChefReady]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center max-w-[1200px] mx-auto w-full">
      <div className="w-full mb-8">
        <p className="text-[10px] font-black text-stone-600 uppercase mb-4 tracking-[0.4em]">Leaderboard Standings</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
             <div key={p.id} className={`p-4 rounded-[1.5rem] border-2 ${i === 0 ? 'bg-orange-600/10 border-orange-500' : 'bg-stone-900/50 border-stone-800'}`}>
                <p className="text-lg font-black uppercase truncate tracking-tighter">{p.name}</p>
                <p className="text-2xl font-black text-white mt-1">{p.score}</p>
             </div>
           ))}
        </div>
      </div>

      <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 backdrop-blur-md w-full max-w-2xl">
        <p className="text-orange-500 font-black uppercase text-xs tracking-widest mb-2">Round {roomData.currentRound}: {currentRule.title}</p>
        <h2 className="text-5xl font-black italic text-white uppercase mb-2">{currentRule.rule}</h2>
        <p className="text-stone-400 font-bold uppercase text-xs tracking-widest mb-8">{currentRule.sub}</p>

        <div className="flex flex-col items-center">
          <div className="bg-orange-600 p-8 rounded-[2.5rem] shadow-xl rotate-3 mb-6">
            <ChefHat size={70} className="text-white" />
          </div>
          <p className="text-stone-500 font-black uppercase text-xl mb-2 tracking-[0.2em]">Next Head Chef:</p>
          <h2 className="text-6xl md:text-8xl font-black uppercase italic text-white leading-none tracking-tighter break-words px-8 mb-10">{nextChefName}</h2>
          
          {roomData.isChefReady ? (
            <div className="w-24 h-24 rounded-full border-[6px] border-stone-800 flex items-center justify-center bg-stone-900">
               <span className="text-5xl font-black text-orange-500 animate-pulse">{roomData.intermissionTimer || 5}</span>
            </div>
          ) : (
            isNextChef ? (
              <button onClick={handleChefReady} className="px-12 py-5 bg-white text-black font-black text-2xl rounded-full shadow-2xl flex items-center gap-4 hover:scale-105 active:scale-95 transition-all uppercase">
                Ready to Cook! <Play fill="currentColor" />
              </button>
            ) : (
              <p className="text-stone-600 font-black uppercase italic tracking-widest text-sm animate-pulse">Wait for {nextChefName} to prep...</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function GameView({ roomCode, roomData, user, role, appId }) {
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [pantryShuffle, setPantryShuffle] = useState([]);
  const [sabProgress, setSabProgress] = useState(0); 
  const [dialRotation, setDialRotation] = useState(0); 
  
  const isChef = roomData.activeChefId === user.uid;
  const isHost = role === 'HOST';
  const roomRef = db ? doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode) : null;
  const timerInterval = useRef(null);
  const motionRef = useRef({ lastX: 0, lastY: 0 });

  const currentRule = ROUND_RULES[roomData.currentRound - 1] || ROUND_RULES[0];

  const triggerSabotage = async (tid) => {
    if (!tid || !roomRef) return;
    const types = ['DRY', 'DICE', 'DIAL'];
    const type = types[Math.floor(Math.random() * types.length)];
    const targetValue = type === 'DIAL' ? Math.floor(Math.random() * 300 + 100) : (type === 'DICE' ? 12 : 0);
    const updates = {};
    updates[`sabotages.${tid}`] = { type, progress: 0, targetValue };
    updates[`players.${user.uid}.sabotageCharges`] = (roomData.players[user.uid]?.sabotageCharges || 0) - 1;
    await updateDoc(roomRef, updates);
  };

  const finishSab = async () => {
    if (!roomRef) return;
    const updates = {}; updates[`sabotages.${user.uid}`] = null;
    await updateDoc(roomRef, updates);
    setSabProgress(0);
    setDialRotation(0);
  };

  // Shake Logic (DRY)
  useEffect(() => {
    const sab = roomData.sabotages?.[user.uid];
    if (sab?.type === 'DRY') {
      const handleMotion = (e) => {
        const { x, y } = e.accelerationIncludingGravity || { x:0, y:0 };
        const delta = Math.abs(x - motionRef.current.lastX) + Math.abs(y - motionRef.current.lastY);
        if (delta > 15) setSabProgress(p => { 
          if (p >= 100) { finishSab(); return 100; } 
          return p + 4; 
        });
        motionRef.current = { lastX: x, lastY: y };
      };
      window.addEventListener('devicemotion', handleMotion);
      return () => window.removeEventListener('devicemotion', handleMotion);
    }
  }, [roomData.sabotages?.[user.uid]]);

  useEffect(() => {
    if (isHost && roomData.activeChefId && roomData.timer === 0) startTurn();
    return () => clearInterval(timerInterval.current);
  }, [roomData.activeChefId, isHost]);

  const startTurn = async () => {
    if (!roomRef) return;
    let currentDeck = [...(roomData.deck || [])];
    let currentDiscard = [...(roomData.discard || [])];
    
    if (currentDeck.length === 0) {
      currentDeck = [...roomData.pantry].sort(() => Math.random() - 0.5);
      currentDiscard = [];
    }
    
    const ingredient = currentDeck.shift();
    currentDiscard.push(ingredient);

    await updateDoc(roomRef, {
      timer: ROUND_TIME, 
      dishName: DISH_NAMES[Math.floor(Math.random() * DISH_NAMES.length)],
      currentIngredient: ingredient, 
      deck: currentDeck,
      discard: currentDiscard,
      chefSuccessCount: 0, 
      completedIngredients: [],
      sabotages: {} 
    });

    let lt = ROUND_TIME;
    clearInterval(timerInterval.current);
    timerInterval.current = setInterval(async () => {
      lt -= 1;
      if (lt <= 0) { clearInterval(timerInterval.current); endShift(); }
      else await updateDoc(roomRef, { timer: lt });
    }, 1000);
  };

  const endShift = async () => {
    if (!roomRef) return;
    const nextIdx = roomData.currentChefIndex + 1;
    const stats = { name: roomData.players[roomData.activeChefId]?.name, count: roomData.chefSuccessCount };
    
    if (nextIdx >= roomData.turnOrder.length) {
      if (roomData.currentRound < 3) {
        await updateDoc(roomRef, { 
          status: 'INTERMISSION', 
          currentRound: roomData.currentRound + 1, 
          currentChefIndex: 0, 
          activeChefId: roomData.turnOrder[0], 
          timer: 0, 
          lastChefStats: stats, 
          isChefReady: false, 
          intermissionTimer: 0 
        });
      } else {
        await updateDoc(roomRef, { status: 'GAME_OVER' });
      }
    } else {
      await updateDoc(roomRef, { 
        status: 'INTERMISSION', 
        currentChefIndex: nextIdx, 
        activeChefId: roomData.turnOrder[nextIdx], 
        timer: 0, 
        lastChefStats: stats, 
        isChefReady: false, 
        intermissionTimer: 0 
      });
    }
  };

  useEffect(() => { if (roomData.timer > 0) setTimeLeft(roomData.timer); }, [roomData.timer]);

  useEffect(() => {
    if (!isHost && roomData.status === 'PLAYING') {
      setPantryShuffle([...roomData.pantry].sort(() => Math.random() - 0.5));
    }
  }, [roomData.currentIngredient, isHost, roomData.status]);

  const handleGuess = async (guess) => {
    if (!roomRef || roomData.players[user.uid]?.isLockedOut || roomData.sabotages?.[user.uid]) return;
    
    if (guess === roomData.currentIngredient) {
      let currentDeck = [...(roomData.deck || [])];
      let currentDiscard = [...(roomData.discard || [])];
      
      if (currentDeck.length === 0) {
        currentDeck = [...roomData.pantry].sort(() => Math.random() - 0.5);
        currentDiscard = [];
      }
      
      const nextIng = currentDeck.shift();
      currentDiscard.push(nextIng);

      const up = { 
        deck: currentDeck,
        discard: currentDiscard,
        currentIngredient: nextIng, 
        chefSuccessCount: roomData.chefSuccessCount + 1, 
        completedIngredients: arrayUnion(roomData.currentIngredient)
      };
      up[`players.${user.uid}.score`] = (roomData.players[user.uid]?.score || 0) + 500;
      up[`players.${roomData.activeChefId}.score`] = (roomData.players[roomData.activeChefId]?.score || 0) + 300;
      
      Object.keys(roomData.players).forEach(id => { up[`players.${id}.isLockedOut`] = false; });
      await updateDoc(roomRef, up);
    } else {
      const up = {}; 
      up[`players.${user.uid}.isLockedOut`] = true;
      up[`players.${user.uid}.score`] = Math.max(0, (roomData.players[user.uid]?.score || 0) - 100);
      await updateDoc(roomRef, up);
    }
  };

  const skipIngredient = async () => {
    if (!roomRef || !currentRule.allowSkip) return;
    
    let currentDeck = [...(roomData.deck || [])];
    let currentDiscard = [...(roomData.discard || [])];
    if (currentDeck.length === 0) {
      currentDeck = [...roomData.pantry].sort(() => Math.random() - 0.5);
      currentDiscard = [];
    }
    const nextIng = currentDeck.shift();
    currentDiscard.push(nextIng);

    const up = { 
      deck: currentDeck, 
      discard: currentDiscard,
      currentIngredient: nextIng 
    };
    up[`players.${user.uid}.score`] = Math.max(0, (roomData.players[user.uid]?.score || 0) - 200);
    await updateDoc(roomRef, up);
  };

  const renderSabotage = () => {
    const sab = roomData.sabotages[user.uid];
    
    if (sab.type === 'DICE') return (
      <div 
        className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-emerald-900 touch-none select-none"
        onClick={() => {
          setSabProgress(p => {
            const next = p + (100 / sab.targetValue);
            if (next >= 99) { finishSab(); return 100; }
            return next;
          });
        }}
      >
        <div className="text-white mb-8 animate-bounce">
           <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 14.5l7-7M9 7.5L2 14.5M14 17.5l7-7M21 10.5L14 17.5M10.5 22L17.5 15M17.5 15L10.5 22" />
           </svg>
        </div>
        <h2 className="text-5xl font-black uppercase italic text-white mb-4 leading-none tracking-tighter">DICE THE VEG!</h2>
        <p className="text-xl font-bold text-emerald-200 mb-10">TAP REPEATEDLY TO CHOP!</p>
        <div className="w-full max-w-xs h-40 bg-stone-800 rounded-[2.5rem] border-4 border-stone-700 relative overflow-hidden flex items-center justify-center shadow-2xl active:scale-95 transition-transform">
          <div className="absolute inset-0 flex items-center justify-around opacity-20 pointer-events-none">
            {Array.from({length: 8}).map((_, i) => <div key={i} className="w-1 h-full bg-white"></div>)}
          </div>
          <span className="text-white font-black text-5xl italic relative z-10 animate-pulse">CHOP!</span>
        </div>
        <div className="w-full max-w-xs mt-10 bg-black/40 h-10 rounded-full border-2 border-white/20 overflow-hidden shadow-inner">
          <div className="bg-emerald-400 h-full transition-all duration-75 shadow-[0_0_20px_rgba(52,211,153,0.5)]" style={{ width: `${sabProgress}%` }}></div>
        </div>
      </div>
    );

    if (sab.type === 'DIAL') return (
      <div 
        className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-orange-950 touch-none select-none"
        onPointerMove={(e) => { 
          if (e.buttons > 0 || e.pointerType === 'touch') {
            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            let deg = (angle + 90 + 360) % 360;
            setDialRotation(deg);
            const currentTemp = Math.floor(deg + 100);
            if (Math.abs(currentTemp - sab.targetValue) < 8) finishSab();
          }
        }}
      >
        <Thermometer size={100} className="text-orange-400 mb-8 animate-pulse" />
        <h2 className="text-5xl font-black uppercase italic text-white mb-2 leading-none">SET THE OVEN!</h2>
        <p className="text-xl font-bold text-orange-200 mb-8 uppercase tracking-widest">
          Target: <span className="bg-white text-orange-950 px-4 py-1 rounded-lg ml-2">{sab.targetValue}°F</span>
        </p>
        <div className="w-64 h-64 rounded-full border-[12px] border-stone-700 bg-stone-900 flex items-center justify-center relative shadow-[0_0_50px_rgba(0,0,0,0.5)] active:scale-105 transition-transform">
           <div 
             className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
             style={{ transform: `rotate(${dialRotation}deg)` }}
           >
             <div className="w-3 h-24 bg-orange-600 rounded-full absolute -top-1 shadow-lg border-2 border-white"></div>
           </div>
           <div className="text-white font-black text-5xl tabular-nums drop-shadow-lg z-10">{Math.floor(dialRotation + 100)}°</div>
           <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none"></div>
        </div>
        <p className="mt-12 text-stone-500 font-bold uppercase text-xs tracking-[0.3em]">DRAG THE DIAL WITH YOUR FINGER</p>
      </div>
    );

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-10 bg-blue-800 touch-none select-none">
        <Wind size={150} className="text-white animate-pulse" />
        <h2 className="text-7xl font-black uppercase italic text-white">DRY IT!</h2>
        <p className="text-xl font-bold text-blue-100 uppercase tracking-widest">SHAKE YOUR PHONE TO DRY!</p>
        <div className="w-full max-w-md bg-stone-950 h-12 rounded-full border-4 border-white/20 overflow-hidden shadow-2xl">
           <div className="bg-blue-400 h-full transition-all duration-100" style={{ width: `${sabProgress}%` }}></div>
        </div>
      </div>
    );
  };

  if (isHost) {
    return (
      <div className="flex flex-col h-screen p-8 gap-8 max-w-[1200px] mx-auto w-full">
        <div className="flex justify-between items-center bg-stone-900 border-4 border-stone-800 p-8 rounded-[3rem] shadow-2xl">
           <div className="flex items-center gap-6">
             <div className="bg-orange-600 p-6 rounded-[1.5rem]"><ChefHat className="text-white" size={48} /></div>
             <div>
               <p className="text-orange-500 font-black uppercase text-xs tracking-widest">ROUND {roomData.currentRound}: {currentRule.title}</p>
               <h2 className="text-5xl font-black uppercase italic tracking-tighter">{roomData.players[roomData.activeChefId]?.name}</h2>
             </div>
           </div>
           <div className={`p-6 rounded-[2rem] border-4 ${timeLeft < 15 ? 'border-red-600 text-red-500 animate-pulse' : 'border-stone-800 bg-stone-950 text-white'}`}>
             <span className="text-8xl font-black tabular-nums">{timeLeft}</span>
           </div>
        </div>
        
        <div className="flex-1 grid grid-cols-12 gap-8">
          <div className="col-span-8 bg-stone-900/40 rounded-[4rem] border-4 border-stone-900 p-12 flex flex-col items-center justify-center relative">
             <div className="flex flex-col items-center gap-4 bg-white/5 p-10 rounded-[3rem] border border-white/10">
                <p className="text-orange-500 font-black uppercase tracking-[0.5em] text-sm">Rules of the Kitchen:</p>
                <h4 className="text-4xl font-black italic text-white uppercase text-center">{currentRule.rule}</h4>
                <p className="text-stone-500 font-bold uppercase text-xs text-center">{currentRule.sub}</p>
             </div>

             <div className="w-full max-w-2xl bg-stone-950 h-32 rounded-full border-4 border-stone-800 flex items-center px-6 gap-3 mt-16 shadow-inner">
                {roomData.completedIngredients.map((_, i) => <div key={i} className="flex-1 bg-orange-600 h-20 rounded-full flex items-center justify-center animate-in zoom-in"><CheckCircle2 className="text-white" size={32} /></div>)}
                {Array.from({ length: Math.max(0, 5 - roomData.completedIngredients.length) }).map((_, i) => <div key={i} className="flex-1 h-20 rounded-full border-2 border-stone-800 border-dashed opacity-20"></div>)}
             </div>
          </div>

          <div className="col-span-4 flex flex-col gap-8">
            <div className="bg-stone-900 p-8 rounded-[3rem] border-2 border-stone-800 shadow-xl overflow-y-auto">
              <h4 className="font-black uppercase text-red-500 mb-6 flex items-center gap-4 tracking-tighter text-2xl"><Skull size={32} /> Sabotages</h4>
              <div className="space-y-4">
                {Object.entries(roomData.sabotages || {}).map(([sid, sab]) => sab && (
                  <div key={sid} className="flex items-center gap-4 p-4 bg-stone-950 rounded-2xl border border-red-900/50 animate-pulse">
                    <Zap className="text-orange-500" size={24} />
                    <p className="font-black text-lg uppercase italic text-red-500 truncate">{roomData.players[sid]?.name}!</p>
                  </div>
                ))}
                {Object.values(roomData.sabotages || {}).every(s => !s) && <p className="text-stone-800 font-black uppercase italic py-8 text-center opacity-30">All Quiet...</p>}
              </div>
            </div>
            
            <div className="flex-1 bg-stone-900 p-8 rounded-[3rem] border-2 border-stone-800 overflow-y-auto">
              <h4 className="font-black uppercase text-stone-600 mb-6 text-sm">Scoreboard</h4>
              <div className="space-y-3">
                {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className="flex justify-between items-center p-4 rounded-[1.5rem] bg-stone-950 border border-stone-800">
                    <span className="text-lg font-black uppercase text-stone-300">{p.name}</span>
                    <span className="text-xl font-black text-orange-500">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isChef) {
    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-stone-950 text-center">
          <div className="mb-8">
            <div className="bg-orange-600 w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl animate-bounce"><ChefHat size={48} className="text-white" /></div>
            <p className="text-orange-500 font-black uppercase text-xs tracking-widest mb-1">{currentRule.title}</p>
            <h2 className="text-4xl font-black uppercase italic text-white">{currentRule.rule}</h2>
          </div>

          <div className="bg-white text-black p-12 rounded-[4rem] w-full max-w-md shadow-2xl border-b-[16px] border-stone-300">
             <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Tell them this:</p>
             <h2 className="text-6xl font-black uppercase italic leading-none tracking-tighter break-words">{roomData.currentIngredient}</h2>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-6 w-full max-w-md">
             <div className="bg-stone-900 p-8 rounded-[3rem] border-4 border-stone-800"><p className="text-xs font-black text-stone-600 mb-1">PREPPED</p><p className="text-5xl font-black text-orange-500">{roomData.chefSuccessCount}</p></div>
             <div className="bg-stone-900 p-8 rounded-[3rem] border-4 border-stone-800"><p className="text-xs font-black text-stone-600 mb-1">TIME</p><p className={`text-5xl font-black ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}</p></div>
          </div>

          {currentRule.allowSkip && (
            <button onClick={skipIngredient} className="mt-10 bg-red-600 text-white px-12 py-5 rounded-full font-black uppercase tracking-widest text-lg hover:scale-105 active:scale-95 transition-all shadow-xl">
              Skip Order (-200)
            </button>
          )}
      </div>
    );
  }

  const activeSab = roomData.sabotages?.[user.uid];
  const isLockedOut = roomData.players?.[user.uid]?.isLockedOut;

  if (isLockedOut) return (
    <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-12 text-center">
      <div className="bg-white p-12 rounded-[3rem] mb-12 transform -rotate-12 shadow-2xl border-b-[16px] border-stone-200">
        <Skull size={180} className="text-red-600" />
      </div>
      <h2 className="text-[6rem] font-black uppercase italic text-white mb-6 leading-none tracking-tighter">86'ED!</h2>
      <p className="text-white font-black uppercase text-2xl">WRONG INGREDIENT!</p>
      <p className="text-red-200 font-bold uppercase text-sm mt-4">Wait for the next order to clear...</p>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {activeSab ? renderSabotage() : (
        <>
          <div className="p-6 bg-stone-900 border-b-4 border-stone-800 flex justify-between items-center shadow-2xl">
             <div><p className="text-[10px] font-black uppercase text-stone-500">Wallet</p><p className="text-4xl font-black text-orange-500 tabular-nums">{roomData.players?.[user.uid]?.score || 0}</p></div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-stone-500 tracking-widest">Sabotage</p>
                <div className="flex gap-1 justify-end">{Array.from({ length: 12 }).map((_, i) => <Zap key={i} size={24} className={i < (roomData.players?.[user.uid]?.sabotageCharges || 0) ? 'text-blue-500 fill-blue-500' : 'text-stone-700'} />)}</div>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-stone-950">
             <div className="p-6 bg-blue-950/40 rounded-[2.5rem] border-2 border-blue-900/50">
                <div className="flex items-center gap-3 mb-4"><Skull className="text-blue-400" size={24} /><p className="text-xs font-black uppercase text-blue-400 tracking-[0.4em]">Sabotage a Rival:</p></div>
                <select className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-xl outline-none border-b-[10px] border-blue-800 active:translate-y-1 transition-all appearance-none" onChange={(e) => { triggerSabotage(e.target.value); e.target.value = ''; }} disabled={(roomData.players?.[user.uid]?.sabotageCharges || 0) <= 0}>
                   <option value="">-- PICK VICTIM --</option>
                   {Object.values(roomData.players).filter(p => p.id !== user.uid && p.id !== roomData.activeChefId).map(p => <option key={p.id} value={p.id} disabled={roomData.sabotages?.[p.id]}>{p.name}</option>)}
                </select>
             </div>
             
             <div className="space-y-3 pb-32">
                <p className="text-[10px] font-black uppercase text-stone-700 tracking-[0.6em] text-center my-6">Select Ingredient</p>
                {pantryShuffle.map((ing, idx) => (
                  <button key={idx} onClick={() => handleGuess(ing)} className="w-full bg-stone-900 border-b-[10px] border-stone-800 p-6 rounded-[2.5rem] text-left font-black uppercase text-xl text-white active:bg-orange-600 active:border-orange-800 active:translate-y-1 transition-all">
                    {ing}
                  </button>
                ))}
             </div>
          </div>
        </>
      )}
    </div>
  );
}

function ResultsView({ roomData, roomCode, role, appId }) {
  const players = Object.values(roomData.players).sort((a,b) => b.score - a.score);
  const isHost = role === 'HOST';

  const reset = async () => {
    if (!db) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const up = { status: 'LOBBY', currentRound: 1, currentChefIndex: 0, pantry: [], deck: [], discard: [], completedIngredients: [], sabotages: {}, lastChefStats: null, isChefReady: false, intermissionTimer: 0 };
    Object.keys(roomData.players).forEach(id => { 
      up[`players.${id}.score`] = 0; 
      up[`players.${id}.ready`] = false; 
      up[`players.${id}.isLockedOut`] = false; 
      up[`players.${id}.sabotageCharges`] = 12; // UPDATED TO 12
    });
    await updateDoc(roomRef, up);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-4 text-center overflow-y-auto">
        <div className="flex flex-col items-center mb-8 mt-4 animate-in zoom-in duration-500">
          <Trophy size={80} className="text-orange-500 mb-4" />
          <h1 className="text-6xl md:text-8xl font-black italic uppercase text-white leading-none tracking-tighter drop-shadow-2xl">THE VERDICT</h1>
        </div>
        
        <div className="w-full max-w-2xl space-y-3 mb-8">
          {players.map((p, i) => (
            <div key={p.id} className={`p-6 rounded-[2rem] border-4 flex justify-between items-center transition-all ${i === 0 ? 'bg-white text-black border-orange-500 scale-105 shadow-2xl' : 'bg-stone-900/50 border-stone-800'}`}>
               <div className="flex items-center gap-6">
                 <span className={`text-4xl font-black italic ${i === 0 ? 'text-orange-500' : 'opacity-20'}`}>#{i+1}</span>
                 <p className="text-3xl font-black uppercase italic tracking-tighter">{p.name}</p>
               </div>
               <p className={`text-4xl font-black ${i === 0 ? 'text-orange-600' : 'text-stone-500'}`}>{p.score} <span className="text-sm">PTS</span></p>
            </div>
          ))}
        </div>
        
        {isHost && (
          <button onClick={reset} className="mt-4 bg-orange-600 hover:bg-orange-500 text-white px-12 py-6 rounded-[2.5rem] text-3xl font-black uppercase active:scale-95 transition-all border-b-8 border-orange-800 mb-10 shadow-xl">
            Re-Open Kitchen
          </button>
        )}
    </div>
  );
}

// --- NEW COMPONENT: Rules Modal ---
function RulesModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-stone-900 w-full max-w-lg max-h-[85vh] rounded-[2.5rem] border-4 border-stone-700 flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b-4 border-stone-800 flex justify-between items-center bg-stone-950 rounded-t-[2.2rem]">
          <h2 className="text-3xl font-black uppercase italic text-orange-500 tracking-tighter">Chef's Manual</h2>
          <button onClick={onClose} className="bg-stone-800 p-2 rounded-full hover:bg-red-600 transition-colors">
            <Eraser size={24} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
          
          {/* Section 1: The Pantry */}
          <section>
            <div className="flex items-center gap-3 mb-2">
              <Utensils className="text-orange-500" />
              <h3 className="text-xl font-black uppercase text-white">1. Stock the Pantry</h3>
            </div>
            <p className="text-stone-400 font-bold text-sm leading-relaxed">
              Don't just list vegetables! The "Ingredients" are actually <span className="text-white">prompts</span> for the chefs to describe. 
              <br/><br/>
              <span className="text-orange-500">Good Examples:</span> "A Smelly Gym Sock", "My Ex-Wife", "The Concept of Time".
              <br/>
              <span className="text-red-500">Bad Examples:</span> "Carrot", "Onion".
            </p>
          </section>

          {/* Section 2: The Rounds */}
          <section>
            <div className="flex items-center gap-3 mb-2">
              <Timer className="text-blue-500" />
              <h3 className="text-xl font-black uppercase text-white">2. The Shifts</h3>
            </div>
            <div className="space-y-4">
              <div className="bg-stone-950 p-4 rounded-xl border border-stone-800">
                <p className="text-orange-500 font-black text-xs tracking-widest uppercase">Round 1</p>
                <p className="font-bold text-white">Say Anything</p>
                <p className="text-xs text-stone-500 mt-1">Describe the card freely. No skipping!</p>
              </div>
              <div className="bg-stone-950 p-4 rounded-xl border border-stone-800">
                <p className="text-blue-500 font-black text-xs tracking-widest uppercase">Round 2</p>
                <p className="font-bold text-white">One Word Only</p>
                <p className="text-xs text-stone-500 mt-1">You can only say ONE word per card.</p>
              </div>
              <div className="bg-stone-950 p-4 rounded-xl border border-stone-800">
                <p className="text-red-500 font-black text-xs tracking-widest uppercase">Round 3</p>
                <p className="font-bold text-white">Charades & Sounds</p>
                <p className="text-xs text-stone-500 mt-1">Act it out or make noises. No talking!</p>
              </div>
            </div>
          </section>

          {/* Section 3: Sabotage */}
          <section>
            <div className="flex items-center gap-3 mb-2">
              <Zap className="text-yellow-500" />
              <h3 className="text-xl font-black uppercase text-white">3. Sabotage</h3>
            </div>
            <p className="text-stone-400 font-bold text-sm leading-relaxed mb-4">
              You have <span className="text-white">12 Charges</span>. Use them to freeze other players' screens with mini-games!
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-stone-800 p-2 rounded-lg"><Wind size={20} className="mx-auto mb-1 text-blue-400"/><span className="text-[10px] font-black uppercase">Shake</span></div>
              <div className="bg-stone-800 p-2 rounded-lg"><Thermometer size={20} className="mx-auto mb-1 text-orange-400"/><span className="text-[10px] font-black uppercase">Dial</span></div>
              <div className="bg-stone-800 p-2 rounded-lg"><HandMetal size={20} className="mx-auto mb-1 text-emerald-400"/><span className="text-[10px] font-black uppercase">Chop</span></div>
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <div className="p-6 border-t-4 border-stone-800 bg-stone-950 rounded-b-[2.2rem]">
          <button onClick={onClose} className="w-full bg-orange-600 py-4 rounded-xl font-black uppercase text-xl shadow-lg active:scale-95 transition-all">
            Yes Chef!
          </button>
        </div>
      </div>
    </div>
  );
}
