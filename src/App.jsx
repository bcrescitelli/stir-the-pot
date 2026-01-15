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
  Skull
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'stir-the-pot-v1';

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
  const [view, setView] = useState('LANDING'); // LANDING, LOBBY, PANTRY, PLAYING, RESULTS
  const [role, setRole] = useState(null); // HOST, PLAYER
  const [roomCode, setRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  // 1. Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth failed", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Room Listener
  useEffect(() => {
    if (!roomCode || !user) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomData(data);
        
        // Sync View with Room Status
        if (data.status === 'LOBBY') setView('LOBBY');
        if (data.status === 'PANTRY') setView('PANTRY');
        if (data.status === 'PLAYING') setView('PLAYING');
        if (data.status === 'GAME_OVER') setView('RESULTS');
      } else if (role === 'PLAYER') {
        setError('Room not found');
        setView('LANDING');
      }
    }, (err) => {
      console.error("Snapshot error:", err);
    });

    return () => unsubscribe();
  }, [roomCode, user, role]);

  // --- Actions ---
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
      currentRound: 1,
      currentChefIndex: 0,
      currentIngredient: '',
      dishName: '',
      timer: 0,
      activeChefId: '',
      completedIngredients: [],
      chefSuccessCount: 0,
      turnOrder: []
    };

    await setDoc(roomRef, initialData);
    setRoomCode(newCode);
    setRole('HOST');
    setView('LOBBY');
  };

  const joinRoom = async () => {
    if (!user || !roomCode || !playerName) return;
    const cleanCode = roomCode.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', cleanCode);
    const snapshot = await getDoc(roomRef);

    if (!snapshot.exists()) {
      setError('Room not found');
      return;
    }

    const updates = {};
    updates[`players.${user.uid}`] = {
      id: user.uid,
      name: playerName,
      score: 0,
      ingredients: [],
      isLockedOut: false,
      ready: false
    };

    await updateDoc(roomRef, updates);
    setRoomCode(cleanCode);
    setRole('PLAYER');
    setView('LOBBY');
  };

  // --- Renderers ---
  if (!user) return <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white">Initializing Kitchen...</div>;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-orange-500 selection:text-white overflow-hidden">
      {view === 'LANDING' && <LandingView setRoomCode={setRoomCode} setPlayerName={setPlayerName} createRoom={createRoom} joinRoom={joinRoom} error={error} />}
      {view === 'LOBBY' && <LobbyView roomCode={roomCode} roomData={roomData} role={role} appId={appId} />}
      {view === 'PANTRY' && <PantryView roomCode={roomCode} roomData={roomData} user={user} appId={appId} />}
      {view === 'PLAYING' && <GameView roomCode={roomCode} roomData={roomData} user={user} role={role} appId={appId} />}
      {view === 'RESULTS' && <ResultsView roomData={roomData} roomCode={roomCode} role={role} appId={appId} />}
    </div>
  );
}

// --- View Components ---

function LandingView({ setRoomCode, setPlayerName, createRoom, joinRoom, error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-stone-950 to-stone-950">
      <div className="mb-12 text-center animate-in fade-in zoom-in duration-700">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-orange-600 p-4 rounded-3xl rotate-12 shadow-2xl shadow-orange-900/50">
            <Utensils size={64} className="text-white -rotate-12" />
          </div>
        </div>
        <h1 className="text-7xl font-black italic tracking-tighter text-white uppercase drop-shadow-2xl">
          Stir the <span className="text-orange-500">Pot</span>
        </h1>
        <p className="text-stone-400 mt-2 font-medium tracking-widest uppercase text-xs">A Game of Toxic Ingredients</p>
      </div>

      <div className="w-full max-w-sm space-y-4 bg-stone-900/50 p-8 rounded-3xl border border-stone-800 backdrop-blur-sm">
        <input 
          type="text" 
          placeholder="YOUR NAME" 
          className="w-full bg-stone-800 border-2 border-stone-700 rounded-2xl px-6 py-4 text-center font-bold text-xl uppercase focus:border-orange-500 outline-none transition-all"
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <input 
          type="text" 
          placeholder="ROOM CODE" 
          className="w-full bg-stone-800 border-2 border-stone-700 rounded-2xl px-6 py-4 text-center font-bold text-xl uppercase focus:border-orange-500 outline-none transition-all"
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        />
        <button 
          onClick={joinRoom}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl text-xl uppercase transition-transform active:scale-95 shadow-xl"
        >
          Join Game
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
        {error && <p className="text-red-500 text-center font-bold text-sm bg-red-500/10 p-2 rounded-lg">{error}</p>}
      </div>
    </div>
  );
}

