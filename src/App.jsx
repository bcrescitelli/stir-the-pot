import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
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
  AlertCircle, 
  CheckCircle2, 
  Flame, 
  Utensils,
  Trophy,
  RotateCcw,
  Skull,
  Volume2,
  VolumeX,
  Zap,
  Star,
  Hand,
  Waves
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = typeof __app_id !== 'undefined' ? __app_id : 'stir-the-pot-game';

// --- Constants & Helpers ---
const ROUND_TIME = 45;
const DISH_NAMES = [
  "The Sunday Morning Mistake",
  "The Boss's Retirement Party",
  "A Wedding to Forget",
  "Last Night's Regrets",
  "The Health Inspector's Nightmare",
  "Roommate's Mystery Tupperware",
  "The First Date Disaster"
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
  const [motionPermission, setMotionPermission] = useState('default');
  
  const introAudio = useRef(null);

  // Initialize Audio
  useEffect(() => {
    introAudio.current = new Audio('intro.mp3');
    introAudio.current.loop = true;
    
    return () => {
      if (introAudio.current) {
        introAudio.current.pause();
        introAudio.current = null;
      }
    };
  }, []);

  // Handle Auth
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
        setError("Connection failed. Check your Firebase config.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Room Listener
  useEffect(() => {
    if (!activeRoomCode || !user) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', activeRoomCode);
    
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomData(data);
        
        const isParticipant = data.hostId === user.uid || (data.players && data.players[user.uid]);
        
        if (isParticipant) {
          if (data.status === 'LOBBY') setView('LOBBY');
          if (data.status === 'PANTRY') setView('PANTRY');
          if (data.status === 'INTERMISSION') setView('INTERMISSION');
          if (data.status === 'PLAYING') setView('PLAYING');
          if (data.status === 'GAME_OVER') setView('RESULTS');

          if (data.status !== 'LOBBY' && introAudio.current) {
            introAudio.current.pause();
          }
        }
      } else if (role === 'PLAYER') {
        setError('Room no longer exists.');
        setView('LANDING');
      }
    }, (err) => {
      console.error("Snapshot error:", err);
    });

    return () => unsubscribe();
  }, [activeRoomCode, user, role]);

  // Request Motion Permission (iOS requirement)
  const requestMotion = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        setMotionPermission(response);
      } catch (e) {
        console.error("Permission denied", e);
      }
    } else {
      setMotionPermission('granted');
    }
  };

  // Actions
  const createRoom = async () => {
    if (!user) return;
    setError('');

    const newCode = generateRoomCode();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newCode);
    
    const initialData = {
      code: newCode,
      status: 'LOBBY',
      hostId: user.uid,
      players: {},
      pantry: [],
      deck: [],
      currentRound: 1,
      currentChefIndex: 0,
      currentIngredient: '',
      dishName: '',
      timer: 0,
      activeChefId: '',
      completedIngredients: [],
      chefSuccessCount: 0,
      turnOrder: [],
      intermissionTimer: 0,
      isGoldenOrder: false,
      sabotages: {} // { userId: { type: 'SCRUB', progress: 0 } }
    };

    try {
      await setDoc(roomRef, initialData);
      setRole('HOST');
      setActiveRoomCode(newCode);
      setView('LOBBY');
    } catch (err) {
      console.error("Failed to create room:", err);
      setError("Failed to open kitchen.");
    }
  };

  const joinRoom = async () => {
    if (!user || !inputCode || !playerName) {
      setError("Name and Code are required.");
      return;
    }
    setError('');
    await requestMotion(); // Ask for sensor permission on join click

    const cleanCode = inputCode.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', cleanCode);
    
    try {
      const snapshot = await getDoc(roomRef);

      if (!snapshot.exists()) {
        setError('Room code not found.');
        return;
      }

      const updates = {};
      updates[`players.${user.uid}`] = {
        id: user.uid,
        name: playerName,
        score: 0,
        isLockedOut: false,
        ready: false,
        sabotageCharges: 3 // Everyone gets 3 scrub sabotages
      };

      await updateDoc(roomRef, updates);
      setRole('PLAYER');
      setActiveRoomCode(cleanCode);
      setView('LOBBY');
    } catch (err) {
      console.error("Failed to join room:", err);
      setError("Failed to join.");
    }
  };

  const syncAudio = () => {
    if (introAudio.current) {
      introAudio.current.currentTime = 0;
      introAudio.current.play().catch(e => console.error("Audio blocked", e));
    }
  };

  const toggleMute = () => {
    if (introAudio.current) {
      introAudio.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (!user && !error) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="animate-spin mb-4 text-orange-500">
          <Utensils size={48} />
        </div>
        <p className="font-black uppercase tracking-widest animate-pulse">Preheating the Oven...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-orange-500 selection:text-white overflow-hidden">
      {role === 'HOST' && view === 'LOBBY' && (
        <div className="fixed top-6 right-6 z-50 flex gap-2">
           <button 
            onClick={syncAudio}
            className="p-4 bg-orange-600 hover:bg-orange-500 rounded-full border border-orange-400 transition-all active:scale-95 flex items-center gap-2 font-black text-xs uppercase"
          >
            <Volume2 size={24} /> Sync Audio
          </button>
          <button 
            onClick={toggleMute}
            className="p-4 bg-stone-900/50 hover:bg-stone-800 rounded-full border border-stone-800 transition-all active:scale-95"
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
        </div>
      )}

      {view === 'LANDING' && <LandingView setInputCode={setInputCode} inputCode={inputCode} setPlayerName={setPlayerName} createRoom={createRoom} joinRoom={joinRoom} error={error} />}
      {view === 'LOBBY' && <LobbyView roomCode={activeRoomCode} roomData={roomData} role={role} appId={appId} />}
      {view === 'PANTRY' && <PantryView roomCode={activeRoomCode} roomData={roomData} user={user} role={role} appId={appId} />}
      {view === 'INTERMISSION' && <IntermissionView roomCode={activeRoomCode} roomData={roomData} role={role} user={user} appId={appId} />}
      {view === 'PLAYING' && <GameView roomCode={activeRoomCode} roomData={roomData} user={user} role={role} appId={appId} />}
      {view === 'RESULTS' && <ResultsView roomData={roomData} roomCode={activeRoomCode} role={role} appId={appId} />}
    </div>
  );
}

