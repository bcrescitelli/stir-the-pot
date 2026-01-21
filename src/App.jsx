import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion, getDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  ChefHat, Users, Play, Volume2, VolumeX, Zap, Skull, HandMetal, RefreshCcw, Thermometer, Eraser, Eye, Utensils, Trophy, CheckCircle2, Waves
} from 'lucide-react';

// --- Firebase Configuration (SAME AS BEFORE) ---
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

// --- Constants (UPDATED FOR 90s VIBE) ---
const ROUND_TIME = 45;
const DISH_NAMES = [
  "RADIOACTIVE SLIME BURGER",
  "PRINCIPAL'S WIG SURPRISE",
  "THE AGGRO CRAG SOUP",
  "ORANGE SODA LASAGNA",
  "MYSTERY MEAT MONDAY",
  "REPTAR'S REVENGE STEW",
  "THE GAK ATTACK SNACK",
  "AWKWARD PUMPKIN CURRY"
];

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// --- Shared 90s Styles ---
const funkyBorder = "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]";
const blobShape = "rounded-[3rem_2rem_4rem_2rem]";
const zigzagBg = "bg-[linear-gradient(135deg,#FF6B00_25%,transparent_25%),linear-gradient(225deg,#FF6B00_25%,transparent_25%),linear-gradient(45deg,#FF6B00_25%,transparent_25%),linear-gradient(315deg,#FF6B00_25%,#FFD200_25%)] bg-[length:40px_40px]";

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

  // (Audio and Auth effects remain the same as original code...)
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
        setError('Game Over, Man!');
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

  // (createRoom and joinRoom remain the same...)
  const createRoom = async () => {
    if (!user) return;
    const newCode = generateRoomCode();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newCode);
    const initialData = {
      code: newCode, status: 'LOBBY', hostId: user.uid, players: {}, pantry: [], deck: [], currentRound: 1, currentChefIndex: 0, currentIngredient: '', dishName: '', timer: 0, activeChefId: '', completedIngredients: [], chefSuccessCount: 0, turnOrder: [], sabotages: {}, lastChefStats: null, isGoldenOrder: false, isChefReady: false, intermissionTimer: 0
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
      setError("Need Name & Code!");
      return;
    }
    await requestPermissions();
    const cleanCode = inputCode.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', cleanCode);
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) { setError('Bad Code!'); return; }
      const updates = {};
      updates[`players.${user.uid}`] = {
        id: user.uid, name: playerName, score: 0, isLockedOut: false, ready: false, sabotageCharges: 3 
      };
      await updateDoc(roomRef, updates);
      setRole('PLAYER');
      setActiveRoomCode(cleanCode);
      setView('LOBBY');
    } catch (e) { setError("Join failed."); }
  };

  if (!user && !error) return <div className="min-h-screen bg-yellow-300 flex flex-col items-center justify-center text-[#FF6B00] font-black uppercase tracking-widest animate-bounce"><Utensils className="mb-4 animate-spin" size={64} />Booting Up...</div>;

  return (
    <div className={`min-h-screen font-sans selection:bg-[#00FF00] selection:text-black overflow-hidden relative ${zigzagBg}`}>
      {role === 'HOST' && view !== 'LANDING' && view !== 'RESULTS' && (
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button onClick={() => { if(introAudio.current) introAudio.current.play(); }} className={`p-3 bg-[#FF6B00] text-white hover:bg-[#00FF00] hover:text-black transition-all ${funkyBorder} rounded-full`}><Volume2 size={24} /></button>
          <button onClick={() => { if(introAudio.current) { introAudio.current.muted = !isMuted; setIsMuted(!isMuted); } }} className={`p-3 bg-purple-600 text-white ${funkyBorder} rounded-full`}>{isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}</button>
        </div>
      )}
      
      <div className="relative z-10">
        {view === 'LANDING' && <LandingView setInputCode={setInputCode} inputCode={inputCode} setPlayerName={setPlayerName} createRoom={createRoom} joinRoom={joinRoom} error={error} />}
        {view === 'LOBBY' && <LobbyView roomCode={activeRoomCode} roomData={roomData} role={role} user={user} appId={appId} />}
        {view === 'INTERMISSION' && <IntermissionView roomCode={activeRoomCode} roomData={roomData} role={role} user={user} appId={appId} requestPermissions={requestPermissions} />}
        {view === 'PLAYING' && <GameView roomCode={activeRoomCode} roomData={roomData} user={user} role={role} appId={appId} />}
        {view === 'RESULTS' && <ResultsView roomData={roomData} roomCode={activeRoomCode} role={role} appId={appId} />}
      </div>
    </div>
  );
}