function LobbyView({ roomCode, roomData, role, appId }) {
  const players = roomData?.players ? Object.values(roomData.players) : [];

  const startGame = async () => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    await updateDoc(roomRef, { 
      status: 'PANTRY',
      turnOrder: players.map(p => p.id).sort(() => Math.random() - 0.5)
    });
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-10">
      <div className="w-full flex justify-between items-start mb-12">
        <div className="bg-white text-black p-6 rounded-3xl shadow-2xl">
          <p className="text-xs font-black uppercase tracking-tighter mb-1 opacity-50">Room Code</p>
          <p className="text-6xl font-black tracking-tighter">{roomCode}</p>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-black italic uppercase">The Lobby</h2>
          <p className="text-stone-500 font-bold uppercase tracking-widest text-sm">Waiting for Chefs...</p>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-6">
        {players.map((p) => (
          <div key={p.id} className="bg-stone-900 border-2 border-stone-800 p-6 rounded-3xl flex flex-col items-center justify-center gap-3 animate-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/20">
              <ChefHat className="text-white" size={32} />
            </div>
            <p className="font-black text-xl uppercase truncate w-full text-center">{p.name}</p>
          </div>
        ))}
        {players.length < 8 && Array.from({ length: 8 - players.length }).map((_, i) => (
          <div key={i} className="border-2 border-stone-900 border-dashed p-6 rounded-3xl flex items-center justify-center opacity-30">
             <Users className="text-stone-700" size={32} />
          </div>
        ))}
      </div>

      {role === 'HOST' && (
        <div className="mt-12 w-full max-w-md">
          <button 
            disabled={players.length < 2}
            onClick={startGame}
            className={`w-full py-6 rounded-3xl flex items-center justify-center gap-4 text-2xl font-black uppercase transition-all shadow-2xl
              ${players.length < 2 ? 'bg-stone-800 text-stone-600 cursor-not-allowed' : 'bg-white text-black hover:bg-orange-500 hover:text-white hover:scale-105'}
            `}
          >
            <Play fill="currentColor" size={32} />
            {players.length < 2 ? 'Need 2+ Players' : 'Open the Kitchen'}
          </button>
        </div>
      )}
      {role === 'PLAYER' && (
        <div className="mt-12 text-stone-500 font-black text-xl uppercase animate-pulse">
          Wait for Host to Open Kitchen
        </div>
      )}
    </div>
  );
}

