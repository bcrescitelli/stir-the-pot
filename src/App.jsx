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
  Skull
} from 'lucide-react';

// --- Firebase Configuration ---
// Prioritize environment-provided config, fallback to user-provided config
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
  
  // Audio reference for the intro music
  const introAudio = useRef(null);

  // Initialize audio object once
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

  // 1. Auth Initialization - Following Rule 3 strictly
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

  // 2. Room Listener - Following Rule 1 & 2 strictly
  useEffect(() => {
    if (!roomCode || !user) return;

    // Structure: /artifacts/{appId}/public/data/rooms/{roomId}
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

        // Stop intro music if the status leaves LOBBY
        if (data.status !== 'LOBBY' && introAudio.current) {
          introAudio.current.pause();
          introAudio.current.currentTime = 0;
        }
      } else if (role === 'PLAYER') {
        setError('Room no longer exists.');
        setView('LANDING');
      }
    }, (err) => {
      console.error("Snapshot error:", err);
      // This is often where permission errors show up
      if (err.code === 'permission-denied') {
        setError("Firebase Permission Denied. Check your Firestore Rules.");
      } else {
        setError("Disconnected from server.");
      }
    });

    return () => unsubscribe();
  }, [roomCode, user, role]);

  // --- Actions ---
  const createRoom = async () => {
    if (!user) {
      setError("Authenticating... try again in a second.");
      return;
    }
    setError('');
    const newCode = generateRoomCode();
    // Rule 1 Pathing
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

    try {
      await setDoc(roomRef, initialData);
      setRoomCode(newCode);
      setRole('HOST');
      setView('LOBBY');
      
      // Play intro music for the host (User gesture triggered)
      if (introAudio.current) {
        introAudio.current.play().catch(e => {
          console.warn("Audio autoplay blocked by browser policy.", e);
        });
      }
    } catch (err) {
      console.error("Failed to create room:", err);
      // Detailed error for the user
      if (err.code === 'permission-denied') {
        setError("Failed: Check Firestore Rules (enable 'Test Mode').");
      } else {
        setError("Failed to open kitchen. Error: " + err.code);
      }
    }
  };

  const joinRoom = async () => {
    if (!user || !roomCode || !playerName) {
      setError("Name and Code are required.");
      return;
    }
    setError('');
    const cleanCode = roomCode.toUpperCase();
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
        ingredients: [],
        isLockedOut: false,
        ready: false
      };

      await updateDoc(roomRef, updates);
      setRoomCode(cleanCode);
      setRole('PLAYER');
      setView('LOBBY');
    } catch (err) {
      console.error("Failed to join room:", err);
      setError("Failed to join: " + err.code);
    }
  };

  // --- Renderers ---
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

      <div className="w-full max-w-sm space-y-4 bg-stone-900/50 p-8 rounded-3xl border border-stone-800 backdrop-blur-sm shadow-2xl">
        <input 
          type="text" 
          placeholder="YOUR NAME" 
          className="w-full bg-stone-800 border-2 border-stone-700 rounded-2xl px-6 py-4 text-center font-bold text-xl uppercase focus:border-orange-500 outline-none transition-all placeholder:opacity-30"
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <input 
          type="text" 
          placeholder="ROOM CODE" 
          className="w-full bg-stone-800 border-2 border-stone-700 rounded-2xl px-6 py-4 text-center font-bold text-xl uppercase focus:border-orange-500 outline-none transition-all placeholder:opacity-30"
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        />
        <button 
          onClick={joinRoom}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl text-xl uppercase transition-all active:scale-95 shadow-xl shadow-orange-900/20"
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
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-500 font-bold text-sm text-left leading-tight animate-in slide-in-from-top-2">
            <AlertCircle size={24} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
      
      {/* Footer Info */}
      <div className="mt-12 text-stone-700 text-[10px] font-bold uppercase tracking-[0.2em]">
        Ensure Firestore Rules are in "Test Mode" for Vercel deploy.
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
        <div className="bg-white text-black p-6 rounded-[2.5rem] shadow-2xl transform -rotate-2">
          <p className="text-[10px] font-black uppercase tracking-tighter mb-1 opacity-50">Room Code</p>
          <p className="text-7xl font-black tracking-tighter leading-none">{roomCode}</p>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-black italic uppercase text-orange-500">The Lobby</h2>
          <p className="text-stone-500 font-bold uppercase tracking-widest text-sm">Waiting for Chefs...</p>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-6">
        {players.map((p) => (
          <div key={p.id} className="bg-stone-900 border-2 border-stone-800 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 animate-in slide-in-from-bottom-4 shadow-xl">
            <div className="w-20 h-20 bg-orange-600 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-900/40">
              <ChefHat className="text-white" size={40} />
            </div>
            <p className="font-black text-2xl uppercase truncate w-full text-center tracking-tight">{p.name}</p>
          </div>
        ))}
        {players.length < 8 && Array.from({ length: 8 - players.length }).map((_, i) => (
          <div key={i} className="border-2 border-stone-900 border-dashed p-8 rounded-[2.5rem] flex items-center justify-center opacity-20">
             <Users className="text-stone-700" size={40} />
          </div>
        ))}
      </div>

      {role === 'HOST' && (
        <div className="mt-12 w-full max-w-md">
          <button 
            disabled={players.length < 2}
            onClick={startGame}
            className={`w-full py-6 rounded-[2rem] flex items-center justify-center gap-4 text-3xl font-black uppercase transition-all shadow-2xl
              ${players.length < 2 ? 'bg-stone-800 text-stone-600 cursor-not-allowed opacity-50' : 'bg-white text-black hover:bg-orange-500 hover:text-white hover:scale-105 active:scale-95'}
            `}
          >
            <Play fill="currentColor" size={32} />
            {players.length < 2 ? 'Need 2+ Players' : 'Open the Kitchen'}
          </button>
        </div>
      )}
      {role === 'PLAYER' && (
        <div className="mt-12 text-stone-600 font-black text-2xl uppercase animate-pulse flex items-center gap-3">
          <ChefHat size={32} />
          Wait for Host to start
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
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      
      // Add items to shared pantry
      await updateDoc(roomRef, {
        pantry: arrayUnion(...items.map(i => i.trim().toUpperCase()))
      });

      // Mark self ready
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
      await updateDoc(roomRef, { 
        status: 'PLAYING', 
        activeChefId: roomData.turnOrder[0],
        timer: 0 // Reset timer to trigger host startTurn logic
      });
    }
  };

  useEffect(() => {
    if (roomData?.hostId === user.uid && roomData?.status === 'PANTRY') {
      checkAllReady();
    }
  }, [roomData, user.uid]);

  return (
    <div className="min-h-screen p-6 flex flex-col items-center bg-stone-950">
      <div className="max-w-md w-full text-center space-y-8 mt-12">
        <div className="bg-orange-600 w-20 h-20 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-900/40 transform rotate-6">
          <Utensils size={40} className="text-white" />
        </div>
        <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Stocking the Pantry</h2>
        <p className="text-stone-400 font-bold uppercase text-sm leading-relaxed px-4">Submit 3 weird, personal, or "toxic" ingredients. Be creative!</p>
        
        {!isReady ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {items.map((val, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={40}
                placeholder={`INGREDIENT ${idx + 1}...`}
                className="w-full bg-stone-900 border-2 border-stone-800 rounded-2xl px-6 py-5 font-bold text-lg uppercase outline-none focus:border-orange-600 transition-all text-white placeholder:opacity-20"
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
              Confirm Ingredients
            </button>
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center gap-6 animate-in zoom-in">
            <CheckCircle2 size={100} className="text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" />
            <p className="font-black text-3xl uppercase italic tracking-tighter">ORDER PLACED</p>
            <p className="text-stone-500 font-bold uppercase text-sm">Waiting for other chefs...</p>
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
      startTurn();
    }
    return () => clearInterval(timerInterval.current);
  }, [roomData.activeChefId, isHost]);

  useEffect(() => {
    if (roomData.timer > 0) {
      setTimeLeft(roomData.timer);
    }
  }, [roomData.timer]);

  const startTurn = async () => {
    const randomDish = DISH_NAMES[Math.floor(Math.random() * DISH_NAMES.length)];
    const randomIngredient = roomData.pantry[Math.floor(Math.random() * roomData.pantry.length)];
    
    try {
      await updateDoc(roomRef, {
        timer: ROUND_TIME,
        dishName: randomDish,
        currentIngredient: randomIngredient,
        chefSuccessCount: 0,
        completedIngredients: []
      });

      let localTimer = ROUND_TIME;
      clearInterval(timerInterval.current);
      timerInterval.current = setInterval(async () => {
        localTimer -= 1;
        if (localTimer <= 0) {
          clearInterval(timerInterval.current);
          endTurn();
        } else {
          await updateDoc(roomRef, { timer: localTimer });
        }
      }, 1000);
    } catch (err) {
      console.error("Turn start failed:", err);
    }
  };

  const endTurn = async () => {
    const nextChefIndex = roomData.currentChefIndex + 1;
    let nextRound = roomData.currentRound;
    let nextChefId = '';

    try {
      if (nextChefIndex >= roomData.turnOrder.length) {
        if (nextRound < 3) {
          nextRound += 1;
          nextChefId = roomData.turnOrder[0];
          await updateDoc(roomRef, { 
            currentRound: nextRound, 
            currentChefIndex: 0,
            activeChefId: nextChefId,
            timer: 0
          });
        } else {
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
    } catch (err) {
      console.error("End turn failed:", err);
    }
  };

  const handleGuess = async (guess) => {
    if (roomData.players[user.uid].isLockedOut) return;
    
    try {
      if (guess === roomData.currentIngredient) {
        const nextIngredient = roomData.pantry[Math.floor(Math.random() * roomData.pantry.length)];
        const updates = {
          currentIngredient: nextIngredient,
          chefSuccessCount: roomData.chefSuccessCount + 1,
          completedIngredients: arrayUnion(roomData.currentIngredient)
        };

        updates[`players.${user.uid}.score`] = (roomData.players[user.uid]?.score || 0) + 500;
        updates[`players.${roomData.activeChefId}.score`] = (roomData.players[roomData.activeChefId]?.score || 0) + 300;

        Object.keys(roomData.players).forEach(id => {
          updates[`players.${id}.isLockedOut`] = false;
        });

        if (roomData.chefSuccessCount + 1 === 5) {
          updates[`players.${roomData.activeChefId}.score`] = (updates[`players.${roomData.activeChefId}.score`] || roomData.players[roomData.activeChefId].score) + 1000;
        }

        await updateDoc(roomRef, updates);
        if ('vibrate' in navigator) navigator.vibrate(200);
      } else {
        const updates = {};
        updates[`players.${user.uid}.score`] = Math.max(0, (roomData.players[user.uid]?.score || 0) - 200);
        updates[`players.${user.uid}.isLockedOut`] = true;
        await updateDoc(roomRef, updates);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      }
    } catch (err) {
      console.error("Guess failed:", err);
    }
  };

  const skipIngredient = async () => {
    if (roomData.currentRound === 1) return;
    try {
      const nextIngredient = roomData.pantry[Math.floor(Math.random() * roomData.pantry.length)];
      const updates = { currentIngredient: nextIngredient };
      updates[`players.${user.uid}.score`] = Math.max(0, (roomData.players[user.uid]?.score || 0) - 100);
      await updateDoc(roomRef, updates);
    } catch (err) {
      console.error("Skip failed:", err);
    }
  };

  const currentChefName = roomData.players[roomData.activeChefId]?.name || "Chef";

  if (isHost) {
    return (
      <div className="flex flex-col h-screen p-8 gap-8 overflow-hidden bg-stone-950">
        {/* TV Top Bar */}
        <div className="flex justify-between items-center bg-stone-900 border-2 border-stone-800 p-8 rounded-[3rem] shadow-2xl">
           <div className="flex items-center gap-8">
              <div className="bg-orange-600 p-5 rounded-3xl shadow-lg shadow-orange-900/40">
                <ChefHat className="text-white" size={48} />
              </div>
              <div>
                <p className="text-orange-500 font-black uppercase text-sm tracking-[0.3em] mb-1">
                  Shift {roomData.currentRound}: {
                    roomData.currentRound === 1 ? 'Say Anything' : roomData.currentRound === 2 ? 'One Word' : 'Charades'
                  }
                </p>
                <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">{currentChefName} <span className="text-stone-500">is on the line!</span></h2>
              </div>
           </div>
           <div className={`p-6 rounded-[2rem] flex items-center gap-6 border-4 shadow-inner transition-all duration-300 ${timeLeft < 10 ? 'border-red-600 bg-red-950/30 text-red-500 animate-pulse' : 'border-stone-800 bg-stone-950 text-white'}`}>
              <Timer size={48} />
              <span className="text-7xl font-black font-mono leading-none tabular-nums">{timeLeft}s</span>
           </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-8">
          <div className="col-span-8 bg-stone-900/40 rounded-[4rem] border-4 border-stone-900 p-12 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
             <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-orange-600 rounded-full blur-[200px]"></div>
             </div>
             
             <p className="text-stone-600 font-black uppercase tracking-[0.4em] mb-4 text-sm">Today's Special:</p>
             <h3 className="text-8xl font-black italic text-center mb-16 uppercase drop-shadow-2xl leading-none tracking-tighter">"{roomData.dishName}"</h3>

             <div className="w-full max-w-2xl bg-stone-950 h-28 rounded-full border-4 border-stone-800 flex items-center px-6 gap-3 overflow-hidden relative shadow-2xl">
                {roomData.completedIngredients.map((ing, i) => (
                  <div key={i} className="flex-1 bg-orange-600 h-16 rounded-full flex items-center justify-center animate-in zoom-in duration-500 shadow-lg">
                    <CheckCircle2 className="text-white" size={32} />
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 5 - roomData.completedIngredients.length) }).map((_, i) => (
                  <div key={i} className="flex-1 h-16 rounded-full border-2 border-stone-800 border-dashed opacity-30"></div>
                ))}
                {roomData.chefSuccessCount >= 5 && (
                  <div className="absolute right-10 animate-bounce">
                    <Flame className="text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.6)]" size={64} fill="currentColor" />
                  </div>
                )}
             </div>
             <p className="mt-10 text-stone-600 font-black uppercase tracking-[0.3em] text-xs">Ingredients Prepared: <span className="text-white">{roomData.chefSuccessCount} / 5</span></p>
          </div>

          <div className="col-span-4 flex flex-col gap-8">
            <div className="bg-stone-900 p-10 rounded-[3rem] border-2 border-stone-800 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 bg-red-600 h-full"></div>
              <h4 className="font-black uppercase text-red-500 mb-8 flex items-center gap-3 tracking-tighter text-xl">
                <Skull size={24} /> 86'ed (Banned)
              </h4>
              <div className="space-y-6 max-h-[200px] overflow-y-auto">
                {Object.values(roomData.players).filter(p => p.isLockedOut).map(p => (
                  <div key={p.id} className="flex items-center gap-5 animate-in slide-in-from-right-4">
                    <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/40">
                      <AlertCircle className="text-white" size={28} />
                    </div>
                    <p className="font-black text-2xl uppercase italic line-through text-stone-700 tracking-tight">{p.name}</p>
                  </div>
                ))}
                {Object.values(roomData.players).filter(p => p.isLockedOut).length === 0 && (
                  <p className="text-stone-800 italic font-black uppercase text-lg text-center py-4">Kitchen is clear...</p>
                )}
              </div>
            </div>

            <div className="flex-1 bg-stone-900 p-10 rounded-[3rem] border-2 border-stone-800 shadow-xl flex flex-col">
              <h4 className="font-black uppercase text-stone-600 mb-8 tracking-[0.2em] text-sm">Leaderboard</h4>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                {Object.values(roomData.players).sort((a,b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                  <div key={p.id} className={`flex justify-between items-center p-5 rounded-[1.5rem] border-2 transition-all ${i === 0 ? 'bg-orange-600/10 border-orange-500/50' : 'bg-stone-950 border-stone-800'}`}>
                    <div className="flex items-center gap-4">
                      <span className={`font-black italic text-xl ${i === 0 ? 'text-orange-500' : 'text-stone-700'}`}>{i+1}</span>
                      <span className="font-black text-2xl uppercase tracking-tighter truncate max-w-[140px]">{p.name}</span>
                    </div>
                    <span className={`font-black text-3xl tabular-nums ${i === 0 ? 'text-orange-500' : 'text-white'}`}>{p.score || 0}</span>
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
      <div className="min-h-screen bg-stone-950 p-6 flex flex-col items-center">
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-md">
          <div className="bg-orange-600 p-6 rounded-[2.5rem] mb-12 animate-bounce shadow-2xl shadow-orange-900/50 transform rotate-3">
            <ChefHat size={64} className="text-white" />
          </div>
          <p className="text-orange-500 font-black uppercase text-sm tracking-[0.3em] mb-4">
            Shift {roomData.currentRound}: {
              roomData.currentRound === 1 ? 'SAY ANYTHING' : roomData.currentRound === 2 ? 'ONE WORD ONLY' : 'CHARADES (SILENT)'
            }
          </p>
          <div className="bg-white text-black p-12 rounded-[3.5rem] w-full shadow-[0_0_80px_rgba(255,165,0,0.4)] border-b-[12px] border-stone-300 transform -rotate-1">
             <h2 className="text-5xl md:text-6xl font-black uppercase italic leading-none tracking-tighter">
                {roomData.currentIngredient}
             </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-12 mb-4">
           <div className="bg-stone-900 p-8 rounded-[2rem] border-2 border-stone-800 text-center shadow-lg">
              <p className="text-stone-600 font-black uppercase text-[10px] tracking-widest mb-1">Prepped</p>
              <p className="text-4xl font-black text-orange-500">{roomData.chefSuccessCount}</p>
           </div>
           <div className="bg-stone-900 p-8 rounded-[2rem] border-2 border-stone-800 text-center shadow-lg">
              <p className="text-stone-600 font-black uppercase text-[10px] tracking-widest mb-1">Seconds</p>
              <p className={`text-4xl font-black ${timeLeft < 10 ? 'text-red-600' : 'text-white'}`}>{timeLeft}</p>
           </div>
        </div>

        {roomData.currentRound > 1 && (
          <button 
            onClick={skipIngredient}
            className="w-full max-w-md bg-red-900/20 text-red-500 border-2 border-red-900/40 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-red-900/30 transition-all active:scale-95"
          >
            <RotateCcw size={20} /> Dump Order (-100)
          </button>
        )}
      </div>
    );
  }

  const isLockedOut = roomData.players?.[user.uid]?.isLockedOut;

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 ${isLockedOut ? 'bg-red-950' : 'bg-stone-950'}`}>
       {isLockedOut ? (
         <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-in zoom-in duration-300">
            <div className="bg-white p-6 rounded-[2.5rem] mb-8 transform -rotate-12 shadow-2xl">
              <Skull size={100} className="text-red-600" />
            </div>
            <h2 className="text-6xl font-black uppercase italic text-white mb-6 leading-none tracking-tighter">WRONG<br/>ORDER!</h2>
            <div className="bg-black/20 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
              <p className="text-red-200 font-bold uppercase text-sm tracking-widest leading-relaxed">You are 86'ed until the next ingredient is up.</p>
            </div>
         </div>
       ) : (
         <>
          <div className="p-6 bg-stone-900 border-b-2 border-stone-800 flex justify-between items-center shadow-lg">
             <div>
               <p className="text-[10px] font-black uppercase text-stone-600 tracking-widest mb-1">Wallet</p>
               <p className="text-3xl font-black text-orange-500 tabular-nums">{roomData.players?.[user.uid]?.score || 0}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-stone-600 tracking-widest mb-1">Cooking</p>
                <p className="text-sm font-black uppercase italic truncate w-36 text-white">{roomData.dishName || '...'}</p>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-950">
             <p className="text-[10px] font-black uppercase text-stone-700 text-center my-4 tracking-[0.3em]">Select the matching ingredient</p>
             {roomData.pantry.sort().map((ing, idx) => (
               <button
                 key={idx}
                 onClick={() => handleGuess(ing)}
                 className="w-full bg-stone-900 active:bg-orange-600 border-2 border-stone-800 active:border-orange-500 p-6 rounded-[1.5rem] text-left font-black uppercase text-lg shadow-xl transition-all active:scale-95 text-white active:text-white"
               >
                 {ing}
               </button>
             ))}
             <div className="h-10"></div>
          </div>
         </>
       )}
    </div>
  );
}

function ResultsView({ roomData, roomCode, role, appId }) {
  const players = Object.values(roomData.players).sort((a,b) => (b.score || 0) - (a.score || 0));

  const resetGame = async () => {
    try {
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
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-800 via-stone-950 to-stone-950">
      <div className="text-center mb-16 mt-8 animate-in zoom-in duration-700">
        <div className="inline-block bg-orange-600 p-8 rounded-[3rem] rotate-6 shadow-[0_0_60px_rgba(249,115,22,0.4)] mb-10">
           <Trophy size={100} className="text-white -rotate-6" />
        </div>
        <h1 className="text-7xl font-black italic uppercase tracking-tighter text-white leading-none">Chef de<br/><span className="text-orange-500 text-8xl">Cuisine</span></h1>
        <p className="text-stone-500 font-bold uppercase tracking-[0.4em] mt-6 text-sm">Service has concluded.</p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {players.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-8 p-8 rounded-[3rem] border-4 transition-all animate-in slide-in-from-bottom-8 delay-${i*100}
            ${i === 0 ? 'bg-white text-black border-orange-500 scale-105 shadow-[0_20px_50px_rgba(249,115,22,0.3)]' : 'bg-stone-900 text-white border-stone-800 shadow-xl'}
          `}>
             <span className={`text-5xl font-black italic ${i === 0 ? 'text-orange-500 opacity-100' : 'opacity-20'}`}>{i+1}</span>
             <div className="flex-1">
               <p className="text-3xl font-black uppercase tracking-tighter leading-none mb-1">{p.name}</p>
               <p className={`${i === 0 ? 'text-orange-600' : 'text-stone-500'} font-black uppercase text-xs tracking-widest`}>Points: {p.score || 0}</p>
             </div>
             {i === 0 && <Flame className="text-orange-500" fill="currentColor" size={48} />}
          </div>
        ))}
      </div>

      {role === 'HOST' && (
        <button 
          onClick={resetGame}
          className="mt-20 bg-orange-600 hover:bg-orange-500 text-white px-16 py-8 rounded-[2.5rem] text-3xl font-black uppercase transition-all flex items-center gap-6 shadow-2xl hover:scale-105 active:scale-95"
        >
          <RotateCcw size={40} /> Re-Open Kitchen
        </button>
      )}
    </div>
  );
}
