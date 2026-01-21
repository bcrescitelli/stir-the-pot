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
  Eraser,
  Eye,
  Maximize
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
  "THE VELVET TURTLE",
  "NEON NOODLE SURPRISE",
  "THE COCAINE OMELETTE",
  "CHROME LOBSTER",
  "MINT JULEP MISTAKE",
  "THE MIDNIGHT QUICHE",
  "SYNTHESIZER SOUFFLÉ",
  "EDITORIAL ASPIC"
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

  if (!user && !error) return <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-cyan-400 font-mono uppercase tracking-[0.5em] animate-pulse">Initializing System...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-fuchsia-500 overflow-hidden relative">
      {/* Editorial Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50"></div>
      
      {role === 'HOST' && view !== 'LANDING' && view !== 'RESULTS' && (
        <div className="fixed top-6 right-6 z-50 flex gap-1">
          <button onClick={() => { if(introAudio.current) introAudio.current.play(); }} className="p-3 bg-zinc-900 border border-zinc-700 text-fuchsia-500 hover:bg-fuchsia-500 hover:text-white transition-all"><Volume2 size={18} /></button>
          <button onClick={() => { if(introAudio.current) { introAudio.current.muted = !isMuted; setIsMuted(!isMuted); } }} className="p-3 bg-zinc-900 border border-zinc-700 text-cyan-400">{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
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
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_#222_0%,_#000_100%)] opacity-50"></div>
      
      <div className="mb-12 text-center relative z-10">
        <div className="mb-4 inline-block border-[4px] border-fuchsia-500 p-2 shadow-[8px_8px_0px_0px_rgba(217,70,239,0.3)]">
            <Utensils size={48} className="text-fuchsia-500" />
        </div>
        <h1 className="text-8xl font-serif italic font-black tracking-tighter uppercase leading-[0.8] text-white">
          STIR <br/>
          <span className="text-fuchsia-500">THE</span> <br/>
          POT
        </h1>
        <div className="h-1 w-full bg-cyan-400 mt-4 shadow-[0_0_15px_#22d3ee]"></div>
        <p className="text-cyan-400 mt-2 font-mono uppercase tracking-[0.6em] text-[10px]">A Gourmet Sabotage Collective</p>
      </div>

      <div className="w-full max-w-xs space-y-1 relative z-10">
        <input type="text" placeholder="IDENTITY" className="w-full bg-transparent border-2 border-zinc-800 p-4 font-mono text-sm uppercase focus:border-cyan-400 outline-none transition-all placeholder:text-zinc-700" onChange={(e) => setPlayerName(e.target.value)} />
        <input type="text" placeholder="ACCESS CODE" value={inputCode} className="w-full bg-transparent border-2 border-zinc-800 p-4 font-mono text-sm uppercase focus:border-cyan-400 outline-none transition-all placeholder:text-zinc-700" onChange={(e) => setInputCode(e.target.value.toUpperCase())} />
        
        <button onClick={joinRoom} className="w-full bg-fuchsia-600 text-white font-serif italic font-black py-4 text-2xl uppercase shadow-[4px_4px_0px_0px_#701a75] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all mt-4">Enter Salon</button>
        <button onClick={createRoom} className="w-full border-2 border-zinc-700 text-zinc-500 font-mono py-2 text-xs uppercase hover:text-cyan-400 hover:border-cyan-400 transition-all">Host Private View</button>
        
        {error && <div className="text-fuchsia-500 font-mono text-[10px] text-center mt-4 tracking-widest">{error}</div>}
      </div>

      <div className="fixed bottom-8 left-8 text-[8px] font-mono text-zinc-800 uppercase vertical-text tracking-[1em] select-none">Issue № 84 • Spring Edition</div>
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
      setLocalError("INCOMPLETE MANIFEST");
      return;
    }
    const cleanItems = items.map(i => i.trim().toUpperCase());
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
      <div className="flex flex-col min-h-screen p-12 bg-zinc-50 text-black">
        <div className="flex justify-between items-end border-b-4 border-black pb-8 mb-12">
          <div>
            <h2 className="text-9xl font-serif italic font-black leading-none tracking-tighter">THE <br/>LOBBY</h2>
          </div>
          <div className="text-right">
             <p className="font-mono text-xs uppercase tracking-[0.4em] mb-2">Access Key</p>
             <p className="text-7xl font-mono font-black border-4 border-black px-6 py-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-fuchsia-500 text-white">{roomCode}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          {players.map(p => (
            <div key={p.id} className={`border-2 p-6 transition-all ${p.ready ? 'bg-black text-white' : 'bg-transparent border-black/20 text-black/40'}`}>
              <ChefHat size={24} className="mb-4" />
              <p className="text-2xl font-serif italic font-black uppercase leading-none">{p.name}</p>
              <p className="font-mono text-[10px] mt-2 uppercase tracking-widest">{p.ready ? 'Manifest Confirmed' : 'Pending...'}</p>
            </div>
          ))}
        </div>

        <button disabled={players.length < 2 || !players.every(p => p.ready)} onClick={startGame} className="w-full bg-cyan-400 text-black border-4 border-black p-8 font-serif italic font-black text-5xl uppercase mt-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:bg-fuchsia-500 hover:text-white disabled:opacity-20 transition-all">Open the Gallery</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 flex flex-col max-w-md mx-auto">
      <div className="mb-12 border-l-4 border-fuchsia-500 pl-6">
        <h2 className="text-5xl font-serif italic font-black text-white uppercase leading-none">THE <br/>MANIFEST</h2>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-4">Provide five elements for the seasonal collection.</p>
      </div>

      {!isReady ? (
        <div className="space-y-2">
          {items.map((v, i) => (
            <input key={i} maxLength={30} type="text" placeholder={`ELEMENT ${i+1}`} className="w-full bg-transparent border-b-2 border-zinc-800 p-4 font-mono text-sm uppercase focus:border-cyan-400 outline-none text-cyan-400" value={v} onChange={(e) => { const n = [...items]; n[i] = e.target.value; setItems(n); }} />
          ))}
          {localError && <div className="text-fuchsia-500 font-mono text-[10px] uppercase text-center py-4">{localError}</div>}
          <button onClick={submitPantry} className="w-full bg-white text-black font-serif italic font-black py-5 text-2xl uppercase mt-8 hover:bg-cyan-400 transition-colors">Submit Assets</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <Eye size={64} className="text-fuchsia-500 animate-pulse" />
          <p className="text-3xl font-serif italic font-black uppercase text-white">AWAITING REVIEW</p>
          <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-[0.3em]">The curator is preparing the floor.</p>
        </div>
      )}
    </div>
  );
}

function IntermissionView({ roomCode, roomData, role, user, appId, requestPermissions }) {
  const isHost = role === 'HOST';
  const isNextChef = roomData.activeChefId === user.uid;
  const nextChefName = roomData.players[roomData.activeChefId]?.name || "ANONYMOUS";
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
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] p-12">
      <div className="flex justify-between items-start mb-20">
         <div className="border-t-4 border-white pt-4">
            <p className="font-mono text-[10px] text-fuchsia-500 uppercase tracking-widest">Global Rankings</p>
            <div className="mt-4 space-y-1">
                {Object.values(roomData.players).sort((a,b) => b.score - a.score).slice(0, 3).map((p, i) => (
                    <p key={p.id} className="text-xl font-serif italic text-white uppercase"><span className="text-zinc-700 font-mono mr-2">{i+1}.</span> {p.name} — {p.score}</p>
                ))}
            </div>
         </div>
         <div className="text-right">
            <p className="text-5xl font-mono text-cyan-400 font-black">№ {roomData.currentRound}/3</p>
            <p className="font-mono text-[8px] text-zinc-600 uppercase tracking-widest mt-1">Operational Shift</p>
         </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        {lastChefStats && (
          <div className="absolute top-0 rotate-[-4deg] bg-white text-black px-6 py-2 font-mono text-xs uppercase shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
             {lastChefStats.name} produced {lastChefStats.count} units.
          </div>
        )}
        
        <p className="text-fuchsia-500 font-mono text-xs uppercase tracking-[1em] mb-4">Upcoming Feature:</p>
        <h2 className="text-[12rem] md:text-[15rem] font-serif italic font-black uppercase text-white leading-none tracking-tighter mix-blend-difference">{nextChefName}</h2>
        
        <div className="mt-12">
            {roomData.isChefReady ? (
               <div className="text-9xl font-mono font-black text-cyan-400 tabular-nums animate-ping">{roomData.intermissionTimer || 5}</div>
            ) : (
                isNextChef ? (
                    <button onClick={handleChefReady} className="bg-white text-black font-serif italic font-black text-4xl px-16 py-6 uppercase hover:bg-fuchsia-500 hover:text-white transition-all shadow-[10px_10px_0px_0px_rgba(255,255,255,0.2)]">I Accept</button>
                ) : (
                    <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest animate-pulse italic">— Preparing Salon —</p>
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
  const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
  
  const timerInterval = useRef(null);
  const motionRef = useRef({ lastX: 0, lastY: 0, lastZ: 0 });

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

  if (isHost) {
    return (
      <div className="flex flex-col h-screen bg-black p-12 overflow-hidden">
        {/* Editorial Top Bar */}
        <div className="flex justify-between items-start border-b-2 border-zinc-800 pb-12 mb-12">
           <div className="flex items-end gap-6">
              <div className="text-9xl font-mono font-black text-white leading-none tracking-tighter">{timeLeft}</div>
              <div className="pb-2">
                 <p className="font-mono text-[10px] text-fuchsia-500 uppercase tracking-[0.5em]">Seconds Remaining</p>
                 <h2 className="text-4xl font-serif italic font-black text-zinc-400 uppercase leading-none">{roomData.players[roomData.activeChefId]?.name}</h2>
              </div>
           </div>
           <div className="text-right">
              <p className="text-fuchsia-500 font-mono text-[10px] uppercase tracking-widest mb-2">Now Serving</p>
              <h3 className="text-6xl font-serif italic font-black text-white uppercase leading-none">“{roomData.dishName}”</h3>
           </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-12">
            {/* Main Stage */}
            <div className="col-span-8 border-4 border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden bg-[radial-gradient(circle_at_50%_120%,_#111_0%,_#000_100%)]">
                {roomData.isGoldenOrder && <div className="absolute top-12 left-12 bg-fuchsia-500 text-white font-mono font-black px-6 py-2 uppercase tracking-widest animate-pulse">Exclusive Order (2X)</div>}
                
                <div className="flex gap-4 mb-20">
                    {roomData.completedIngredients.map((_, i) => <div key={i} className="w-16 h-32 bg-cyan-400 border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]"></div>)}
                    {Array.from({ length: Math.max(0, 5 - roomData.completedIngredients.length) }).map((_, i) => <div key={i} className="w-16 h-32 border-2 border-zinc-800 border-dashed"></div>)}
                </div>
                
                <div className="text-[10rem] font-serif italic font-black text-white/5 absolute -bottom-10 whitespace-nowrap select-none">EDITORIAL COLLECTION</div>
            </div>

            {/* Sidebar Stats */}
            <div className="col-span-4 space-y-8">
                <div className="border-t-4 border-fuchsia-500 pt-4">
                    <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-6">Salon Standings</p>
                    <div className="space-y-4">
                        {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
                            <div key={p.id} className="flex justify-between items-end border-b border-zinc-900 pb-2">
                                <p className="text-2xl font-serif italic font-black text-white uppercase">{p.name}</p>
                                <p className="text-2xl font-mono text-cyan-400">{p.score}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {Object.values(roomData.sabotages || {}).some(s => s) && (
                   <div className="bg-fuchsia-600 p-6 text-white animate-bounce">
                      <Skull size={32} className="mb-2" />
                      <p className="font-serif italic font-black text-2xl uppercase">SABOTAGE IN PROGRESS</p>
                   </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  if (isChef) {
    const roundConstraints = [
      { title: "FREE EXPRESSION", text: "UNLIMITED", icon: <RefreshCcw /> },
      { title: "THE MONOLOGUE", text: "ONE WORD", icon: <Zap /> },
      { title: "THE MIME", text: "SILENCE", icon: <Skull /> }
    ];
    const currentRoundIndex = Math.max(0, Math.min(roomData.currentRound - 1, 2));
    const constraint = roundConstraints[currentRoundIndex];

    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-between bg-[#0a0a0a]">
        <div className="w-full border-t-2 border-fuchsia-500 pt-4">
            <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{constraint.title}</p>
            <h2 className="text-3xl font-serif italic font-black text-white uppercase">{constraint.text}</h2>
        </div>

        <div className="w-full max-w-sm bg-white p-12 text-black shadow-[15px_15px_0px_0px_#22d3ee]">
            <p className="font-mono text-[8px] uppercase tracking-widest mb-4 opacity-40">Ingredient Specification</p>
            <h2 className="text-6xl font-serif italic font-black uppercase leading-none tracking-tighter break-words">{roomData.currentIngredient}</h2>
        </div>

        <div className="w-full grid grid-cols-2 gap-2">
            <div className="border border-zinc-800 p-6">
                <p className="font-mono text-[8px] text-zinc-600 uppercase mb-2">Production</p>
                <p className="text-5xl font-mono font-black text-fuchsia-500">{roomData.chefSuccessCount}</p>
            </div>
            <div className="border border-zinc-800 p-6">
                <p className="font-mono text-[8px] text-zinc-600 uppercase mb-2">Shift Timer</p>
                <p className="text-5xl font-mono font-black text-white">{timeLeft}</p>
            </div>
        </div>
      </div>
    );
  }

  // --- Sabotage Overlays (Stylized) ---
  if (roomData.sabotages?.[user.uid]) {
    const sab = roomData.sabotages[user.uid];
    return (
        <div className="min-h-screen bg-fuchsia-600 flex flex-col items-center justify-center p-12 text-center text-white">
            <Skull size={120} className="mb-8" />
            <h2 className="text-7xl font-serif italic font-black uppercase leading-none mb-4">CRITICAL <br/>FAULT</h2>
            <p className="font-mono text-sm uppercase tracking-widest mb-12">Correct the hardware immediately.</p>
            {sab.type === 'SCRUB' && <div className="w-full h-4 bg-black/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-100" style={{ width: `${sabProgress}%` }}></div></div>}
            <p className="mt-8 font-mono text-[10px] uppercase animate-pulse">Interaction Required</p>
        </div>
    );
  }

  if (roomData.players?.[user.uid]?.isLockedOut) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-[10rem] font-serif italic font-black text-white/10 uppercase leading-none absolute">86'ED</h2>
        <div className="z-10 bg-white p-12 text-black shadow-[20px_20px_0px_0px_#f0f]">
            <h3 className="text-5xl font-serif italic font-black uppercase mb-4">EXPELLED</h3>
            <p className="font-mono text-[10px] uppercase tracking-widest">Inaccurate data detected. Access suspended until next cycle.</p>
        </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-black">
          <p className="text-4xl font-mono font-black text-cyan-400">{roomData.players?.[user.uid]?.score || 0}</p>
          <div className="flex gap-1">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`w-3 h-8 ${i < (roomData.players?.[user.uid]?.sabotageCharges || 0) ? 'bg-fuchsia-500 shadow-[0_0_10px_#f0f]' : 'bg-zinc-800'}`}></div>)}</div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="border-2 border-zinc-800 p-4">
              <p className="font-mono text-[8px] text-zinc-600 uppercase tracking-widest mb-4">Disturb Rival Collection:</p>
              <select className="w-full bg-zinc-900 text-white p-4 font-mono text-sm uppercase outline-none border-b-4 border-fuchsia-500" onChange={(e) => { triggerSabotage(e.target.value); e.target.value = ''; }} disabled={(roomData.players?.[user.uid]?.sabotageCharges || 0) <= 0}>
                  <option value="">-- SELECT TARGET --</option>
                  {Object.values(roomData.players).filter(p => p.id !== user.uid && p.id !== roomData.activeChefId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
          </div>
          
          <div className="grid grid-cols-1 gap-1 pb-24">
             {pantryShuffle.map((ing, idx) => (
                 <button key={idx} onClick={() => handleGuess(ing)} className="w-full bg-white text-black p-6 font-serif italic font-black uppercase text-2xl text-left hover:bg-cyan-400 transition-all border-b-4 border-zinc-300">
                    {ing}
                 </button>
             ))}
          </div>
      </div>
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
    <div className="min-h-screen flex flex-col items-center bg-zinc-50 p-12 text-black">
        <h1 className="text-[12rem] md:text-[18rem] font-serif italic font-black uppercase leading-[0.75] tracking-tighter text-black mb-12">THE <br/>FINALE</h1>
        
        <div className="w-full max-w-3xl space-y-0 border-t-4 border-black mb-12">
          {players.map((p, i) => (
            <div key={p.id} className="flex justify-between items-center py-6 border-b-2 border-black/10">
                <div className="flex items-end gap-6">
                    <span className="text-6xl font-mono font-black text-fuchsia-500">0{i+1}</span>
                    <p className="text-5xl font-serif italic font-black uppercase leading-none">{p.name}</p>
                </div>
                <p className="text-5xl font-mono font-black">{p.score}</p>
            </div>
          ))}
        </div>
        
        {isHost && (
          <button onClick={reset} className="bg-black text-white px-20 py-8 font-serif italic font-black text-5xl uppercase shadow-[15px_15px_0px_0px_#22d3ee] hover:bg-fuchsia-600 transition-all">Curate Again</button>
        )}
    </div>
  );
}