// --- Views ---

function LandingView({ setInputCode, inputCode, setPlayerName, createRoom, joinRoom, error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="mb-8 text-center relative transform -rotate-3 animate-pulse">
        <div className="bg-[#00FF00] p-6 rounded-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-4 inline-block">
            <Utensils size={64} className="text-black" />
        </div>
        <h1 className="text-8xl font-black tracking-tighter uppercase leading-none text-[#FF6B00] drop-shadow-[4px_4px_0px_black] italic">
          STIR <br/>THE <br/>POT!
        </h1>
      </div>

      <div className={`w-full max-w-sm space-y-4 bg-white p-8 ${blobShape} ${funkyBorder}`}>
        <input type="text" placeholder="YOUR CODENAME" className="w-full bg-yellow-200 border-4 border-black rounded-xl p-4 text-center font-black text-xl uppercase focus:bg-[#00FF00] outline-none transition-all placeholder:text-black/50 dashed-border" onChange={(e) => setPlayerName(e.target.value)} />
        <input type="text" placeholder="ROOM CODE" value={inputCode} className="w-full bg-yellow-200 border-4 border-black rounded-xl p-4 text-center font-black text-xl uppercase focus:bg-[#00FF00] outline-none transition-all placeholder:text-black/50" onChange={(e) => setInputCode(e.target.value.toUpperCase())} />
        
        <button onClick={joinRoom} className={`w-full bg-[#FF6B00] hover:bg-[#00FF00] text-white hover:text-black font-black py-5 text-3xl uppercase active:translate-x-1 active:translate-y-1 active:shadow-none transition-all ${funkyBorder} rounded-xl transform rotate-1`}>LET'S PLAY!</button>
        <button onClick={createRoom} className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl uppercase hover:bg-purple-500 transition-all border-4 border-black shadow-[4px_4px_0px_0px_black]">TV Host Mode</button>
        
        {error && <div className="text-white bg-red-600 font-black text-center p-3 border-4 border-black rounded-xl uppercase animate-bounce">{error}</div>}
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
      setLocalError("FILL 'EM ALL UP!");
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
      deck: shuffledDeck, status: 'INTERMISSION', activeChefId: turnOrder[0], turnOrder: turnOrder, currentRound: 1, currentChefIndex: 0, isChefReady: false, intermissionTimer: 0
    });
  };

  if (isHost) {
    return (
      <div className="flex flex-col min-h-screen p-8 bg-cyan-400">
        <div className={`bg-white p-6 ${funkyBorder} rounded-3xl mb-8 flex justify-between items-center transform -rotate-1`}>
          <h2 className="text-6xl font-black italic text-[#FF6B00] uppercase tracking-tighter drop-shadow-[3px_3px_0px_black]">THE LOBBY</h2>
          <div className="text-right">
             <p className="font-black text-sm uppercase mb-1 rotate-2 bg-yellow-300 inline-block px-2 border-2 border-black">Room Code</p>
             <p className="text-7xl font-black tracking-widest text-white bg-purple-600 px-6 py-2 border-4 border-black shadow-[6px_6px_0px_0px_black] transform rotate-2">{roomCode}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1 content-start">
          {players.map((p, i) => (
            <div key={p.id} className={`p-6 transition-all transform ${i%2===0 ? 'rotate-2' : '-rotate-2'} ${p.ready ? 'bg-[#00FF00] text-black' : 'bg-yellow-300 text-black/50'} ${funkyBorder} rounded-2xl text-center`}>
              <ChefHat size={40} className="mb-2 mx-auto drop-shadow-[2px_2px_0px_black]" />
              <p className="text-2xl font-black uppercase leading-none truncate">{p.name}</p>
              <p className="font-bold text-xs mt-2 uppercase">{p.ready ? 'READY TO ROCK!' : 'Thinking...'}</p>
            </div>
          ))}
        </div>

        <button disabled={players.length < 2 || !players.every(p => p.ready)} onClick={startGame} className={`w-full bg-[#FF6B00] text-white p-6 font-black text-5xl uppercase mt-8 hover:bg-purple-600 hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all ${funkyBorder} rounded-full`}>START THE MADNESS!</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 flex flex-col max-w-md mx-auto bg-cyan-300/90 rounded-[3rem] my-8 border-4 border-black shadow-[12px_12px_0px_0px_black]">
      <div className="mb-8 text-center transform -rotate-2">
        <h2 className="text-5xl font-black text-white uppercase leading-none drop-shadow-[4px_4px_0px_#FF6B00] stroke-black stroke-2">STOCK THE <br/>PANTRY!</h2>
        <p className="text-black font-bold text-sm uppercase mt-4 bg-yellow-300 inline-block px-4 py-1 border-2 border-black rotate-2">5 Weird Items Required</p>
      </div>

      {!isReady ? (
        <div className="space-y-4">
          {items.map((v, i) => (
            <div key={i} className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black font-black text-2xl z-10 italic">#{i+1}</span>
                <input maxLength={25} type="text" className={`w-full bg-white pl-12 pr-4 py-4 rounded-2xl font-black uppercase outline-none focus:bg-[#00FF00] border-4 border-black transition-all text-xl ${i%2===0 ? 'rotate-1' : '-rotate-1'}`} value={v} onChange={(e) => { const n = [...items]; n[i] = e.target.value; setItems(n); }} />
            </div>
          ))}
          {localError && <div className="bg-red-600 text-white border-4 border-black font-black uppercase text-center py-3 rounded-xl animate-bounce">{localError}</div>}
          <button onClick={submitPantry} className={`w-full bg-[#FF6B00] text-white font-black py-6 text-3xl uppercase mt-4 hover:bg-purple-600 transition-all ${funkyBorder} rounded-2xl transform rotate-1 active:scale-95`}>LOCK IT IN!</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <CheckCircle2 size={100} className="text-[#00FF00] animate-bounce drop-shadow-[4px_4px_0px_black]" />
          <p className="text-5xl font-black uppercase text-white drop-shadow-[3px_3px_0px_black] italic transform -rotate-3">YOU'RE SET!</p>
          <p className="text-black font-bold text-lg uppercase bg-yellow-300 px-4 py-2 border-4 border-black rotate-2">Waiting for host...</p>
        </div>
      )}
    </div>
  );
}