// --- Views ---

function LandingView({ setInputCode, inputCode, setPlayerName, createRoom, joinRoom, error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-stone-950 to-stone-950">
      <div className="mb-12 text-center animate-in fade-in zoom-in duration-700">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-orange-600 p-4 rounded-3xl rotate-12 shadow-2xl shadow-orange-900/50">
            <Utensils size={64} className="text-white -rotate-12" />
          </div>
        </div>
        <h1 className="text-7xl font-black italic tracking-tighter text-white uppercase drop-shadow-2xl leading-none">
          Stir the <span className="text-orange-500 underline decoration-8 decoration-orange-600/50 underline-offset-8">Pot</span>
        </h1>
        <p className="text-stone-400 mt-4 font-black tracking-widest uppercase text-xs">The High-Stakes Kitchen Sabotage Game</p>
      </div>

      <div className="w-full max-w-sm space-y-4 bg-stone-900/50 p-8 rounded-[2.5rem] border border-stone-800 backdrop-blur-sm shadow-2xl">
        <input 
          type="text" 
          placeholder="YOUR NAME" 
          className="w-full bg-stone-800 border-2 border-stone-700 rounded-2xl px-6 py-4 text-center font-black text-xl uppercase focus:border-orange-500 outline-none transition-all placeholder:opacity-20"
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <input 
          type="text" 
          placeholder="ROOM CODE" 
          value={inputCode}
          className="w-full bg-stone-800 border-2 border-stone-700 rounded-2xl px-6 py-4 text-center font-black text-xl uppercase focus:border-orange-500 outline-none transition-all placeholder:opacity-20"
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
        />
        <button 
          onClick={joinRoom}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl text-xl uppercase transition-all active:scale-95 shadow-xl shadow-orange-900/20"
        >
          Enter the Kitchen
        </button>
        <div className="flex items-center gap-4 py-2">
          <div className="h-px flex-1 bg-stone-800"></div>
          <span className="text-stone-600 font-bold text-xs uppercase">or</span>
          <div className="h-px flex-1 bg-stone-800"></div>
        </div>
        <button 
          onClick={createRoom}
          className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold py-4 rounded-2xl uppercase transition-colors"
        >
          Host on TV
        </button>
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-500 font-bold text-sm text-left leading-tight">
            <AlertCircle size={24} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LobbyView({ roomCode, roomData, role, appId }) {
  const players = roomData?.players ? Object.values(roomData.players) : [];

  const startGame = async () => {
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      await updateDoc(roomRef, { 
        status: 'PANTRY',
        turnOrder: players.map(p => p.id).sort(() => Math.random() - 0.5)
      });
    } catch (err) {
      console.error("Start failed:", err);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-stone-900 to-stone-950">
      <div className="w-full flex justify-between items-start mb-12">
        <div className="bg-white text-black p-8 rounded-[3rem] shadow-2xl transform -rotate-3 border-b-8 border-stone-300">
          <p className="text-[12px] font-black uppercase tracking-tighter mb-1 opacity-50">Room Code</p>
          <p className="text-8xl font-black tracking-tighter leading-none tabular-nums">{roomCode}</p>
        </div>
        <div className="text-right">
          <h2 className="text-5xl font-black italic uppercase text-orange-500 tracking-tighter">Kitchen Lobby</h2>
          <p className="text-stone-500 font-black uppercase tracking-[0.3em] text-xs">Assemble the Chefs...</p>
        </div>
      </div>

      <div className="flex-1 w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-8">
        {players.map((p) => (
          <div key={p.id} className="bg-stone-900 border-2 border-stone-800 p-8 rounded-[3rem] flex flex-col items-center justify-center gap-4 animate-in slide-in-from-bottom-4 shadow-xl">
            <div className="w-24 h-24 bg-orange-600 rounded-[2rem] flex items-center justify-center shadow-lg shadow-orange-900/40 transform rotate-2">
              <ChefHat className="text-white" size={48} />
            </div>
            <p className="font-black text-2xl uppercase truncate w-full text-center tracking-tight">{p.name}</p>
          </div>
        ))}
        {players.length < 8 && Array.from({ length: 8 - players.length }).map((_, i) => (
          <div key={i} className="border-4 border-stone-900 border-dashed p-8 rounded-[3rem] flex items-center justify-center opacity-10">
             <Users className="text-stone-700" size={56} />
          </div>
        ))}
      </div>

      {role === 'HOST' && (
        <div className="mt-12 w-full max-w-md">
          <button 
            disabled={players.length < 2}
            onClick={startGame}
            className={`w-full py-8 rounded-[2.5rem] flex items-center justify-center gap-4 text-3xl font-black uppercase transition-all shadow-2xl
              ${players.length < 2 ? 'bg-stone-800 text-stone-600 cursor-not-allowed' : 'bg-white text-black hover:bg-orange-500 hover:text-white hover:scale-105 active:scale-95'}
            `}
          >
            <Play fill="currentColor" size={32} />
            {players.length < 2 ? 'Need 2+ Players' : 'Stock the Pantry'}
          </button>
        </div>
      )}
    </div>
  );
}

function PantryView({ roomCode, roomData, user, role, appId }) {
  const [items, setItems] = useState(['', '', '', '', '']); 
  const isReady = roomData?.players?.[user.uid]?.ready;
  const isHost = role === 'HOST';

  const submitPantry = async () => {
    if (items.some(i => i.trim() === '')) return;
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      await updateDoc(roomRef, {
        pantry: arrayUnion(...items.map(i => i.trim().toUpperCase()))
      });

      const updateReady = {};
      updateReady[`players.${user.uid}.ready`] = true;
      await updateDoc(roomRef, updateReady);
    } catch (err) {
      console.error("Pantry failed:", err);
    }
  };

  const checkAllReady = async () => {
    const players = Object.values(roomData.players);
    if (players.length > 0 && players.every(p => p.ready)) {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      const shuffledDeck = [...roomData.pantry].sort(() => Math.random() - 0.5);
      await updateDoc(roomRef, { 
        deck: shuffledDeck,
        status: 'INTERMISSION', 
        activeChefId: roomData.turnOrder[0],
        intermissionTimer: 5 
      });
    }
  };

  useEffect(() => {
    if (isHost && roomData?.status === 'PANTRY') {
      checkAllReady();
    }
  }, [roomData, isHost]);

  if (isHost) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-12 bg-stone-950">
        <div className="text-center space-y-8 max-w-2xl">
          <div className="bg-orange-600 w-32 h-32 rounded-[3rem] mx-auto flex items-center justify-center shadow-2xl animate-pulse">
            <Utensils size={64} className="text-white" />
          </div>
          <h2 className="text-6xl font-black uppercase italic text-white tracking-tighter">Stocking the Pantry</h2>
          <p className="text-stone-400 font-bold uppercase text-xl tracking-widest leading-relaxed">Players are submitting their 5 ingredients now...</p>
          <div className="flex justify-center gap-4">
             {Object.values(roomData.players).map(p => (
               <div key={p.id} className={`w-4 h-4 rounded-full transition-colors duration-500 ${p.ready ? 'bg-green-500' : 'bg-stone-800'}`}></div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center bg-stone-950 overflow-y-auto">
      <div className="max-w-md w-full text-center space-y-8 mt-4 mb-20">
        <h2 className="text-4xl font-black italic uppercase text-orange-500 tracking-tighter">Submit Your 5 Ingredients</h2>
        {!isReady ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
            {items.map((val, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={35}
                placeholder={`ITEM ${idx + 1}...`}
                className="w-full bg-stone-900 border-2 border-stone-800 rounded-2xl px-6 py-4 font-black text-lg uppercase outline-none focus:border-orange-600 transition-all text-white placeholder:opacity-10"
                value={val}
                onChange={(e) => {
                  const n = [...items];
                  n[idx] = e.target.value;
                  setItems(n);
                }}
              />
            ))}
            <button 
              onClick={submitPantry}
              className="w-full bg-white text-black font-black py-5 rounded-2xl text-xl uppercase transition-all active:scale-95 shadow-xl mt-4 hover:bg-orange-500 hover:text-white"
            >
              Order Up!
            </button>
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center gap-6 animate-in zoom-in">
            <CheckCircle2 size={100} className="text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" />
            <p className="font-black text-3xl uppercase italic tracking-tighter">INGREDIENTS READY</p>
          </div>
        )}
      </div>
    </div>
  );
}

function IntermissionView({ roomCode, roomData, role, user, appId }) {
  const isHost = role === 'HOST';
  const nextChef = roomData.players[roomData.activeChefId]?.name || "Someone";
  const [localTimer, setLocalTimer] = useState(5);
  const countdownInterval = useRef(null);

  useEffect(() => {
    if (isHost) {
      setLocalTimer(5);
      clearInterval(countdownInterval.current);
      countdownInterval.current = setInterval(async () => {
        setLocalTimer(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            startTheGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownInterval.current);
  }, [isHost, roomData.activeChefId]);

  const startTheGame = async () => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    await updateDoc(roomRef, { status: 'PLAYING', timer: 0 }); 
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-10 text-center">
      <div className="animate-in zoom-in duration-500">
        <div className="bg-orange-600 p-8 rounded-[3rem] inline-block mb-10 shadow-2xl rotate-3">
          <ChefHat size={120} className="text-white" />
        </div>
        <p className="text-stone-500 font-black uppercase tracking-[0.5em] text-sm mb-4">Next Chef Up:</p>
        <h2 className="text-8xl font-black uppercase italic text-white tracking-tighter mb-12 leading-none">
          {nextChef}
        </h2>
        <div className="flex flex-col items-center gap-4">
           <div className="bg-stone-900 border-2 border-stone-800 w-32 h-32 rounded-full flex items-center justify-center">
              <span className="text-6xl font-black text-orange-500 tabular-nums">{localTimer}</span>
           </div>
        </div>
      </div>
    </div>
  );
}

function GameView({ roomCode, roomData, user, role, appId }) {
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [pantryShuffle, setPantryShuffle] = useState([]);
  const [scrubProgress, setScrubProgress] = useState(0); // 0 to 100
  const isChef = roomData.activeChefId === user.uid;
  const isHost = role === 'HOST';
  const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
  
  const timerInterval = useRef(null);
  const shuffleInterval = useRef(null);
  const motionRef = useRef({ lastX: 0, lastY: 0, lastZ: 0 });

  // SHAKE DETECTION
  useEffect(() => {
    const activeSabotage = roomData.sabotages?.[user.uid];
    if (activeSabotage && activeSabotage.type === 'SCRUB') {
      const handleMotion = (event) => {
        const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
        const delta = Math.abs(x - motionRef.current.lastX) + 
                      Math.abs(y - motionRef.current.lastY) + 
                      Math.abs(z - motionRef.current.lastZ);

        if (delta > 15) { // Shake Threshold
          setScrubProgress(prev => {
            const next = prev + 2;
            if (next >= 100) finishScrub();
            return next;
          });
        }
        motionRef.current = { lastX: x, lastY: y, lastZ: z };
      };

      window.addEventListener('devicemotion', handleMotion);
      return () => window.removeEventListener('devicemotion', handleMotion);
    } else {
      setScrubProgress(0);
    }
  }, [roomData.sabotages?.[user.uid], user.uid]);

  const finishScrub = async () => {
    const updates = {};
    updates[`sabotages.${user.uid}`] = null;
    await updateDoc(roomRef, updates);
  };

  const triggerSabotage = async (targetId) => {
    if (roomData.players[user.uid].sabotageCharges <= 0) return;
    if (roomData.sabotages?.[targetId]) return; // Already sabotaged
    
    const updates = {};
    updates[`sabotages.${targetId}`] = { type: 'SCRUB', progress: 0 };
    updates[`players.${user.uid}.sabotageCharges`] = roomData.players[user.uid].sabotageCharges - 1;
    await updateDoc(roomRef, updates);
  };

  // Sync Timer Logic
  useEffect(() => {
    if (isHost && roomData.activeChefId && roomData.timer === 0) {
      startTurn();
    }
    return () => {
      clearInterval(timerInterval.current);
      clearInterval(shuffleInterval.current);
    };
  }, [roomData.activeChefId, isHost]);

  useEffect(() => {
    if (!isHost) {
      const doShuffle = () => setPantryShuffle([...roomData.pantry].sort(() => Math.random() - 0.5));
      doShuffle();
      shuffleInterval.current = setInterval(doShuffle, 15000); 
    }
    return () => clearInterval(shuffleInterval.current);
  }, [roomData.pantry, isHost]);

  useEffect(() => {
    if (roomData.timer > 0) setTimeLeft(roomData.timer);
  }, [roomData.timer]);

  const startTurn = async () => {
    const randomDish = DISH_NAMES[Math.floor(Math.random() * DISH_NAMES.length)];
    const deck = roomData.deck || [];
    const randomIngredient = deck[0] || "MISSING INGREDIENT";
    
    try {
      await updateDoc(roomRef, {
        timer: ROUND_TIME,
        dishName: randomDish,
        currentIngredient: randomIngredient,
        chefSuccessCount: 0,
        completedIngredients: [],
        isGoldenOrder: Math.random() > 0.8,
        sabotages: {} // Clear all sabotages for new turn
      });

      let localTimer = ROUND_TIME;
      clearInterval(timerInterval.current);
      timerInterval.current = setInterval(async () => {
        localTimer -= 1;
        if (localTimer <= 0) {
          clearInterval(timerInterval.current);
          finishShift();
        } else {
          await updateDoc(roomRef, { timer: localTimer });
        }
      }, 1000);
    } catch (err) {
      console.error("Turn start failed:", err);
    }
  };

  const finishShift = async () => {
    const nextChefIndex = roomData.currentChefIndex + 1;
    let nextRound = roomData.currentRound;
    
    if (nextChefIndex >= roomData.turnOrder.length) {
      if (nextRound < 3) {
        await updateDoc(roomRef, { 
          status: 'INTERMISSION', 
          currentRound: nextRound + 1,
          currentChefIndex: 0,
          activeChefId: roomData.turnOrder[0],
          timer: 0
        });
      } else {
        await updateDoc(roomRef, { status: 'GAME_OVER' });
      }
    } else {
      await updateDoc(roomRef, { 
        status: 'INTERMISSION',
        currentChefIndex: nextChefIndex,
        activeChefId: roomData.turnOrder[nextChefIndex],
        timer: 0
      });
    }
  };

  const handleGuess = async (guess) => {
    if (roomData.players[user.uid].isLockedOut) return;
    if (roomData.sabotages?.[user.uid]) return; // Cannot guess while scrubbing
    
    try {
      if (guess === roomData.currentIngredient) {
        const currentDeck = [...roomData.deck];
        currentDeck.shift(); 
        if (currentDeck.length === 0) currentDeck.push(...[...roomData.pantry].sort(() => Math.random() - 0.5));

        const nextIngredient = currentDeck[0];
        const multiplier = roomData.isGoldenOrder ? 2 : 1;
        const updates = {
          deck: currentDeck,
          currentIngredient: nextIngredient,
          chefSuccessCount: roomData.chefSuccessCount + 1,
          completedIngredients: arrayUnion(roomData.currentIngredient),
          isGoldenOrder: Math.random() > 0.8
        };
        updates[`players.${user.uid}.score`] = (roomData.players[user.uid]?.score || 0) + (500 * multiplier);
        updates[`players.${roomData.activeChefId}.score`] = (roomData.players[roomData.activeChefId]?.score || 0) + (300 * multiplier);
        Object.keys(roomData.players).forEach(id => { updates[`players.${id}.isLockedOut`] = false; });
        await updateDoc(roomRef, updates);
      } else {
        const multiplier = roomData.isGoldenOrder ? 3 : 1;
        const updates = {};
        updates[`players.${user.uid}.score`] = Math.max(0, (roomData.players[user.uid]?.score || 0) - (200 * multiplier));
        updates[`players.${user.uid}.isLockedOut`] = true;
        await updateDoc(roomRef, updates);
      }
    } catch (err) { console.error(err); }
  };

  const skipIngredient = async () => {
    if (roomData.currentRound === 1) return;
    const currentDeck = [...roomData.deck];
    currentDeck.shift();
    if (currentDeck.length === 0) currentDeck.push(...[...roomData.pantry].sort(() => Math.random() - 0.5));
    const nextIngredient = currentDeck[0];
    const updates = { deck: currentDeck, currentIngredient: nextIngredient, isGoldenOrder: Math.random() > 0.8 };
    updates[`players.${user.uid}.score`] = Math.max(0, (roomData.players[user.uid]?.score || 0) - 100);
    await updateDoc(roomRef, updates);
  };

  if (isHost) {
    const isHeatOn = timeLeft < 15;
    return (
      <div className={`flex flex-col h-screen p-8 gap-8 transition-colors duration-1000 ${isHeatOn ? 'bg-orange-950' : 'bg-stone-950'}`}>
        <div className="flex justify-between items-center bg-stone-900 border-4 border-stone-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
           <div className="flex items-center gap-8 relative">
              <div className={`p-6 rounded-3xl shadow-xl ${roomData.isGoldenOrder ? 'bg-yellow-500' : 'bg-orange-600'}`}>
                {roomData.isGoldenOrder ? <Star className="text-white" size={48} /> : <ChefHat className="text-white" size={48} />}
              </div>
              <div>
                <p className="text-orange-500 font-black uppercase text-sm tracking-[0.4em]">Shift {roomData.currentRound}</p>
                <h2 className="text-6xl font-black uppercase italic tracking-tighter leading-none">{roomData.players[roomData.activeChefId]?.name}</h2>
              </div>
           </div>
           <div className={`p-6 rounded-[2rem] flex items-center gap-6 border-4 shadow-inner ${timeLeft < 10 ? 'border-red-600 text-red-500 animate-pulse' : 'border-stone-800 text-white'}`}>
              <span className="text-7xl font-black font-mono leading-none">{timeLeft}</span>
           </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-8">
          <div className="col-span-8 bg-stone-900/40 rounded-[4rem] border-4 border-stone-900 p-12 flex flex-col items-center justify-center relative shadow-inner">
             <p className="text-stone-600 font-black uppercase tracking-[0.4em] mb-6 text-sm">Now Cooking:</p>
             <h3 className="text-9xl font-black italic text-center mb-16 uppercase leading-none tracking-tighter">"{roomData.dishName}"</h3>
             <div className="w-full max-w-2xl bg-stone-950 h-32 rounded-full border-4 border-stone-800 flex items-center px-6 gap-3 relative shadow-2xl">
                {roomData.completedIngredients.map((ing, i) => (
                  <div key={i} className="flex-1 bg-orange-600 h-20 rounded-full flex items-center justify-center animate-in zoom-in border-b-4 border-orange-800">
                    <CheckCircle2 className="text-white" size={32} />
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 5 - roomData.completedIngredients.length) }).map((_, i) => (
                  <div key={i} className="flex-1 h-20 rounded-full border-2 border-stone-800 border-dashed opacity-20"></div>
                ))}
             </div>
          </div>

          <div className="col-span-4 flex flex-col gap-8">
            <div className="bg-stone-900 p-10 rounded-[3rem] border-2 border-stone-800 shadow-xl overflow-hidden relative">
              <h4 className="font-black uppercase text-red-500 mb-8 flex items-center gap-3 tracking-tighter text-xl"><Skull size={28} /> Kitchen Sabotage</h4>
              <div className="space-y-4">
                {Object.entries(roomData.sabotages || {}).map(([sid, sab]) => (
                  sab && (
                  <div key={sid} className="flex items-center gap-4 animate-bounce">
                    <Waves className="text-blue-500" size={32} />
                    <p className="font-black text-2xl uppercase italic text-blue-400">{roomData.players[sid]?.name} IS SCRUBBING!</p>
                  </div>
                  )
                ))}
              </div>
            </div>
            <div className="flex-1 bg-stone-900 p-10 rounded-[3rem] border-2 border-stone-800 shadow-xl flex flex-col overflow-y-auto">
              <h4 className="font-black uppercase text-stone-600 mb-8 text-sm">Leaderboard</h4>
              {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
                <div key={p.id} className="flex justify-between items-center mb-2 p-4 rounded-2xl bg-stone-950">
                  <span className="font-black text-xl uppercase">{p.name}</span>
                  <span className="font-black text-2xl text-orange-500">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isChef) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center bg-stone-950">
          <ChefHat size={80} className="text-orange-600 mb-10 animate-bounce" />
          <div className="bg-white text-black p-12 rounded-[4rem] w-full max-w-md shadow-2xl text-center">
             <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Describe This:</p>
             <h2 className="text-5xl font-black uppercase italic leading-none">{roomData.currentIngredient}</h2>
          </div>
          <div className="mt-10 bg-stone-900 p-6 rounded-3xl text-center w-full max-w-md border-2 border-stone-800">
             <span className="text-5xl font-black tabular-nums">{timeLeft}</span>
          </div>
          {roomData.currentRound > 1 && <button onClick={skipIngredient} className="mt-4 text-red-500 font-black uppercase tracking-widest">Skip (-100)</button>}
      </div>
    );
  }

  const isScrubbing = roomData.sabotages?.[user.uid];

  return (
    <div className={`h-screen flex flex-col ${isScrubbing ? 'bg-blue-950' : roomData.players?.[user.uid]?.isLockedOut ? 'bg-red-950' : 'bg-stone-950'}`}>
       {isScrubbing ? (
         <div className="flex-1 flex flex-col items-center justify-center p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-50 mix-blend-overlay"></div>
            <Waves size={100} className="text-blue-400 mb-10 animate-pulse" />
            <h2 className="text-5xl font-black uppercase italic text-white mb-4 leading-tight">SCRUB THE DISHES!</h2>
            <p className="text-blue-200 font-black uppercase tracking-widest mb-10">SHAKE YOUR PHONE TO CLEAN THE SCREEN!</p>
            <div className="w-full bg-blue-900 h-10 rounded-full border-4 border-white/20 overflow-hidden">
               <div className="bg-white h-full transition-all duration-200" style={{ width: `${scrubProgress}%` }}></div>
            </div>
         </div>
       ) : (
         <>
          <div className="p-6 bg-stone-900 border-b-4 border-stone-800 flex justify-between items-center shadow-lg">
             <div>
               <p className="text-[10px] font-black uppercase text-stone-600 tracking-widest">Wallet</p>
               <p className="text-3xl font-black text-orange-500">{roomData.players?.[user.uid]?.score || 0}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-stone-600 tracking-widest">Charges</p>
                <p className="text-2xl font-black text-blue-500">{(roomData.players?.[user.uid]?.sabotageCharges || 0)}x <Waves className="inline" size={20}/></p>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-950">
             {roomData.players?.[user.uid]?.isLockedOut && <div className="p-4 bg-red-600 text-white font-black text-center rounded-2xl animate-pulse">86'ed! Wait for next ingredient.</div>}
             
             {/* SABOTAGE PANEL */}
             <div className="p-4 bg-blue-950/30 rounded-3xl border-2 border-blue-900/50">
                <p className="text-[10px] font-black uppercase text-blue-400 mb-4 tracking-[0.4em]">Sabotage a rival guesser:</p>
                <div className="flex flex-wrap gap-2">
                   {Object.values(roomData.players).filter(p => p.id !== user.uid && p.id !== roomData.activeChefId).map(p => (
                     <button 
                        key={p.id}
                        disabled={roomData.players[user.uid].sabotageCharges <= 0 || roomData.sabotages?.[p.id]}
                        onClick={() => triggerSabotage(p.id)}
                        className="flex-1 bg-blue-600 disabled:opacity-30 disabled:grayscale text-white font-black px-4 py-3 rounded-xl text-xs uppercase flex items-center gap-2 justify-center"
                     >
                        <Hand size={14}/> {p.name}
                     </button>
                   ))}
                </div>
             </div>

             <div className="sticky top-0 bg-stone-950 py-4 z-10 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase text-stone-700 tracking-[0.4em]">Pantry</p>
             </div>
             {pantryShuffle.map((ing, idx) => (
               <button
                 key={idx}
                 disabled={roomData.players[user.uid].isLockedOut}
                 onClick={() => handleGuess(ing)}
                 className="w-full bg-stone-900 border-2 border-stone-800 p-6 rounded-[1.5rem] text-left font-black uppercase text-lg text-white active:bg-orange-600 disabled:opacity-20"
               >
                 {ing}
               </button>
             ))}
          </div>
         </>
       )}
    </div>
  );
}

function ResultsView({ roomData, roomCode, role, appId }) {
  const players = Object.values(roomData.players).sort((a,b) => b.score - a.score);
  const resetGame = async () => {
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      const updates = { status: 'LOBBY', currentRound: 1, currentChefIndex: 0, pantry: [], deck: [], completedIngredients: [], sabotages: {} };
      Object.keys(roomData.players).forEach(id => {
        updates[`players.${id}.score`] = 0; updates[`players.${id}.ready`] = false; updates[`players.${id}.isLockedOut`] = false; updates[`players.${id}.sabotageCharges`] = 3;
      });
      await updateDoc(roomRef, updates);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-stone-950 text-center">
        <Trophy size={100} className="text-orange-500 mb-10" />
        <h1 className="text-7xl font-black italic uppercase text-white mb-10 leading-none">THE VERDICT</h1>
        <div className="w-full max-w-md space-y-4">
          {players.map((p, i) => (
            <div key={p.id} className={`p-8 rounded-[3rem] border-4 ${i === 0 ? 'bg-white text-black border-orange-500 scale-110' : 'bg-stone-900 border-stone-800'}`}>
               <p className="text-4xl font-black uppercase italic">{p.name}</p>
               <p className="font-black opacity-50">{p.score} PTS</p>
            </div>
          ))}
        </div>
        {role === 'HOST' && <button onClick={resetGame} className="mt-20 bg-orange-600 text-white px-20 py-8 rounded-[3rem] text-3xl font-black uppercase">Play Again</button>}
    </div>
  );
}