function PantryView({ roomCode, roomData, user, appId }) {
  const [items, setItems] = useState(['', '', '']);
  const isReady = roomData?.players?.[user.uid]?.ready;

  const submitPantry = async () => {
    if (items.some(i => i.trim() === '')) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    
    // Add items to shared pantry
    await updateDoc(roomRef, {
      pantry: arrayUnion(...items.map(i => i.trim().toUpperCase()))
    });

    // Mark self ready
    const updateReady = {};
    updateReady[`players.${user.uid}.ready`] = true;
    await updateDoc(roomRef, updateReady);
  };

  const checkAllReady = async () => {
    const players = Object.values(roomData.players);
    if (players.every(p => p.ready) && players.length > 0) {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      await updateDoc(roomRef, { status: 'PLAYING', activeChefId: roomData.turnOrder[0] });
    }
  };

  useEffect(() => {
    if (roomData?.hostId === user.uid) {
      checkAllReady();
    }
  }, [roomData, user.uid]);

  return (
    <div className="min-h-screen p-6 flex flex-col items-center bg-stone-950">
      <div className="max-w-md w-full text-center space-y-8 mt-12">
        <h2 className="text-4xl font-black italic uppercase text-orange-500 tracking-tighter">Stocking the Pantry</h2>
        <p className="text-stone-400 font-bold uppercase text-sm leading-relaxed">Submit 3 weird, personal, or "toxic" ingredients. Be creative!</p>
        
        {!isReady ? (
          <div className="space-y-4">
            {items.map((val, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={40}
                placeholder={`INGREDIENT ${idx + 1}...`}
                className="w-full bg-stone-900 border-2 border-stone-800 rounded-2xl px-6 py-4 font-bold text-lg uppercase outline-none focus:border-orange-600 transition-all text-white"
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
              className="w-full bg-white text-black font-black py-5 rounded-2xl text-xl uppercase transition-transform active:scale-95 shadow-xl mt-4"
            >
              Ready to Cook
            </button>
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center gap-6 animate-pulse">
            <CheckCircle2 size={80} className="text-green-500" />
            <p className="font-black text-2xl uppercase italic">Waiting for others...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GameView({ roomCode, roomData, user, role, appId }) {
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const isChef = roomData.activeChefId === user.uid;
  const isHost = role === 'HOST';
  const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
  const timerInterval = useRef(null);

  // Sync Timer Logic (Only Host controls the flow of time)
  useEffect(() => {
    if (isHost && roomData.activeChefId && roomData.timer === 0) {
      // Start of a turn
      startTurn();
    }
  }, [roomData.activeChefId]);

  useEffect(() => {
    if (roomData.timer > 0) {
      setTimeLeft(roomData.timer);
    } else if (roomData.timer === -1) {
      // Turn ended logic
    }
  }, [roomData.timer]);

  const startTurn = async () => {
    const randomDish = DISH_NAMES[Math.floor(Math.random() * DISH_NAMES.length)];
    const randomIngredient = roomData.pantry[Math.floor(Math.random() * roomData.pantry.length)];
    
    await updateDoc(roomRef, {
      timer: ROUND_TIME,
      dishName: randomDish,
      currentIngredient: randomIngredient,
      chefSuccessCount: 0,
      completedIngredients: []
    });

    let localTimer = ROUND_TIME;
    timerInterval.current = setInterval(async () => {
      localTimer -= 1;
      if (localTimer <= 0) {
        clearInterval(timerInterval.current);
        endTurn();
      } else {
        await updateDoc(roomRef, { timer: localTimer });
      }
    }, 1000);
  };

  const endTurn = async () => {
    const nextChefIndex = roomData.currentChefIndex + 1;
    let nextRound = roomData.currentRound;
    let nextChefId = '';
    let status = 'PLAYING';

    if (nextChefIndex >= roomData.turnOrder.length) {
      // All players went in this round
      if (nextRound < 3) {
        nextRound += 1;
        nextChefId = roomData.turnOrder[0];
        await updateDoc(roomRef, { 
          currentRound: nextRound, 
          currentChefIndex: 0,
          activeChefId: nextChefId,
          timer: 0 // Will trigger startTurn for host
        });
      } else {
        status = 'GAME_OVER';
        await updateDoc(roomRef, { status: 'GAME_OVER' });
      }
    } else {
      nextChefId = roomData.turnOrder[nextChefIndex];
      await updateDoc(roomRef, { 
        currentChefIndex: nextChefIndex,
        activeChefId: nextChefId,
        timer: 0
      });
    }
  };

  const handleGuess = async (guess) => {
    if (roomData.players[user.uid].isLockedOut) return;
    
    if (guess === roomData.currentIngredient) {
      // Correct!
      const nextIngredient = roomData.pantry[Math.floor(Math.random() * roomData.pantry.length)];
      
      const updates = {
        currentIngredient: nextIngredient,
        chefSuccessCount: roomData.chefSuccessCount + 1,
        completedIngredients: arrayUnion(roomData.currentIngredient)
      };

      // Add scores
      updates[`players.${user.uid}.score`] = roomData.players[user.uid].score + 500;
      updates[`players.${roomData.activeChefId}.score`] = roomData.players[roomData.activeChefId].score + 300;

      // Unlock everyone
      Object.keys(roomData.players).forEach(id => {
        updates[`players.${id}.isLockedOut`] = false;
      });

      // Michelin Bonus Check
      if (roomData.chefSuccessCount + 1 === 5) {
        updates[`players.${roomData.activeChefId}.score`] = roomData.players[roomData.activeChefId].score + 1300; // 300 + 1000 bonus
      }

      await updateDoc(roomRef, updates);
      if ('vibrate' in navigator) navigator.vibrate(200);
    } else {
      // Wrong
      const updates = {};
      updates[`players.${user.uid}.score`] = Math.max(0, roomData.players[user.uid].score - 200);
      updates[`players.${user.uid}.isLockedOut`] = true;
      await updateDoc(roomRef, updates);
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }
  };

  const skipIngredient = async () => {
    if (roomData.currentRound === 1) return;
    const nextIngredient = roomData.pantry[Math.floor(Math.random() * roomData.pantry.length)];
    const updates = { currentIngredient: nextIngredient };
    updates[`players.${user.uid}.score`] = Math.max(0, roomData.players[user.uid].score - 100);
    await updateDoc(roomRef, updates);
  };

  const currentChefName = roomData.players[roomData.activeChefId]?.name || "Chef";

  // --- UI SWITCH ---

  if (isHost) {
    return (
      <div className="flex flex-col h-screen p-8 gap-8 overflow-hidden">
        {/* TV Top Bar */}
        <div className="flex justify-between items-center bg-stone-900 border-2 border-stone-800 p-6 rounded-3xl shadow-xl">
           <div className="flex items-center gap-6">
              <div className="bg-orange-600 p-4 rounded-2xl">
                <ChefHat className="text-white" size={40} />
              </div>
              <div>
                <p className="text-orange-500 font-black uppercase text-sm tracking-widest">Shift {roomData.currentRound}: {
                  roomData.currentRound === 1 ? 'Training' : roomData.currentRound === 2 ? 'Lunch Rush' : 'Nightmare'
                }</p>
                <h2 className="text-4xl font-black uppercase italic tracking-tight">{currentChefName} is Cooking!</h2>
              </div>
           </div>
           <div className={`p-4 rounded-3xl flex items-center gap-4 border-4 ${timeLeft < 10 ? 'border-red-600 animate-pulse text-red-500' : 'border-stone-800 text-white'}`}>
              <Timer size={40} />
              <span className="text-6xl font-black font-mono leading-none">{timeLeft}s</span>
           </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-8">
          {/* Main Visualizer */}
          <div className="col-span-8 bg-stone-900/40 rounded-[3rem] border-4 border-stone-900 p-12 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-600 rounded-full blur-[160px]"></div>
             </div>
             
             <p className="text-stone-500 font-black uppercase tracking-[0.2em] mb-4">Now Serving:</p>
             <h3 className="text-7xl font-black italic text-center mb-12 uppercase drop-shadow-2xl">"{roomData.dishName}"</h3>

             {/* Pot Progress */}
             <div className="w-full max-w-2xl bg-stone-950 h-24 rounded-full border-4 border-stone-800 flex items-center px-4 gap-2 overflow-hidden relative">
                {roomData.completedIngredients.map((ing, i) => (
                  <div key={i} className="flex-1 bg-orange-600 h-12 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                    <CheckCircle2 className="text-white" size={24} />
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 5 - roomData.completedIngredients.length) }).map((_, i) => (
                  <div key={i} className="flex-1 h-12 rounded-full border-2 border-stone-800 border-dashed"></div>
                ))}
                {roomData.chefSuccessCount >= 5 && (
                  <div className="absolute right-6 animate-bounce">
                    <Flame className="text-orange-500" size={48} fill="currentColor" />
                  </div>
                )}
             </div>
             <p className="mt-8 text-stone-500 font-black uppercase tracking-widest text-sm">Ingredients Ready: {roomData.chefSuccessCount} / 5</p>
          </div>

          {/* Right Sidebar - Lockouts & Scores */}
          <div className="col-span-4 flex flex-col gap-6">
            <div className="bg-stone-900 p-8 rounded-[2rem] border-2 border-stone-800">
              <h4 className="font-black uppercase text-red-500 mb-6 flex items-center gap-2">
                <Skull size={20} /> Banned from Kitchen
              </h4>
              <div className="space-y-4">
                {Object.values(roomData.players).filter(p => p.isLockedOut).map(p => (
                  <div key={p.id} className="flex items-center gap-4 animate-in slide-in-from-right-4">
                    <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
                      <ChefHat className="text-white" size={24} />
                    </div>
                    <p className="font-black text-xl uppercase italic line-through text-stone-600">{p.name}</p>
                  </div>
                ))}
                {Object.values(roomData.players).filter(p => p.isLockedOut).length === 0 && (
                  <p className="text-stone-700 italic font-bold">Kitchen is clear...</p>
                )}
              </div>
            </div>

            <div className="flex-1 bg-stone-900 p-8 rounded-[2rem] border-2 border-stone-800">
              <h4 className="font-black uppercase text-stone-500 mb-6">Current Scores</h4>
              <div className="space-y-4">
                {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-2xl bg-stone-950 border border-stone-800">
                    <span className="font-black text-lg uppercase truncate max-w-[150px]">{i+1}. {p.name}</span>
                    <span className="font-black text-xl text-orange-500">{p.score}</span>
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
      <div className="min-h-screen bg-stone-950 p-6 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="bg-orange-600 p-4 rounded-3xl mb-8 animate-bounce shadow-2xl shadow-orange-900/50">
            <ChefHat size={48} className="text-white" />
          </div>
          <p className="text-stone-400 font-black uppercase text-sm tracking-widest mb-2">Shift {roomData.currentRound}: {
            roomData.currentRound === 1 ? 'Say Anything' : roomData.currentRound === 2 ? 'ONE WORD ONLY' : 'TOTAL SILENCE (Charades)'
          }</p>
          <div className="bg-white text-black p-10 rounded-[3rem] w-full max-w-md shadow-[0_0_100px_rgba(255,165,0,0.3)] border-b-8 border-stone-300">
             <h2 className="text-5xl font-black uppercase italic leading-tight tracking-tighter">
                {roomData.currentIngredient}
             </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
           <div className="bg-stone-900 p-6 rounded-3xl border-2 border-stone-800 text-center">
              <p className="text-stone-600 font-black uppercase text-xs">Dish Progress</p>
              <p className="text-3xl font-black text-orange-500">{roomData.chefSuccessCount}</p>
           </div>
           <div className="bg-stone-900 p-6 rounded-3xl border-2 border-stone-800 text-center">
              <p className="text-stone-600 font-black uppercase text-xs">Time Left</p>
              <p className={`text-3xl font-black ${timeLeft < 10 ? 'text-red-600' : 'text-white'}`}>{timeLeft}s</p>
           </div>
        </div>

        {roomData.currentRound > 1 && (
          <button 
            onClick={skipIngredient}
            className="w-full mt-6 bg-red-900/20 text-red-500 border-2 border-red-900/50 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            Dump the Order (-100 PTS)
          </button>
        )}
      </div>
    );
  }

  // Regular Player (Guessing)
  const isLockedOut = roomData.players?.[user.uid]?.isLockedOut;

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 ${isLockedOut ? 'bg-red-950' : 'bg-stone-950'}`}>
       {isLockedOut ? (
         <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-300">
            <AlertCircle size={100} className="text-white mb-6 animate-pulse" />
            <h2 className="text-5xl font-black uppercase italic text-white mb-4">WRONG ORDER!</h2>
            <p className="text-red-300 font-bold uppercase">You are locked out of the kitchen until the next ingredient!</p>
         </div>
       ) : (
         <>
          <div className="p-4 bg-stone-900 border-b-2 border-stone-800 flex justify-between items-center">
             <div>
               <p className="text-[10px] font-black uppercase text-stone-500">Current Score</p>
               <p className="text-2xl font-black text-orange-500">{roomData.players[user.uid]?.score}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-stone-500">Cooking:</p>
                <p className="text-sm font-black uppercase italic truncate w-32">{roomData.dishName}</p>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             <p className="text-xs font-black uppercase text-stone-600 text-center mb-4 tracking-widest">Find the correct ingredient:</p>
             {roomData.pantry.sort().map((ing, idx) => (
               <button
                 key={idx}
                 onClick={() => handleGuess(ing)}
                 className="w-full bg-stone-900 active:bg-orange-600 border-2 border-stone-800 active:border-orange-500 p-5 rounded-2xl text-left font-black uppercase text-lg shadow-xl transition-all"
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
  const winner = players[0];

  const resetGame = async () => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const updates = {
      status: 'LOBBY',
      currentRound: 1,
      currentChefIndex: 0,
      pantry: [],
      completedIngredients: []
    };
    Object.keys(roomData.players).forEach(id => {
      updates[`players.${id}.score`] = 0;
      updates[`players.${id}.ready`] = false;
      updates[`players.${id}.isLockedOut`] = false;
    });
    await updateDoc(roomRef, updates);
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center">
      <div className="text-center mb-12 mt-8 animate-in zoom-in">
        <div className="inline-block bg-orange-600 p-6 rounded-[2.5rem] rotate-3 shadow-2xl mb-8">
           <Trophy size={80} className="text-white -rotate-3" />
        </div>
        <h1 className="text-6xl font-black italic uppercase tracking-tighter">Chef de Cuisine</h1>
        <p className="text-stone-500 font-bold uppercase tracking-widest mt-2">The kitchen has closed.</p>
      </div>

      <div className="w-full max-w-2xl space-y-4">
        {players.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-6 p-6 rounded-3xl border-2 animate-in slide-in-from-bottom-8 delay-${i*100}
            ${i === 0 ? 'bg-white text-black border-orange-500 scale-105 shadow-2xl' : 'bg-stone-900 text-white border-stone-800'}
          `}>
             <span className="text-4xl font-black italic opacity-30">{i+1}</span>
             <div className="flex-1">
               <p className="text-2xl font-black uppercase tracking-tight">{p.name}</p>
               <p className={`${i === 0 ? 'text-orange-600' : 'text-stone-500'} font-black uppercase text-sm`}>Final Score: {p.score}</p>
             </div>
             {i === 0 && <Flame className="text-orange-500" fill="currentColor" size={32} />}
          </div>
        ))}
      </div>

      {role === 'HOST' && (
        <button 
          onClick={resetGame}
          className="mt-16 bg-orange-600 hover:bg-orange-500 text-white px-12 py-6 rounded-3xl text-2xl font-black uppercase transition-all flex items-center gap-4 shadow-2xl"
        >
          <RotateCcw size={32} /> Play Again
        </button>
      )}
    </div>
  );
}
