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
  Waves,
  HandMetal,
  Dna,
  RefreshCcw,
  Thermometer,
  Eraser
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

// --- Constants ---
const ROUND_TIME = 45;
const DISH_NAMES = [
  "The Sunday Morning Mistake",
  "The Boss's Retirement Party",
  "A Wedding to Forget",
  "Last Night's Regrets",
  "The Health Inspector's Nightmare",
  "Roommate's Mystery Tupperware",
  "The First Date Disaster",
  "Midnight Gas Station Run",
  "Grandma's Secret 'Medicine'"
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
    introAudio.current.volume = 0.8;
    return () => {
      if (introAudio.current) {
        introAudio.current.pause();
        introAudio.current = null;
      }
    };
  }, []);

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
        setError("Connection failed.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeRoomCode || !user) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', activeRoomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomData(data);
        
        // STRENGTHENED PARTICIPANT GUARD
        const isHost = data.hostId === user.uid;
        const isJoinedPlayer = data.players && data.players[user.uid];

        if (isHost || isJoinedPlayer) {
          if (data.status === 'LOBBY') setView('LOBBY');
          if (data.status === 'INTERMISSION') setView('INTERMISSION');
          if (data.status === 'PLAYING') setView('PLAYING');
          if (data.status === 'GAME_OVER') setView('RESULTS');
          
          if (introAudio.current) {
            introAudio.current.volume = data.status === 'PLAYING' ? 0.15 : 0.7;
          }
        }
      } else if (role === 'PLAYER') {
        setError('Kitchen closed.');
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
    if (!user) return;
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
      sabotages: {},
      lastChefStats: null,
      isGoldenOrder: false,
      isChefReady: false,
      intermissionTimer: 0
    };
    try {
      await setDoc(roomRef, initialData);
      setRole('HOST');
      setActiveRoomCode(newCode);
      setView('LOBBY');
      if (introAudio.current) introAudio.current.play().catch(e => console.log(e));
    } catch (e) { setError("Failed to create room."); }
  };

  const joinRoom = async () => {
    if (!user || !inputCode || !playerName) {
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
        sabotageCharges: 3 
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
          <button onClick={() => { if(introAudio.current) introAudio.current.play(); }} className="p-4 bg-orange-600 rounded-full border-4 border-orange-400 active:scale-90 shadow-2xl hover:bg-orange-500 transition-all"><Volume2 size={24} /></button>
          <button onClick={() => { if(introAudio.current) { introAudio.current.muted = !isMuted; setIsMuted(!isMuted); } }} className="p-4 bg-stone-800 rounded-full active:scale-90 border-4 border-stone-700 shadow-2xl">{isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}</button>
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
      <div className="mb-12 text-center animate-in fade-in duration-1000">
        <div className="bg-orange-600 p-6 rounded-[2rem] rotate-12 shadow-2xl mb-8 inline-block shadow-orange-900/50">
          <Utensils size={64} className="text-white -rotate-12" />
        </div>
        <h1 className="text-7xl font-black italic tracking-tighter uppercase leading-none text-white drop-shadow-2xl">Stir the <span className="text-orange-500 underline decoration-8 decoration-orange-600/50 underline-offset-8">Pot</span></h1>
        <p className="text-stone-400 mt-6 font-bold uppercase tracking-[0.4em] text-xs">High-Stakes Kitchen Sabotage</p>
      </div>
      <div className="w-full max-w-sm space-y-4 bg-stone-900/60 p-8 rounded-[2.5rem] border-2 border-stone-800 backdrop-blur-xl shadow-2xl">
        <input type="text" placeholder="CHEF NAME" className="w-full bg-stone-800 border-2 border-stone-700 rounded-xl p-4 text-center font-black text-lg uppercase focus:border-orange-500 outline-none transition-all placeholder:opacity-20" onChange={(e) => setPlayerName(e.target.value)} />
        <input type="text" placeholder="ROOM CODE" value={inputCode} className="w-full bg-stone-800 border-2 border-stone-700 rounded-xl p-4 text-center font-black text-lg uppercase focus:border-orange-500 outline-none transition-all placeholder:opacity-20" onChange={(e) => setInputCode(e.target.value.toUpperCase())} />
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
    const existingPantry = roomData.pantry || [];
    
    const duplicate = cleanItems.find(i => existingPantry.includes(i));
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
            <p className="text-8xl font-black leading-none tracking-tighter tabular-nums">{roomCode}</p>
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
          {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
             <div key={i} className="border-2 border-stone-900 border-dashed p-8 rounded-[2.5rem] flex items-center justify-center opacity-20"><Users size={32}/></div>
          ))}
        </div>
        <button disabled={players.length < 2 || !players.every(p => p.ready)} onClick={startGame} className="mt-16 px-16 py-6 bg-orange-600 text-white font-black text-3xl rounded-[2.5rem] shadow-2xl disabled:opacity-30 disabled:grayscale uppercase active:scale-95 transition-all">Start Game</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col bg-stone-950 overflow-y-auto pb-24">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black italic text-orange-500 uppercase tracking-tighter">Stock the Pantry</h2>
        <p className="text-stone-500 font-bold uppercase text-[10px] tracking-widest mt-2 px-8">Add your items below to stock the shared kitchen deck.</p>
      </div>
      {!isReady ? (
        <div className="space-y-3 animate-in slide-in-from-bottom-8 duration-700">
          {items.map((v, i) => (
            <div key={i} className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/30 font-black italic text-xl">{i+1}</span>
               <input maxLength={30} type="text" placeholder="Add your items..." className={`w-full bg-stone-900 pl-10 pr-4 py-4 rounded-xl font-black uppercase outline-none focus:border-orange-500 border-2 ${localError.includes(v.toUpperCase()) && v !== '' ? 'border-red-500' : 'border-stone-800'} transition-all text-lg`} value={v} onChange={(e) => { const n = [...items]; n[i] = e.target.value; setItems(n); }} />
            </div>
          ))}
          {localError && <div className="p-3 bg-red-600/20 border border-red-500 text-red-500 font-black text-xs uppercase text-center rounded-xl">{localError}</div>}
          <button onClick={submitPantry} className="w-full bg-orange-600 font-black py-6 rounded-[2rem] text-2xl uppercase shadow-2xl mt-8 active:scale-95 transition-all">Confirm Ingredients</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-20">
          <CheckCircle2 size={80} className="text-green-500 animate-bounce" />
          <p className="text-4xl font-black uppercase italic tracking-tighter">Ready!</p>
          <p className="text-stone-500 font-black uppercase tracking-widest text-xs">Wait for Host to open the kitchen...</p>
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
  const countdownInterval = useRef(null);

  useEffect(() => {
    if (isHost && roomData.isChefReady && roomData.intermissionTimer === 0) {
      startCountdown();
    }
  }, [roomData.isChefReady, isHost]);

  const startCountdown = async () => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    let count = 5;
    await updateDoc(roomRef, { intermissionTimer: count });
    
    clearInterval(countdownInterval.current);
    countdownInterval.current = setInterval(async () => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownInterval.current);
        await updateDoc(roomRef, { status: 'PLAYING', timer: 0, intermissionTimer: 0 });
      } else {
        await updateDoc(roomRef, { intermissionTimer: count });
      }
    }, 1000);
  };

  const handleChefReady = async () => {
    await requestPermissions();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    await updateDoc(roomRef, { isChefReady: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center max-w-[1200px] mx-auto w-full">
      <div className="w-full mb-8">
        <p className="text-[10px] font-black text-stone-600 uppercase mb-4 tracking-[0.4em]">Leaderboard Standings</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
             <div key={p.id} className={`p-4 rounded-[1.5rem] border-2 transition-all ${i === 0 ? 'bg-orange-600/10 border-orange-500 shadow-xl' : 'bg-stone-900/50 border-stone-800'}`}>
                <p className={`text-[10px] font-black italic mb-1 ${i === 0 ? 'text-orange-500' : 'text-stone-600'}`}>#{i+1}</p>
                <p className="text-lg font-black uppercase truncate tracking-tighter">{p.name}</p>
                <p className="text-2xl font-black text-white mt-1">{p.score}</p>
             </div>
           ))}
        </div>
      </div>

      <div className="flex flex-col items-center animate-in zoom-in duration-700">
        {lastChefStats && (
          <div className="mb-6 bg-white/5 p-5 rounded-[2rem] border border-white/10 backdrop-blur-md">
             <p className="text-orange-500 font-black uppercase text-[10px] mb-1 tracking-widest">Previous Shift</p>
             <h3 className="text-2xl font-black italic uppercase text-white">{lastChefStats.name} prepped {lastChefStats.count} orders!</h3>
          </div>
        )}
        
        <div className="bg-orange-600 p-8 rounded-[2.5rem] shadow-xl rotate-3 mb-6 animate-bounce">
          <ChefHat size={70} className="text-white" />
        </div>
        
        <p className="text-stone-500 font-black uppercase text-xl mb-2 tracking-[0.2em]">Next Head Chef:</p>
        <h2 className="text-6xl md:text-8xl font-black uppercase italic text-white leading-none tracking-tighter break-words px-8">{nextChefName}</h2>
        
        {roomData.isChefReady ? (
          <div className="mt-10 w-24 h-24 rounded-full border-[6px] border-stone-800 flex items-center justify-center bg-stone-900 shadow-inner">
             <span className="text-5xl font-black text-orange-500 tabular-nums animate-pulse">{roomData.intermissionTimer || 5}</span>
          </div>
        ) : (
          <div className="mt-10">
            {isNextChef ? (
              <button onClick={handleChefReady} className="px-12 py-5 bg-white text-black font-black text-2xl rounded-full shadow-2xl flex items-center gap-4 hover:scale-105 active:scale-95 transition-all uppercase">
                I'm Ready! <Play fill="currentColor" />
              </button>
            ) : (
              <p className="text-stone-600 font-black uppercase italic tracking-widest text-sm animate-pulse">Wait for {nextChefName} to prepare...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GameView({ roomCode, roomData, user, role, appId }) {
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [pantryShuffle, setPantryShuffle] = useState([]);
  const [sabProgress, setSabProgress] = useState(0); 
  const [dialRotation, setDialRotation] = useState(0); // For manual oven dial
  const isChef = roomData.activeChefId === user.uid;
  const isHost = role === 'HOST';
  const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
  
  const timerInterval = useRef(null);
  const motionRef = useRef({ lastX: 0, lastY: 0, lastZ: 0 });

  // --- 1. Sabotage Suite ---
  const triggerSabotage = async (tid) => {
    if (!tid) return;
    const types = ['SCRUB', 'DIAL', 'SCRATCH'];
    const type = types[Math.floor(Math.random() * types.length)];
    const updates = {};
    updates[`sabotages.${tid}`] = { type, progress: 0, targetValue: type === 'DIAL' ? Math.floor(Math.random() * 300 + 100) : 0 };
    updates[`players.${user.uid}.sabotageCharges`] = (roomData.players[user.uid]?.sabotageCharges || 0) - 1;
    await updateDoc(roomRef, updates);
  };

  const finishSab = async () => {
    const updates = {}; updates[`sabotages.${user.uid}`] = null;
    await updateDoc(roomRef, updates);
    setSabProgress(0);
    setDialRotation(0);
  };

  // Sensor Logic for Shaking
  useEffect(() => {
    const sab = roomData.sabotages?.[user.uid];
    if (sab?.type === 'SCRUB') {
      const handleMotion = (e) => {
        const { x, y, z } = e.accelerationIncludingGravity || { x:0, y:0, z:0 };
        const delta = Math.abs(x - motionRef.current.lastX) + Math.abs(y - motionRef.current.lastY);
        if (delta > 15) setSabProgress(p => { if (p >= 100) { finishSab(); return 100; } return p + 3; });
        motionRef.current = { lastX: x, lastY: y, lastZ: z };
      };
      window.addEventListener('devicemotion', handleMotion);
      return () => window.removeEventListener('devicemotion', handleMotion);
    }
  }, [roomData.sabotages?.[user.uid]]);

  // --- 2. Timer & Shift Logic (Host Only) ---
  useEffect(() => {
    if (isHost && roomData.activeChefId && roomData.timer === 0) startTurn();
    return () => clearInterval(timerInterval.current);
  }, [roomData.activeChefId, isHost]);

  const startTurn = async () => {
    const currentDeck = roomData.deck || [];
    const ingredient = currentDeck[0] || roomData.pantry[0];
    await updateDoc(roomRef, {
      timer: ROUND_TIME, 
      dishName: DISH_NAMES[Math.floor(Math.random() * DISH_NAMES.length)],
      currentIngredient: ingredient, 
      chefSuccessCount: 0, 
      completedIngredients: [],
      isGoldenOrder: Math.random() > 0.8, 
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
    const nextIdx = roomData.currentChefIndex + 1;
    const stats = { name: roomData.players[roomData.activeChefId]?.name, count: roomData.chefSuccessCount };
    if (nextIdx >= roomData.turnOrder.length) {
      if (roomData.currentRound < 3) await updateDoc(roomRef, { status: 'INTERMISSION', currentRound: roomData.currentRound + 1, currentChefIndex: 0, activeChefId: roomData.turnOrder[0], timer: 0, lastChefStats: stats, isChefReady: false, intermissionTimer: 0 });
      else await updateDoc(roomRef, { status: 'GAME_OVER' });
    } else await updateDoc(roomRef, { status: 'INTERMISSION', currentChefIndex: nextIdx, activeChefId: roomData.turnOrder[nextIdx], timer: 0, lastChefStats: stats, isChefReady: false, intermissionTimer: 0 });
  };

  // --- 3. UI Shuffling on SUCCESS ONLY ---
  useEffect(() => {
    if (!isHost && roomData.status === 'PLAYING') {
      setPantryShuffle([...roomData.pantry].sort(() => Math.random() - 0.5));
    }
  }, [roomData.currentIngredient, isHost, roomData.status]);

  useEffect(() => { if (roomData.timer > 0) setTimeLeft(roomData.timer); }, [roomData.timer]);

  const handleGuess = async (guess) => {
    if (roomData.players[user.uid]?.isLockedOut || roomData.sabotages?.[user.uid]) return;
    if (guess === roomData.currentIngredient) {
      const deck = [...roomData.deck];
      deck.shift(); 
      if (deck.length === 0) deck.push(...[...roomData.pantry].sort(() => Math.random() - 0.5));
      const mult = roomData.isGoldenOrder ? 2 : 1;
      const up = { 
        deck, currentIngredient: deck[0], chefSuccessCount: roomData.chefSuccessCount + 1, 
        completedIngredients: arrayUnion(roomData.currentIngredient), isGoldenOrder: Math.random() > 0.8 
      };
      up[`players.${user.uid}.score`] = (roomData.players[user.uid]?.score || 0) + (500 * mult);
      up[`players.${roomData.activeChefId}.score`] = (roomData.players[roomData.activeChefId]?.score || 0) + (300 * mult);
      Object.keys(roomData.players).forEach(id => { up[`players.${id}.isLockedOut`] = false; });
      await updateDoc(roomRef, up);
    } else {
      const up = {}; up[`players.${user.uid}.isLockedOut`] = true;
      up[`players.${user.uid}.score`] = Math.max(0, (roomData.players[user.uid]?.score || 0) - (roomData.isGoldenOrder ? 600 : 200));
      await updateDoc(roomRef, up);
    }
  };

  // Sabotage Renderers
  const renderSabotage = () => {
    const sab = roomData.sabotages[user.uid];
    if (sab.type === 'SCRATCH') return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" onPointerMove={(e) => { setSabProgress(p => { if (p >= 100) { finishSab(); return 100; } return p + 0.8; }); }}>
        <Eraser size={100} className="text-blue-400 mb-8 animate-pulse" />
        <h2 className="text-5xl font-black uppercase italic text-white mb-4">DIRTY PLATE!</h2>
        <p className="text-xl font-bold text-blue-200 mb-10">SCRATCH AWAY THE GRIME WITH YOUR FINGER!</p>
        <div className="relative w-64 h-64 rounded-full border-8 border-white/20 bg-stone-800 flex items-center justify-center overflow-hidden">
           <div className="absolute inset-0 bg-stone-600 transition-opacity duration-300" style={{ opacity: Math.max(0, (100 - sabProgress) / 100) }}></div>
           <Utensils size={80} className="text-white opacity-20" />
        </div>
      </div>
    );
    if (sab.type === 'DIAL') return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" onPointerMove={(e) => { 
          const rect = e.currentTarget.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
          const normalized = (angle + 180) % 360; // 0-360
          setDialRotation(normalized);
          const currentTemp = Math.floor(normalized + 100);
          if (Math.abs(currentTemp - sab.targetValue) < 10) finishSab();
      }}>
        <Thermometer size={100} className="text-orange-400 mb-8 animate-pulse" />
        <h2 className="text-5xl font-black uppercase italic text-white mb-4">SET THE OVEN!</h2>
        <p className="text-xl font-bold text-orange-200 mb-6 uppercase">Target: {sab.targetValue}°F</p>
        <div className="w-64 h-64 rounded-full border-8 border-orange-500/50 bg-stone-900 flex items-center justify-center relative shadow-inner" style={{ transform: `rotate(${dialRotation}deg)` }}>
           <div className="w-2 h-16 bg-white rounded-full absolute top-4 shadow-lg"></div>
           <div className="text-white font-black text-2xl rotate-[-{dialRotation}deg]">{Math.floor(dialRotation + 100)}°</div>
        </div>
        <p className="mt-8 text-stone-500 font-bold uppercase text-xs">Drag around the dial with your finger</p>
      </div>
    );
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-10">
        <Waves size={150} className="text-blue-400 animate-pulse" />
        <h2 className="text-7xl font-black uppercase italic text-white">SCRUB!</h2>
        <p className="text-xl font-bold text-blue-200 uppercase tracking-widest">SHAKE VIGOROUSLY!</p>
        <div className="w-full max-w-md bg-blue-950 h-10 rounded-full border-4 border-white/20 overflow-hidden shadow-2xl relative"><div className="bg-white h-full transition-all duration-100 shadow-[0_0_20px_white]" style={{ width: `${sabProgress}%` }}></div></div>
      </div>
    );
  };

  if (isHost) {
    const isHeatOn = timeLeft < 15;
    return (
      <div className={`flex flex-col h-screen p-8 gap-8 transition-colors duration-1000 max-w-[1200px] mx-auto w-full ${isHeatOn ? 'bg-orange-950/20' : ''}`}>
        <div className="flex justify-between items-center bg-stone-900 border-4 border-stone-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
           {isHeatOn && <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none"></div>}
           <div className="flex items-center gap-6 relative">
              <div className={`p-6 rounded-[1.5rem] shadow-xl ${roomData.isGoldenOrder ? 'bg-yellow-500 animate-pulse' : 'bg-orange-600'}`}><ChefHat className="text-white" size={48} /></div>
              <div><p className="text-orange-500 font-black uppercase text-xs tracking-[0.3em]">Shift {roomData.currentRound}</p><h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">{roomData.players[roomData.activeChefId]?.name}</h2></div>
           </div>
           <div className={`p-6 rounded-[2rem] border-4 transition-all duration-300 ${timeLeft < 10 ? 'border-red-600 text-red-500 animate-pulse scale-105' : 'border-stone-800 bg-stone-950 text-white'}`}><span className="text-8xl font-black font-mono tabular-nums leading-none">{timeLeft}</span></div>
        </div>
        <div className="flex-1 grid grid-cols-12 gap-8">
          <div className="col-span-8 bg-stone-900/40 rounded-[4rem] border-4 border-stone-900 p-12 flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
             {roomData.isGoldenOrder && <div className="absolute top-8 right-8 bg-yellow-500 text-black px-6 py-2 rounded-full font-black uppercase italic animate-bounce shadow-xl flex items-center gap-2 text-lg"><Zap size={20} fill="currentColor" /> Golden Order (2X)</div>}
             <p className="text-stone-600 font-black uppercase tracking-[0.4em] mb-6 text-sm">Now Cooking:</p>
             <h3 className="text-6xl font-black italic text-center mb-16 uppercase leading-none tracking-tighter drop-shadow-2xl">"{roomData.dishName}"</h3>
             <div className="w-full max-w-2xl bg-stone-950 h-32 rounded-full border-4 border-stone-800 flex items-center px-6 gap-3 shadow-2xl relative">
                {roomData.completedIngredients.map((_, i) => <div key={i} className="flex-1 bg-orange-600 h-20 rounded-full flex items-center justify-center animate-in zoom-in border-b-4 border-orange-800 shadow-xl"><CheckCircle2 className="text-white" size={32} /></div>)}
                {Array.from({ length: Math.max(0, 5 - roomData.completedIngredients.length) }).map((_, i) => <div key={i} className="flex-1 h-20 rounded-full border-2 border-stone-800 border-dashed opacity-20"></div>)}
             </div>
          </div>
          <div className="col-span-4 flex flex-col gap-8">
            <div className="bg-stone-900 p-8 rounded-[3rem] border-2 border-stone-800 shadow-xl overflow-hidden relative">
              <h4 className="font-black uppercase text-red-500 mb-6 flex items-center gap-4 tracking-tighter text-2xl"><Skull size={32} /> Sabotage</h4>
              <div className="space-y-4">
                {Object.entries(roomData.sabotages || {}).map(([sid, sab]) => sab && (
                  <div key={sid} className="flex items-center gap-4 animate-bounce"><Waves className="text-blue-500" size={32} /><p className="font-black text-2xl uppercase italic text-blue-400 truncate">{roomData.players[sid]?.name} IS REELING!</p></div>
                ))}
                {Object.values(roomData.sabotages || {}).every(s => !s) && <p className="text-stone-800 font-black uppercase italic py-8 text-center tracking-widest text-xl opacity-30">Pantry is Quiet...</p>}
              </div>
            </div>
            <div className="flex-1 bg-stone-900 p-8 rounded-[3rem] border-2 border-stone-800 shadow-xl overflow-y-auto">
              <h4 className="font-black uppercase text-stone-600 mb-6 text-sm tracking-widest">Standings</h4>
              <div className="space-y-3">
                {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className={`flex justify-between items-center p-4 rounded-[1.5rem] transition-all border-2 ${i === 0 ? 'bg-orange-600 border-orange-400 shadow-xl' : 'bg-stone-950 border-stone-900'}`}><div className="flex items-center gap-4"><span className={`text-xl font-black italic ${i === 0 ? 'text-white' : 'text-stone-700'}`}>{i+1}</span><span className={`text-xl font-black uppercase truncate max-w-[120px] ${i === 0 ? 'text-white' : ''}`}>{p.name}</span></div><span className={`text-2xl font-black ${i === 0 ? 'text-white' : 'text-orange-500'}`}>{p.score}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isChef) {
    // SAFE CONSTRAINTS LOOKUP
    const roundConstraints = [
      { title: "THE TRAINING SHIFT", text: "SAY ANYTHING!", text2: "Avoid words on the card", icon: <RefreshCcw /> },
      { title: "THE LUNCH RUSH", text: "ONE WORD ONLY!", text2: "One single word per item", icon: <Zap /> },
      { title: "KITCHEN NIGHTMARE", text: "SILENT CHARADES!", text2: "No talking. No noise.", icon: <Skull /> }
    ];
    const currentRoundIndex = Math.max(0, Math.min(roomData.currentRound - 1, 2));
    const constraint = roundConstraints[currentRoundIndex];

    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-stone-950 text-center">
          <div className="mb-10">
            <div className="bg-orange-600 w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl animate-bounce"><ChefHat size={48} className="text-white" /></div>
            <p className="text-orange-500 font-black uppercase text-xs tracking-[0.3em]">{constraint.title}</p>
            <h2 className="text-4xl font-black uppercase italic mt-2">{constraint.text}</h2>
            <p className="text-stone-500 font-bold uppercase text-[10px] mt-2">{constraint.text2}</p>
          </div>
          <div className="bg-white text-black p-12 rounded-[4rem] w-full max-w-md shadow-2xl border-b-[16px] border-stone-300 relative overflow-hidden">
             {roomData.isGoldenOrder && <div className="absolute top-0 left-0 w-full h-4 bg-yellow-500"></div>}
             <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-2">The Ingredient:</p>
             <h2 className="text-6xl font-black uppercase italic leading-none tracking-tighter break-words">{roomData.currentIngredient}</h2>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-6 w-full max-w-md">
             <div className="bg-stone-900 p-8 rounded-[3rem] border-4 border-stone-800"><p className="text-xs font-black text-stone-600 uppercase mb-1">Prepped</p><p className="text-6xl font-black text-orange-500">{roomData.chefSuccessCount}</p></div>
             <div className="bg-stone-900 p-8 rounded-[3rem] border-4 border-stone-800"><p className="text-xs font-black text-stone-600 uppercase mb-1">Time</p><p className={`text-6xl font-black ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}</p></div>
          </div>
          {roomData.currentRound > 1 && <button onClick={() => { if(window.confirm('Skip?')) skipIngredient(); }} className="mt-10 bg-red-600/10 text-red-500 px-10 py-5 rounded-full font-black uppercase tracking-[0.4em] text-xs hover:bg-red-600 hover:text-white transition-all">Skip Order (-100)</button>}
      </div>
    );
  }

  const activeSab = roomData.sabotages?.[user.uid];
  const isLockedOut = roomData.players?.[user.uid]?.isLockedOut;

  // --- Intense 86'ed Lockout View ---
  if (isLockedOut) return (
    <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in duration-300 z-[200] relative">
      <div className="bg-white p-12 rounded-[3rem] mb-12 transform -rotate-12 shadow-2xl border-b-[16px] border-stone-200 relative z-10">
        <Skull size={180} className="text-red-600" />
      </div>
      <h2 className="text-[6rem] md:text-[8rem] font-black uppercase italic text-white mb-6 leading-none tracking-tighter drop-shadow-2xl relative z-10">86'ED!</h2>
      <div className="bg-black/30 p-10 rounded-[2.5rem] border-4 border-white/30 backdrop-blur-xl relative z-10 max-w-md w-full">
        <p className="text-white font-black uppercase text-2xl tracking-[0.3em] leading-relaxed">OUT OF THE KITCHEN!</p>
        <p className="text-red-200 font-bold uppercase text-xs mt-4 opacity-70">Wait for the next order to deal...</p>
      </div>
    </div>
  );

  return (
    <div className={`h-screen flex flex-col ${activeSab ? 'bg-blue-900' : 'bg-stone-950'}`}>
      {activeSab ? renderSabotage() : (
        <>
          <div className="p-6 bg-stone-900 border-b-4 border-stone-800 flex justify-between items-center shadow-2xl">
             <div><p className="text-[10px] font-black uppercase text-stone-500 tracking-widest">Wallet</p><p className="text-4xl font-black text-orange-500 tabular-nums">{roomData.players?.[user.uid]?.score || 0}</p></div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-stone-500 tracking-widest">Charges</p>
                <div className="flex gap-1 justify-end">{Array.from({ length: 3 }).map((_, i) => <Zap key={i} size={24} className={i < (roomData.players?.[user.uid]?.sabotageCharges || 0) ? 'text-blue-500 fill-blue-500' : 'text-stone-700'} />)}</div>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-stone-950">
             <div className="p-6 bg-blue-950/40 rounded-[2.5rem] border-2 border-blue-900/50 shadow-inner">
                <div className="flex items-center gap-3 mb-4"><Skull className="text-blue-400" size={24} /><p className="text-xs font-black uppercase text-blue-400 tracking-[0.4em]">Sabotage a Rival:</p></div>
                <div className="relative">
                  <select className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-xl outline-none border-b-[10px] border-blue-800 active:translate-y-1 transition-all appearance-none" onChange={(e) => { triggerSabotage(e.target.value); e.target.value = ''; }} disabled={(roomData.players?.[user.uid]?.sabotageCharges || 0) <= 0}>
                     <option value="">-- PICK VICTIM --</option>
                     {Object.values(roomData.players).filter(p => p.id !== user.uid && p.id !== roomData.activeChefId).map(p => <option key={p.id} value={p.id} disabled={roomData.sabotages?.[p.id]}>{p.name}</option>)}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none"><HandMetal size={32}/></div>
                </div>
             </div>
             <div className="space-y-3 pb-32">
                <p className="text-[10px] font-black uppercase text-stone-700 tracking-[0.6em] text-center my-6">Select Ingredient</p>
               {pantryShuffle.map((ing, idx) => <button key={idx} onClick={() => handleGuess(ing)} className="w-full bg-stone-900 border-b-[10px] border-stone-800 p-6 rounded-[2.5rem] text-left font-black uppercase text-xl text-white active:bg-orange-600 active:border-orange-800 active:translate-y-1 shadow-xl transition-all">{ing}</button>)}
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
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const up = { status: 'LOBBY', currentRound: 1, currentChefIndex: 0, pantry: [], deck: [], completedIngredients: [], sabotages: {}, lastChefStats: null, isChefReady: false, intermissionTimer: 0 };
    Object.keys(roomData.players).forEach(id => { up[`players.${id}.score`] = 0; up[`players.${id}.ready`] = false; up[`players.${id}.isLockedOut`] = false; up[`players.${id}.sabotageCharges`] = 3; });
    await updateDoc(roomRef, up);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-4 text-center overflow-y-auto">
        <div className="flex flex-col items-center mb-8 mt-4 animate-in zoom-in duration-500">
          <Trophy size={60} className="text-orange-500 mb-4 md:w-24 md:h-24" />
          <h1 className="text-5xl md:text-8xl font-black italic uppercase text-white leading-none tracking-tighter drop-shadow-2xl">THE VERDICT</h1>
        </div>
        
        <div className="w-full max-w-2xl space-y-3 mb-8">
          {players.map((p, i) => (
            <div key={p.id} className={`p-4 md:p-8 rounded-[2rem] border-2 md:border-4 flex justify-between items-center transition-all ${i === 0 ? 'bg-white text-black border-orange-500 scale-105 shadow-2xl' : 'bg-stone-900/50 border-stone-800'}`}>
               <div className="flex items-center gap-4 md:gap-8">
                 <span className={`text-3xl md:text-6xl font-black italic ${i === 0 ? 'text-orange-500' : 'opacity-20'}`}>#{i+1}</span>
                 <p className="text-xl md:text-4xl font-black uppercase italic tracking-tighter truncate max-w-[150px] md:max-w-none">{p.name}</p>
               </div>
               <p className={`text-2xl md:text-5xl font-black ${i === 0 ? 'text-orange-600' : 'text-stone-500'}`}>{p.score} <span className="text-[10px] md:text-sm">PTS</span></p>
            </div>
          ))}
        </div>
        
        {isHost && (
          <button onClick={reset} className="mt-4 bg-orange-600 hover:bg-orange-500 text-white px-10 py-5 rounded-[2.5rem] text-xl md:text-4xl font-black uppercase active:scale-95 shadow-xl transition-all border-b-8 border-orange-800 mb-10">
            Re-Open Kitchen
          </button>
        )}
        
        {!isHost && (
          <div className="bg-stone-900 p-6 rounded-3xl border border-stone-800 mb-10">
            <p className="text-stone-500 font-black uppercase tracking-widest text-xs">Waiting for Head Chef to re-open...</p>
          </div>
        )}
    </div>
  );
}