function IntermissionView({ roomCode, roomData, role, user, appId, requestPermissions }) {
  const isHost = role === 'HOST';
  const isNextChef = roomData.activeChefId === user.uid;
  const nextChefName = roomData.players[roomData.activeChefId]?.name || "???";
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
    <div className="min-h-screen flex flex-col bg-purple-600 p-8">
      <div className={`bg-white p-6 ${funkyBorder} rounded-[2rem] mb-8 flex justify-between items-start transform rotate-1`}>
         <div>
            <p className="font-black text-xl text-[#FF6B00] uppercase mb-2 bg-yellow-300 inline-block px-2 border-2 border-black rotate-[-2deg]">Top Dogs</p>
            <div className="space-y-2">
                {Object.values(roomData.players).sort((a,b) => b.score - a.score).slice(0, 3).map((p, i) => (
                    <p key={p.id} className="text-2xl font-black uppercase flex items-center"><span className="text-[#00FF00] mr-2 drop-shadow-[2px_2px_0px_black] italic">#{i+1}</span> {p.name}</p>
                ))}
            </div>
         </div>
         <div className="text-right">
            <p className="text-6xl font-black text-cyan-400 drop-shadow-[3px_3px_0px_black] italic">ROUND {roomData.currentRound}</p>
         </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        {lastChefStats && (
          <div className="absolute top-0 rotate-[-6deg] bg-yellow-300 text-black px-8 py-4 font-black text-xl uppercase border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-pulse">
             Last Chef got {lastChefStats.count} points!
          </div>
        )}
        
        <div className="bg-cyan-400 p-12 rounded-[4rem] border-4 border-black shadow-[12px_12px_0px_0px_black] text-center transform -rotate-2">
            <p className="text-white font-black text-2xl uppercase mb-4 drop-shadow-[2px_2px_0px_black]">Up Next:</p>
            <h2 className="text-8xl md:text-[10rem] font-black uppercase text-[#FF6B00] leading-none tracking-tighter drop-shadow-[6px_6px_0px_black] italic break-words">{nextChefName}</h2>
        </div>
        
        <div className="mt-12">
            {roomData.isChefReady ? (
               <div className="w-40 h-40 bg-[#00FF00] rounded-full border-8 border-black flex items-center justify-center animate-bounce shadow-[8px_8px_0px_0px_black]">
                   <div className="text-8xl font-black text-black">{roomData.intermissionTimer || 5}</div>
               </div>
            ) : (
                isNextChef ? (
                    <button onClick={handleChefReady} className={`bg-[#FF6B00] text-white font-black text-5xl px-16 py-8 uppercase hover:bg-[#00FF00] hover:text-black transition-all ${funkyBorder} rounded-[3rem] transform rotate-2 active:scale-95`}>I'M READY!</button>
                ) : (
                    <p className="font-black text-2xl text-white uppercase animate-pulse bg-black px-6 py-2 border-4 border-white rotate-[-2deg]">Waiting for Chef...</p>
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

  // --- 1. Sabotage Suite (Updated Visuals) ---
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

  // Sensor Logic (Same as before)
  useEffect(() => {
    const sab = roomData.sabotages?.[user.uid];
    if (sab?.type === 'SCRUB') {
      const handleMotion = (e) => {
        const { x, y, z } = e.accelerationIncludingGravity || { x:0, y:0, z:0 };
        const delta = Math.abs(x - motionRef.current.lastX) + Math.abs(y - motionRef.current.lastY);
        if (delta > 15) setSabProgress(p => { if (p >= 100) { finishSab(); return 100; } return p + 4; });
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
      timer: ROUND_TIME, dishName: DISH_NAMES[Math.floor(Math.random() * DISH_NAMES.length)], currentIngredient: ingredient, chefSuccessCount: 0, completedIngredients: [], isGoldenOrder: Math.random() > 0.8, sabotages: {} 
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
      const up = { deck, currentIngredient: deck[0], chefSuccessCount: roomData.chefSuccessCount + 1, completedIngredients: arrayUnion(roomData.currentIngredient), isGoldenOrder: Math.random() > 0.8 };
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

  // Sabotage Renderers (90s Style)
  const renderSabotage = () => {
    const sab = roomData.sabotages[user.uid];
    const sabContainer = "flex-1 flex flex-col items-center justify-center p-8 text-center bg-purple-600 border-8 border-black m-4 rounded-[3rem] relative overflow-hidden";
    
    if (sab.type === 'SCRATCH') return (
      <div className={sabContainer} onPointerMove={(e) => { setSabProgress(p => { if (p >= 100) { finishSab(); return 100; } return p + 1.5; }); }}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/grunge-wall.png')] opacity-50 mix-blend-overlay pointer-events-none"></div>
        <h2 className="text-6xl font-black uppercase text-[#00FF00] mb-4 drop-shadow-[4px_4px_0px_black] italic rotate-[-3deg]">GROSS!</h2>
        <p className="text-2xl font-black text-white mb-10 uppercase bg-black inline-block px-4 py-2 rotate-2 border-4 border-[#FF6B00]">SCRUB THE SCREEN!</p>
        <div className="relative w-72 h-72 rounded-full border-8 border-black bg-zinc-800 flex items-center justify-center overflow-hidden shadow-[8px_8px_0px_0px_black]">
           <div className="absolute inset-0 bg-[#00FF00] transition-all duration-100" style={{ clipPath: `circle(${sabProgress}% at 50% 50%)` }}></div>
           <Utensils size={100} className="text-black relative z-10" />
        </div>
      </div>
    );
    if (sab.type === 'DIAL') return (
      <div className={sabContainer} onPointerMove={(e) => { 
          const rect = e.currentTarget.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
          const normalized = (angle + 180) % 360;
          setDialRotation(normalized);
          const currentTemp = Math.floor(normalized + 100);
          if (Math.abs(currentTemp - sab.targetValue) < 15) finishSab();
      }}>
        <Thermometer size={100} className="text-[#FF6B00] mb-4 animate-bounce drop-shadow-[4px_4px_0px_black]" />
        <h2 className="text-5xl font-black uppercase text-white mb-4 drop-shadow-[4px_4px_0px_black] italic rotate-2">FIX THE OVEN!</h2>
        <p className="text-3xl font-black text-black mb-6 uppercase bg-[#00FF00] px-6 py-2 border-4 border-black rotate-[-2deg]">TARGET: {sab.targetValue}°</p>
        <div className="w-64 h-64 rounded-full border-8 border-black bg-white flex items-center justify-center relative shadow-[8px_8px_0px_0px_black]" style={{ transform: `rotate(${dialRotation}deg)` }}>
           <div className="w-4 h-20 bg-[#FF6B00] border-2 border-black absolute top-2 rounded-full"></div>
           <div className="text-black font-black text-4xl rotate-[-{dialRotation}deg] absolute">{Math.floor(dialRotation + 100)}°</div>
        </div>
      </div>
    );
    return (
      <div className={`${sabContainer} space-y-8`}>
        <Waves size={150} className="text-cyan-400 animate-shake drop-shadow-[4px_4px_0px_black]" />
        <h2 className="text-7xl font-black uppercase text-[#00FF00] drop-shadow-[5px_5px_0px_black] italic rotate-3">SHAKE IT!</h2>
        <p className="text-2xl font-black text-white uppercase bg-black px-6 py-2 border-4 border-[#FF6B00] rotate-[-3deg]">VIGOROUSLY!</p>
        <div className="w-full max-w-md bg-black h-12 rounded-full border-4 border-white overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] relative"><div className="bg-[#00FF00] h-full transition-all duration-100 border-r-4 border-black" style={{ width: `${sabProgress}%` }}></div></div>
      </div>
    );
  };

  if (isHost) {
    return (
      <div className="flex flex-col h-screen bg-cyan-400 p-8 overflow-hidden">
        {/* 90s Top Bar */}
        <div className={`bg-white p-6 ${funkyBorder} ${blobShape} mb-8 flex justify-between items-center transform rotate-1 relative`}>
           <div className="flex items-center gap-6 relative z-10">
              <div className="w-32 h-32 bg-[#FF6B00] rounded-full border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_black] relative">
                <ChefHat size={60} className="text-white drop-shadow-[2px_2px_0px_black]" />
                {roomData.isGoldenOrder && <Zap size={40} className="text-yellow-300 absolute -top-4 -right-4 drop-shadow-[2px_2px_0px_black] animate-bounce" fill="currentColor"/>}
              </div>
              <div>
                 <p className="font-black text-lg text-black uppercase mb-1 bg-[#00FF00] inline-block px-3 border-2 border-black rotate-[-2deg]">Chef on Duty</p>
                 <h2 className="text-5xl font-black uppercase text-purple-600 leading-none drop-shadow-[3px_3px_0px_black] italic">{roomData.players[roomData.activeChefId]?.name}</h2>
              </div>
           </div>
           <div className="relative z-10 text-right">
              <p className="font-black text-lg text-black uppercase mb-1 bg-yellow-300 inline-block px-3 border-2 border-black rotate-2">Current Order</p>
              <h3 className="text-4xl font-black uppercase text-[#FF6B00] leading-none drop-shadow-[3px_3px_0px_black] italic max-w-md text-right">{roomData.dishName}</h3>
           </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-8">
            {/* Main Stage */}
            <div className={`col-span-8 bg-purple-600 ${funkyBorder} rounded-[4rem] p-8 flex flex-col items-center justify-center relative overflow-hidden transform -rotate-1`}>
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,white_20%,transparent_20%),radial-gradient(circle,white_20%,transparent_20%)] bg-[length:30px_30px] bg-[position:0_0,15px_15px]"></div>
                
                <div className={`w-48 h-48 ${funkyBorder} rounded-full flex items-center justify-center bg-white mb-8 relative`}>
                    <div className={`text-8xl font-black ${timeLeft < 10 ? 'text-red-600 animate-ping' : 'text-black'}`}>{timeLeft}</div>
                </div>
                
                <div className="flex gap-4 relative z-10 bg-black/20 p-4 rounded-full border-4 border-black/40">
                    {roomData.completedIngredients.map((_, i) => <div key={i} className="w-20 h-20 bg-[#00FF00] rounded-full border-4 border-black shadow-[4px_4px_0px_0px_black] flex items-center justify-center animate-bounce"><CheckCircle2 size={40} className="text-black"/></div>)}
                    {Array.from({ length: Math.max(0, 5 - roomData.completedIngredients.length) }).map((_, i) => <div key={i} className="w-20 h-20 bg-white/30 rounded-full border-4 border-black/50 border-dashed animate-pulse"></div>)}
                </div>
            </div>

            {/* Sidebar Stats */}
            <div className="col-span-4 space-y-8 font-black uppercase">
                <div className={`bg-white p-6 ${funkyBorder} rounded-3xl transform rotate-2`}>
                    <p className="text-xl text-[#FF6B00] mb-4 bg-yellow-300 inline-block px-2 border-2 border-black">Scoreboard</p>
                    <div className="space-y-3">
                        {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
                            <div key={p.id} className="flex justify-between items-center border-b-4 border-black pb-2">
                                <p className={`text-2xl ${i===0 ? 'text-[#00FF00] drop-shadow-[2px_2px_0px_black] italic' : 'text-black'}`}>{p.name}</p>
                                <p className="text-3xl text-purple-600">{p.score}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {Object.values(roomData.sabotages || {}).some(s => s) && (
                   <div className={`bg-red-600 p-6 text-white animate-bounce ${funkyBorder} rounded-3xl transform -rotate-2`}>
                      <Skull size={40} className="mb-2 drop-shadow-[2px_2px_0px_black]" />
                      <p className="text-3xl italic drop-shadow-[3px_3px_0px_black]">CHAOS MODE!</p>
                   </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  if (isChef) {
    const roundConstraints = [
      { title: "THE BABY ROUND", text: "SAY ANYTHING!", icon: <RefreshCcw /> },
      { title: "THE ONE-WORD WONDER", text: "SINGLE WORD!", icon: <Zap /> },
      { title: "SHUT YER TRAP!", text: "MIME TIME!", icon: <Skull /> }
    ];
    const currentRoundIndex = Math.max(0, Math.min(roomData.currentRound - 1, 2));
    const constraint = roundConstraints[currentRoundIndex];

    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-yellow-300">
        <div className={`bg-white p-12 w-full max-w-2xl text-center relative ${funkyBorder} ${blobShape} transform rotate-1`}>
            {roomData.isGoldenOrder && <div className="absolute -top-6 -right-6 bg-[#00FF00] text-black border-4 border-black px-6 py-2 font-black uppercase tracking-widest animate-bounce shadow-[4px_4px_0px_0px_black] rotate-12">DOUBLE POINTS!</div>}
            
            <div className="mb-8">
                <p className="font-black text-xl text-white uppercase mb-2 bg-purple-600 inline-block px-4 py-1 border-4 border-black rotate-[-3deg]">{constraint.title}</p>
                <h2 className="text-5xl font-black text-black uppercase drop-shadow-[3px_3px_0px_#FF6B00] italic">{constraint.text}</h2>
            </div>

            <div className="bg-cyan-400 p-8 border-4 border-black rounded-[3rem] shadow-[8px_8px_0px_0px_black] transform -rotate-2 mb-8">
                <p className="font-black text-sm uppercase tracking-widest mb-2 text-black opacity-60">The Secret Ingredient:</p>
                <h2 className="text-7xl font-black uppercase leading-none tracking-tighter break-words text-white drop-shadow-[4px_4px_0px_black] italic">{roomData.currentIngredient}</h2>
            </div>

            <div className="flex justify-center gap-4">
                <div className="bg-[#FF6B00] p-4 border-4 border-black rounded-2xl text-white font-black text-center shadow-[4px_4px_0px_0px_black] rotate-2">
                    <p className="text-sm uppercase mb-1">Score</p>
                    <p className="text-5xl">{roomData.chefSuccessCount}</p>
                </div>
                <div className={`bg-white p-4 border-4 border-black rounded-full text-black font-black text-center shadow-[4px_4px_0px_0px_black] w-32 h-32 flex flex-col justify-center rotate-[-2deg] ${timeLeft < 10 ? 'bg-red-500 animate-ping' : ''}`}>
                    <p className="text-5xl">{timeLeft}</p>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- Player Lockout View (90s Style) ---
  if (roomData.players?.[user.uid]?.isLockedOut) return (
    <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,black_25%,black_50%,transparent_50%,transparent_75%,black_75%)] bg-[length:100px_100px] opacity-20 animate-[spin_20s_linear_infinite]"></div>
        <div className={`bg-white p-12 relative z-10 transform rotate-[-5deg] ${funkyBorder} rounded-[4rem]`}>
            <Skull size={150} className="text-black mx-auto mb-6 drop-shadow-[4px_4px_0px_red]" />
            <h2 className="text-[8rem] font-black italic text-red-600 uppercase leading-none mb-6 drop-shadow-[6px_6px_0px_black] stroke-black stroke-4">YOU'RE TOAST!</h2>
            <p className="text-3xl font-black uppercase bg-black text-white inline-block px-6 py-2 border-4 border-red-600 rotate-3">Sit out this round, loser!</p>
        </div>
    </div>
  );

  const activeSab = roomData.sabotages?.[user.uid];
  
  return (
    <div className={`h-screen flex flex-col ${activeSab ? 'bg-purple-600' : 'bg-cyan-400'}`}>
      {activeSab ? renderSabotage() : (
        <>
          <div className={`p-4 bg-white border-b-8 border-black flex justify-between items-center relative z-20 shadow-[0px_8px_0px_0px_rgba(0,0,0,0.3)]`}>
              <div className="flex items-center gap-4">
                  <div className="bg-[#FF6B00] text-white font-black text-4xl px-4 py-2 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_black] rotate-[-2deg]">{roomData.players?.[user.uid]?.score || 0}</div>
                  <p className="font-black uppercase text-lg italic">Points</p>
              </div>
              <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, i) => <Zap key={i} size={32} className={i < (roomData.players?.[user.uid]?.sabotageCharges || 0) ? 'text-yellow-300 fill-yellow-300 drop-shadow-[2px_2px_0px_black]' : 'text-black/20'} />)}
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-cyan-400">
              <div className={`p-6 bg-purple-600 ${funkyBorder} rounded-3xl transform rotate-1`}>
                  <p className="font-black text-xl text-white uppercase mb-4 bg-black inline-block px-4 py-1 border-2 border-[#00FF00] rotate-[-2deg] flex items-center gap-2"><HandMetal size={24}/> MESS SOMEONE UP:</p>
                  <select className="w-full bg-white text-black p-4 font-black uppercase text-xl outline-none border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_black] appearance-none" onChange={(e) => { triggerSabotage(e.target.value); e.target.value = ''; }} disabled={(roomData.players?.[user.uid]?.sabotageCharges || 0) <= 0}>
                      <option value="">PICK A VICTIM!</option>
                      {Object.values(roomData.players).filter(p => p.id !== user.uid && p.id !== roomData.activeChefId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
              </div>
              
              <div className="grid grid-cols-1 gap-4 pb-32">
                 {pantryShuffle.map((ing, idx) => (
                     <button key={idx} onClick={() => handleGuess(ing)} className={`w-full bg-white p-6 font-black uppercase text-2xl text-left hover:bg-[#00FF00] hover:scale-[1.02] active:scale-95 transition-all border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_black] ${idx%2===0 ? 'rotate-1' : '-rotate-1'}`}>
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
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const up = { status: 'LOBBY', currentRound: 1, currentChefIndex: 0, pantry: [], deck: [], completedIngredients: [], sabotages: {}, lastChefStats: null, isChefReady: false, intermissionTimer: 0 };
    Object.keys(roomData.players).forEach(id => { up[`players.${id}.score`] = 0; up[`players.${id}.ready`] = false; up[`players.${id}.isLockedOut`] = false; up[`players.${id}.sabotageCharges`] = 3; });
    await updateDoc(roomRef, up);
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-yellow-300 p-8 text-black overflow-y-auto">
        <div className="mb-12 text-center relative transform rotate-[-3deg] mt-8">
            <Trophy size={100} className="text-[#FF6B00] mx-auto mb-4 drop-shadow-[4px_4px_0px_black] animate-bounce" />
            <h1 className="text-8xl font-black italic uppercase text-purple-600 leading-none tracking-tighter drop-shadow-[6px_6px_0px_black] stroke-black stroke-2">GAME OVER!</h1>
        </div>
        
        <div className={`w-full max-w-3xl space-y-6 mb-12 bg-white p-8 ${funkyBorder} rounded-[3rem] transform rotate-2`}>
          {players.map((p, i) => (
            <div key={p.id} className={`flex justify-between items-center p-6 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_black] transform ${i%2===0?'rotate-1':'-rotate-1'} ${i===0 ? 'bg-[#00FF00] scale-105' : 'bg-cyan-300'}`}>
                <div className="flex items-center gap-6">
                    <span className={`text-6xl font-black italic ${i===0 ? 'text-white drop-shadow-[3px_3px_0px_black]' : 'text-black opacity-50'}`}>#{i+1}</span>
                    <p className="text-4xl font-black uppercase italic tracking-tighter">{p.name}</p>
                </div>
                <p className="text-5xl font-black text-black bg-white px-4 py-2 border-4 border-black rounded-xl transform rotate-[-2deg]">{p.score}</p>
            </div>
          ))}
        </div>
        
        {isHost && (
          <button onClick={reset} className={`bg-[#FF6B00] text-white px-12 py-6 font-black text-4xl uppercase shadow-[8px_8px_0px_0px_black] hover:bg-purple-600 transition-all border-4 border-black rounded-full transform rotate-[-2deg] active:scale-95 mb-12`}>PLAY AGAIN!</button>
        )}
    </div>
  );
}
