import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  ChefHat, 
  Skull, 
  Flame, 
  Users, 
  Play, 
  CheckCircle, 
  AlertTriangle,
  RotateCcw,
  Timer,
  ShoppingBasket,
  Trophy,
  Utensils,
  Loader2,
  ChevronRight,
  Clock,
  Zap,
  Coffee,
  Trash2,
  XCircle
} from 'lucide-react';

// --- Firebase Configuration ---
const userFirebaseConfig = {
  apiKey: "AIzaSyD_YGPU1QiWCsbKk7i7uLTRdvwNjock5HQ",
  authDomain: "stir-the-pot-game.firebaseapp.com",
  projectId: "stir-the-pot-game",
  storageBucket: "stir-the-pot-game.firebasestorage.app",
  messagingSenderId: "490697693148",
  appId: "1:490697693148:web:3515513c66df65f987e119"
};

// Prioritize system config for environment stability, otherwise use user provided keys
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Use Project ID as appId for the path to ensure it matches the user's manual Firestore rules
const appId = firebaseConfig.projectId || 'stir-the-pot-game';

// --- Game Constants ---
const FLAVOR_POOL = {
  Sweet: ["Honey", "Maple Syrup", "Sugar", "Vanilla Bean", "Cocoa Powder", "Date Syrup", "Agave", "Cinnamon", "Strawberry", "Peach"],
  Savory: ["Garlic", "Onion", "Rosemary", "Thyme", "Beef Stock", "Mushrooms", "Black Pepper", "Truffle Oil", "Cumin", "Paprika"],
  Spicy: ["Chili Flakes", "Jalapeño", "Sriracha", "Wasabi", "Habanero", "Ginger", "Cayenne", "Black Mustard Seed", "Horseradish", "Chipotle"],
  Sour: ["Lemon Juice", "Lime Zest", "Vinegar", "Green Apple", "Yogurt", "Tamarind", "Pickle Brine", "Kalamansi", "Sumac", "Kimchi Juice"],
  Umami: ["Soy Sauce", "Miso Paste", "Worcestershire Sauce", "Nutritional Yeast", "Dried Seaweed", "Parmesan", "Anchovies", "Tomato Paste", "Bonito Flakes", "Fish Sauce"],
  Bitter: ["Dark Chocolate", "Coffee Grounds", "Kale", "Grapefruit Peel", "Turmeric", "Dandelion Greens", "Matcha", "Beer", "Radicchio", "Cranberry"]
};

const DISH_NAMES = [
  "Nuclear Nachos", "The Gilded Goulash", "Midnight Medley", "Grandma's Regret", 
  "Suburban Sushi", "Void Velouté", "Panic Pasta", "Rusty Ratatouille", 
  "Lava Lasagna", "Neon Noodles", "Cryptid Curry", "Screaming Soufflé",
  "Tectonic Tacos", "Ghostly Gazpacho", "Shattered Slaw"
];

const TAINTED_INGREDIENTS = ["Motor Oil", "Old Gym Sock", "Industrial Sludge", "Expired Milk", "Rusty Nails", "Dish Soap", "Blue Paint", "Lawn Clippings", "Hairball", "Mystery Goo"];
const CATEGORIES = Object.keys(FLAVOR_POOL);

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to generate a recipe based on what chefs actually have to ensure it's winnable
const generateWinnableRecipe = (players, length) => {
    const availableCategories = new Set();
    Object.values(players).forEach(p => {
        if (p.role === 'CHEF' && p.hand) {
            p.hand.forEach(card => availableCategories.add(card.category));
        }
    });
    const cats = Array.from(availableCategories);
    const pool = cats.length > 0 ? cats : CATEGORIES;
    return Array.from({length}, () => getRandomItem(pool));
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');
  const [roomCode, setRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [authInited, setAuthInited] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Auth Management - Rule 3 Compliance
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        await signInAnonymously(auth);
      } finally {
        setAuthInited(true);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Sync Room Data - Rule 1 & 2 Compliance
  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val ? snapshot.val() : snapshot.data();
        setRoomData(data);
      } else if (view !== 'landing') {
        setError("Service disconnected.");
        setView('landing');
      }
    }, (err) => {
      if (err.code === 'permission-denied') {
        setError("Access Denied. Check Firestore Rules for artifacts/" + appId);
      }
    });
    return () => unsubscribe();
  }, [user, roomCode, view]);

  // Host Countdown logic
  useEffect(() => {
    if (view !== 'host' || !roomData || roomData.state === 'LOBBY' || !roomData.expiresAt) return;
    const timer = setInterval(async () => {
      const remaining = Math.max(0, Math.floor((roomData.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && roomData.state.includes('ROUND')) {
          const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
          // Auto-fail current pots if time expires
          const newPots = {...roomData.pots};
          Object.keys(newPots).forEach(id => {
              if (newPots[id].index < newPots[id].recipe.length) {
                newPots[id].name = getRandomItem(DISH_NAMES) + " (EXPIRED)";
                newPots[id].recipe = generateWinnableRecipe(roomData.players, newPots[id].recipe.length);
                newPots[id].index = 0;
              }
          });
          await updateDoc(roomRef, { 
            pots: newPots, 
            expiresAt: Date.now() + 30000,
            stinkMeter: Math.min(100, roomData.stinkMeter + 10)
          });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [view, roomData?.expiresAt, roomData?.state]);

  // --- Actions ---

  const handleCreateRoom = async () => {
    if (!user) return;
    setIsBusy(true);
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const initialState = {
      code,
      state: 'LOBBY',
      round: 0,
      players: {},
      pots: {},
      stinkMeter: 0,
      activePower: null,
      lastUpdated: Date.now()
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code), initialState);
      setRoomCode(code);
      setView('host');
    } catch (e) {
      setError("Permission Denied: Ensure rules allow writes to artifacts/" + appId);
    }
    setIsBusy(false);
  };

  const handleJoinRoom = async () => {
    if (!user || !roomCode) return;
    setIsBusy(true);
    const upperCode = roomCode.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', upperCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
      setError("Table code not found.");
      setIsBusy(false);
      return;
    }
    await updateDoc(roomRef, {
      [`players.${user.uid}`]: {
        id: user.uid,
        name: playerName || "Mystery Chef",
        score: 0,
        role: 'CHEF',
        hand: []
      }
    });
    setRoomCode(upperCode);
    setView('player');
    setIsBusy(false);
  };

  const startRound = async () => {
    if (!roomData) return;
    const nextRound = roomData.round + 1;
    if (nextRound > 3) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), { state: 'GAME_OVER' });
      return;
    }

    const playerIds = Object.keys(roomData.players);
    const saboteurId = shuffle(playerIds)[0];
    const newPlayers = { ...roomData.players };
    
    playerIds.forEach(id => {
      const isSab = id === saboteurId;
      newPlayers[id].role = isSab ? 'SABOTEUR' : 'CHEF';
      const hand = [];
      for(let i=0; i<6; i++) {
        const cat = getRandomItem(CATEGORIES);
        hand.push(isSab 
          ? { name: getRandomItem(TAINTED_INGREDIENTS), category: cat, type: 'TAINTED' } 
          : { name: getRandomItem(FLAVOR_POOL[cat]), category: cat, type: 'CLEAN' }
        );
      }
      newPlayers[id].hand = hand;
    });

    let pots = {};
    let headChefId = null;

    if (nextRound === 1) {
      pots = { main: { name: getRandomItem(DISH_NAMES), recipe: generateWinnableRecipe(newPlayers, 6), index: 0, history: [] } };
    } else if (nextRound === 2) {
      pots = {
        soup: { name: 'Sludge Soup', recipe: generateWinnableRecipe(newPlayers, 4), index: 0, history: [] },
        steak: { name: 'Burnt Brisket', recipe: generateWinnableRecipe(newPlayers, 4), index: 0, history: [] },
        cake: { name: 'Broken Cake', recipe: generateWinnableRecipe(newPlayers, 4), index: 0, history: [] }
      };
    } else {
      pots = { fusion: { name: 'THE FINAL FUSION', recipe: generateWinnableRecipe(newPlayers, 8), index: 0, history: [] } };
      headChefId = getRandomItem(playerIds);
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), {
      state: `ROUND${nextRound}`,
      round: nextRound,
      players: newPlayers,
      pots,
      headChefId,
      stinkMeter: 0,
      activePower: null,
      votes: {},
      expiresAt: Date.now() + 60000 // 60s rounds
    });
  };

  const playCard = async (cardIndex, potId) => {
    if (!roomData || isBusy) return;
    setIsBusy(true);
    const me = roomData.players[user.uid];
    const card = me.hand[cardIndex];
    const pot = roomData.pots[potId];
    if (!card || pot.index >= pot.recipe.length) { setIsBusy(false); return; }

    const isSabotage = card.type === 'TAINTED';
    const isCorrect = card.category === pot.recipe[pot.index] && card.type === 'CLEAN';

    let newStink = roomData.stinkMeter;
    let newScore = me.score;
    let updates = {};

    if (isSabotage) {
      // SABOTAGE: Stop ticket, force new one, everybody else suffers
      newStink += 25;
      newScore += 40;
      updates[`pots.${potId}`] = {
          ...pot,
          name: getRandomItem(DISH_NAMES) + " (SABOTAGED!)",
          recipe: generateWinnableRecipe(roomData.players, pot.recipe.length),
          index: 0,
          history: [...pot.history, { ...card, playerName: me.name, trashing: true }]
      };
    } else if (isCorrect) {
      newScore += 15;
      updates[`pots.${potId}.index`] = pot.index + 1;
      updates[`pots.${potId}.history`] = [...pot.history, { ...card, playerName: me.name }];
    } else {
      // MISTAKE: Trash ticket, move to new one, chef loses points
      newScore -= 30;
      updates[`pots.${potId}`] = {
          ...pot,
          name: getRandomItem(DISH_NAMES) + " (MISTAKE!)",
          recipe: generateWinnableRecipe(roomData.players, pot.recipe.length),
          index: 0,
          history: [...pot.history, { ...card, playerName: me.name, trashing: true }]
      };
    }

    const newHand = [...me.hand];
    newHand.splice(cardIndex, 1);
    const newCat = getRandomItem(CATEGORIES);
    newHand.push(me.role === 'SABOTEUR' ? { name: getRandomItem(TAINTED_INGREDIENTS), category: newCat, type: 'TAINTED' } : { name: getRandomItem(FLAVOR_POOL[newCat]), category: newCat, type: 'CLEAN' });

    updates[`players.${user.uid}.score`] = newScore;
    updates[`players.${user.uid}.hand`] = newHand;
    updates.stinkMeter = newStink;

    // Check completion
    const potsState = { ...roomData.pots };
    if (updates[`pots.${potId}`]) potsState[potId] = updates[`pots.${potId}`];
    else if (updates[`pots.${potId}.index`]) potsState[potId].index = updates[`pots.${potId}.index`];

    const allFinished = Object.values(potsState).every(p => p.index >= p.recipe.length);

    if (newStink >= 100) updates.state = 'TASTE_TEST';
    else if (allFinished) updates.state = 'ROUND_END';

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), updates);
    setIsBusy(false);
  };

  const handleVote = async (targetId) => {
    if (!roomData || roomData.votes?.[user.uid]) return;
    const currentVotes = { ...(roomData.votes || {}), [user.uid]: targetId };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), { votes: currentVotes });

    const total = Object.keys(roomData.players).length;
    if (Object.keys(currentVotes).length >= total) {
      const tallies = {};
      Object.values(currentVotes).forEach(v => tallies[v] = (tallies[v] || 0) + 1);
      const topVoted = Object.entries(tallies).sort((a,b) => b[1] - a[1])[0][0];
      const saboteur = Object.values(roomData.players).find(p => p.role === 'SABOTEUR');
      const caught = topVoted === saboteur.id;
      
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), {
        state: 'VOTE_REVEAL',
        voteWinner: caught ? 'SABOTEUR' : 'CHEF',
        winnerId: topVoted,
        activePower: caught ? null : 'SMOKE'
      });
    }
  };

  // --- UI Components ---

  const ReceiptCard = ({ ing }) => (
    <div className={`p-4 rounded-xl border-4 ${ing.type === 'TAINTED' || ing.trashing ? 'bg-red-50 border-red-500 animate-pulse' : 'bg-white border-slate-200'} shrink-0 min-w-[150px] shadow-lg transform rotate-1 transition-all`}>
      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{ing.category}</p>
      <p className={`text-lg font-black leading-tight ${ing.type === 'TAINTED' ? 'text-red-600' : 'text-slate-800'}`}>{ing.name}</p>
      <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2">
         <p className="text-[8px] font-black text-slate-400 uppercase">{ing.playerName}</p>
         {ing.trashing && <Trash2 size={12} className="text-red-500" />}
      </div>
    </div>
  );

  const PotVisual = ({ pot, blurred = false }) => (
    <div className="flex flex-col items-center animate-in zoom-in duration-500">
      <div className="relative w-80 h-80 flex items-center justify-center">
        <div className={`absolute inset-0 rounded-full blur-[120px] opacity-20 transition-colors ${roomData.stinkMeter > 50 ? 'bg-red-600' : 'bg-orange-500'}`} />
        <div className={`relative z-10 p-12 bg-slate-800 rounded-full border-8 border-slate-700 shadow-2xl transition-all ${pot.index === 0 && pot.history.length > 0 ? 'border-red-500' : ''}`}>
          <Flame size={120} className={`${roomData.stinkMeter > 50 ? 'text-red-500' : 'text-orange-500'} animate-pulse`} />
          {pot.index === 0 && pot.history.length > 0 && (
             <div className="absolute inset-0 bg-red-600/60 flex items-center justify-center rounded-full animate-in fade-in duration-300">
               <Trash2 size={80} className="text-white animate-bounce" />
             </div>
          )}
        </div>
        <div className={`absolute -top-4 -right-4 px-10 py-4 rounded-[2.5rem] font-black text-4xl shadow-2xl transition-all ${pot.index >= pot.recipe.length ? 'bg-green-500' : 'bg-orange-600'} text-white italic`}>
            {pot.index >= pot.recipe.length ? <CheckCircle size={40} /> : `${pot.index}/${pot.recipe.length}`}
        </div>
      </div>
      <div className="mt-12 text-center w-full max-w-[400px]">
        <h3 className="text-5xl font-black uppercase tracking-tighter italic mb-4 truncate text-white drop-shadow-lg">{pot.name}</h3>
        <div className="bg-white text-slate-950 px-12 py-10 rounded-[3rem] shadow-[0_15px_0_rgb(203,213,225)] min-h-[180px] flex flex-col justify-center border-4 border-slate-50 relative overflow-hidden">
          {pot.index >= pot.recipe.length ? (
              <div className="space-y-2 animate-in zoom-in">
                 <h2 className="text-6xl font-black text-green-600 uppercase italic">ORDER READY!</h2>
                 <p className="text-slate-400 font-bold uppercase text-xs">Waiting for kitchen clear...</p>
              </div>
          ) : blurred ? (
             <div className="flex gap-6 justify-center">
               {Array.from({length: 3}).map((_, i) => <Zap key={i} size={56} className="text-slate-200 animate-pulse" />)}
             </div>
          ) : (
            <>
                <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] mb-3">Kitchen Needs:</p>
                <h2 className="text-7xl font-black uppercase tracking-tighter leading-none">{pot.recipe[pot.index]}</h2>
                {pot.recipe[pot.index+1] && (
                    <div className="mt-6 flex items-center justify-center gap-3 border-t border-slate-100 pt-5">
                        <span className="text-slate-300 text-[11px] font-black uppercase tracking-widest leading-none">UP NEXT:</span>
                        <span className="text-slate-600 font-black uppercase text-lg leading-none italic">{pot.recipe[pot.index+1]}</span>
                    </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // --- Render Views ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 italic overflow-hidden">
        <div className="bg-white p-12 rounded-[4rem] shadow-2xl max-w-sm w-full border-b-[20px] border-slate-200 relative z-10">
           <div className="flex flex-col items-center mb-12">
             <div className="bg-orange-500 p-8 rounded-[3rem] shadow-[0_15px_0_rgb(194,65,12)] mb-8">
               <Utensils size={70} className="text-white" />
             </div>
             <h1 className="text-7xl font-black text-slate-950 tracking-tighter text-center leading-none italic">STIR THE POT</h1>
             <p className="text-slate-400 font-black uppercase tracking-[0.5em] text-[11px] mt-4 text-center">Gourmet Sabotage Simulator</p>
           </div>
           
           <div className="space-y-8">
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-4 italic">Chef Identity</label>
                <input className="w-full p-6 bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] font-black text-3xl focus:border-orange-500 outline-none uppercase placeholder:text-slate-200" placeholder="RAMSAY" value={playerName} onChange={e => setPlayerName(e.target.value.toUpperCase())} />
             </div>
             <div className="bg-slate-100 p-8 rounded-[3rem] space-y-5 border-4 border-slate-100 shadow-inner">
                <input className="w-full p-4 bg-white border-4 border-slate-200 rounded-3xl font-black text-5xl text-center uppercase tracking-[0.4em] focus:border-orange-500 outline-none" placeholder="CODE" maxLength={4} value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} />
                <button onClick={handleJoinRoom} className="w-full py-7 bg-orange-500 text-white font-black text-3xl rounded-[2rem] shadow-[0_12px_0_rgb(194,65,12)] active:shadow-none active:translate-y-2 transition-all italic tracking-tighter">JOIN THE LINE</button>
             </div>
             <button onClick={handleCreateRoom} className="w-full py-6 bg-slate-950 text-white font-black text-xl rounded-[2rem] flex items-center justify-center gap-4 shadow-[0_12px_0_rgb(30,41,59)] active:translate-y-2 active:shadow-none transition-all hover:bg-slate-900 border-2 border-white/5 italic">
               <ChefHat size={28} className="text-orange-500" /> HOST A TABLE
             </button>
           </div>
           {error && <div className="mt-8 p-4 bg-red-50 text-red-500 text-[10px] font-black rounded-xl border-2 border-red-100 text-center uppercase break-words">{error}</div>}
        </div>
      </div>
    );
  }

  if (view === 'host' && roomData) {
    return (
      <div className={`min-h-screen bg-slate-900 text-white p-12 flex flex-col font-sans italic overflow-hidden transition-all duration-1000 ${roomData.activePower === 'SMOKE' ? 'filter blur-[100px] opacity-20 scale-125' : ''}`}>
        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-between">
            <div className="text-center">
              <span className="bg-orange-500 text-white px-12 py-4 rounded-full font-black uppercase tracking-[0.6em] text-2xl shadow-2xl mb-12 inline-block">SHIFT DOOR OPEN</span>
              <h2 className="text-[22rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_40px_80px_rgba(255,255,255,0.15)] italic uppercase">{roomCode}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 w-full max-w-7xl px-12">
              {Object.values(roomData.players).map(p => (
                <div key={p.id} className="bg-white/5 backdrop-blur-3xl p-12 rounded-[4rem] border-4 border-white/10 flex flex-col items-center gap-8 animate-in zoom-in shadow-2xl">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-orange-500 flex items-center justify-center text-7xl font-black shadow-[0_15px_0_rgb(194,65,12)] italic text-white leading-none">{p.name[0]}</div>
                  <span className="font-black text-4xl truncate w-full text-center tracking-tighter italic uppercase text-white/90">{p.name}</span>
                </div>
              ))}
            </div>
            <button onClick={startRound} disabled={Object.keys(roomData.players).length < 3} className="bg-white text-slate-950 px-48 py-16 rounded-full font-black text-8xl shadow-[0_30px_0_rgb(203,213,225)] active:translate-y-5 active:shadow-none transition-all flex items-center gap-14 italic uppercase tracking-tighter group hover:bg-orange-500 hover:text-white">
              <RotateCcw size={100} className="group-hover:animate-spin" /> {roomData.round === 0 ? 'START' : 'NEXT'}
            </button>
          </div>
        )}

        {(roomData.state === 'ROUND1' || roomData.state === 'ROUND2' || roomData.state === 'ROUND3') && (
           <div className="flex-1 flex flex-col gap-12 max-w-full mx-auto w-full animate-in fade-in duration-500">
              <div className="flex justify-between items-end px-12">
                 <div className="space-y-4">
                    <span className="text-orange-500 font-black uppercase tracking-[0.5em] text-2xl italic block">SHIFT #{roomData.round}</span>
                    <h2 className="text-[10rem] font-black uppercase tracking-tighter leading-none italic">{roomData.state.replace('ROUND', 'SHIFT ')}</h2>
                    <div className={`p-10 rounded-[3rem] border-4 inline-flex items-center gap-6 ${timeLeft < 15 ? 'bg-red-600 border-red-800 animate-pulse' : 'bg-white/5 border-white/10 shadow-2xl'}`}>
                        <Clock size={60} />
                        <span className="text-8xl font-black tabular-nums tracking-tighter italic">{timeLeft}s</span>
                    </div>
                 </div>
                 <div className="flex flex-col items-end gap-6 bg-white/5 p-12 rounded-[4rem] border-4 border-white/10 shadow-2xl">
                    <div className="flex items-center gap-8">
                        <Skull size={60} className={roomData.stinkMeter > 50 ? 'text-red-500 animate-pulse' : 'text-white/20'} />
                        <span className="text-8xl font-black italic tracking-tighter tabular-nums text-white/40">{roomData.stinkMeter}% STINK</span>
                    </div>
                    <div className="w-[500px] h-14 bg-black/40 rounded-full overflow-hidden p-2 border-2 border-white/10">
                      <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-600 rounded-full transition-all duration-1000 shadow-xl" style={{width: `${roomData.stinkMeter}%`}} />
                    </div>
                 </div>
              </div>

              <div className="flex-1 flex items-center justify-center gap-16 px-12">
                 {Object.values(roomData.pots).map(p => (
                     <PotVisual key={p.name} pot={p} blurred={roomData.state === 'ROUND3'} />
                 ))}
              </div>

              <div className="bg-[#f0f0f0] p-12 rounded-[4.5rem] flex gap-10 items-center border-b-[25px] border-slate-300 shadow-3xl overflow-hidden relative mx-12">
                 <div className="shrink-0 font-black text-slate-300 uppercase tracking-[0.8em] text-sm transform -rotate-90 italic">Receipt History</div>
                 <div className="flex gap-8 items-center w-full">
                    {Object.values(roomData.pots).flatMap(p => p.history).slice(-10).reverse().map((ing, i) => <ReceiptCard key={i} ing={ing} />)}
                 </div>
              </div>
           </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-20 animate-in zoom-in duration-500">
             <div className="bg-red-600 p-16 rounded-full shadow-[0_0_200px_rgba(239,68,68,0.9)] animate-pulse border-8 border-red-500">
                <Skull size={250} className="text-white" />
             </div>
             <h2 className="text-[16rem] font-black italic tracking-tighter leading-none text-white underline decoration-red-600 decoration-[20px] underline-offset-[40px]">HEALTH INSPECTION!</h2>
             <div className="bg-white p-24 rounded-[6rem] text-slate-950 w-full max-w-7xl shadow-3xl relative border-b-[40px] border-slate-300 flex gap-16 items-center overflow-x-auto">
                <div className="absolute top-0 right-32 transform -translate-y-1/2 bg-red-600 text-white px-20 py-10 rounded-[3rem] font-black uppercase tracking-widest text-5xl italic shadow-3xl">CRITICAL EVIDENCE</div>
                <div className="flex gap-12 items-center">
                    {Object.values(roomData.pots).flatMap(p => p.history).slice(-6).map((ing, i) => <ReceiptCard key={i} ing={ing} />)}
                </div>
             </div>
             <p className="text-7xl text-white/30 font-black animate-bounce uppercase italic tracking-widest">EXPOSE THE MOLE ON YOUR DEVICE!</p>
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL') && (
           <div className="flex-1 flex flex-col items-center justify-center text-center gap-24 animate-in zoom-in duration-1000 px-24">
              <h2 className="text-[18rem] font-black italic tracking-tighter leading-none uppercase text-white drop-shadow-[0_40px_40px_rgba(0,0,0,0.5)]">
                 {roomData.state === 'ROUND_END' ? 'SERVICE PLATED!' : roomData.voteWinner === 'SABOTEUR' ? 'TERMINATED!' : 'MISFIRE!'}
              </h2>
              <div className="text-8xl bg-orange-600 px-32 py-20 rounded-[5rem] shadow-[0_40px_0_rgb(194,65,12)] transform -rotate-1 font-black text-white italic tracking-tight flex items-center gap-12">
                 <Utensils size={100} />
                 {roomData.state === 'ROUND_END' ? '5-STAR SERVICE ACHIEVED!' : `THE MOLE WAS ${Object.values(roomData.players).find(p => p.role === 'SABOTEUR')?.name}!`}
              </div>
              <button onClick={startRound} className="bg-white text-slate-950 px-48 py-20 rounded-full font-black text-9xl hover:bg-orange-500 hover:text-white transition-all transform hover:scale-110 shadow-[0_40px_0_rgb(203,213,225)] active:translate-y-6 italic uppercase tracking-tighter">
                  {roomData.round >= 3 ? 'FINISH SHIFT' : 'NEXT TICKET'}
              </button>
           </div>
        )}

        {roomData.state === 'GAME_OVER' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-20 animate-in fade-in duration-1000">
                <Trophy size={300} className="text-yellow-400 animate-bounce drop-shadow-[0_50px_100px_rgba(250,204,21,0.5)]" />
                <h2 className="text-[14rem] font-black italic tracking-tighter text-white uppercase leading-none">RESTAURANT SHUTDOWN</h2>
                <div className="grid grid-cols-1 gap-12 w-full max-w-5xl">
                    {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
                        <div key={p.id} className="bg-white/10 p-16 rounded-[4.5rem] flex justify-between items-center border-8 border-white/5 shadow-3xl transform transition hover:scale-105">
                            <div className="flex items-center gap-12">
                                <span className="text-8xl font-black text-white/20 italic">#{i+1}</span>
                                <span className="text-7xl font-black uppercase tracking-tighter italic text-white/90">{p.name}</span>
                            </div>
                            <span className="text-9xl font-black text-orange-400 tabular-nums italic tracking-tighter">{p.score}</span>
                        </div>
                    ))}
                </div>
                <button onClick={() => window.location.reload()} className="bg-orange-500 px-32 py-16 rounded-full font-black text-6xl text-white shadow-[0_30px_0_rgb(194,65,12)] transform transition hover:scale-110 active:translate-y-5 uppercase tracking-widest italic mt-12 border-8 border-orange-400">NEW CAREER</button>
            </div>
        )}
      </div>
    );
  }

  if (view === 'player' && roomData) {
    const me = roomData.players[user.uid];
    if (!me) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black italic text-4xl animate-pulse uppercase">Reconnecting...</div>;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans italic select-none overflow-hidden">
        <div className="flex justify-between items-center mb-6 bg-white p-6 rounded-[2.5rem] shadow-sm border-b-8 border-slate-200">
           <div className="flex items-center gap-4 text-slate-950">
              <div className={`p-4 rounded-2xl shadow-inner border-b-4 ${me.role === 'SABOTEUR' ? 'bg-red-600 text-white border-red-800' : 'bg-orange-500 text-white border-orange-700'}`}>
                 {me.role === 'SABOTEUR' ? <Skull size={32} /> : <ChefHat size={32} />}
              </div>
              <div>
                <h3 className="font-black text-2xl leading-none tracking-tight uppercase">{me.name}</h3>
                <span className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em] italic">{me.role}</span>
              </div>
           </div>
           <div className="text-5xl font-black text-slate-950 tabular-nums tracking-tighter italic">{me.score}</div>
        </div>

        {roomData.state === 'LOBBY' && (
           <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-[4rem] border-b-[16px] border-slate-200 shadow-2xl">
              <Coffee size={120} className="text-orange-500 animate-bounce mb-10" />
              <h2 className="text-6xl font-black text-slate-950 tracking-tighter mb-4 uppercase text-center leading-none italic">BREAK <br/> ROOM</h2>
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs text-center px-12">Wait for Management to open the floor...</p>
           </div>
        )}

        {(roomData.state === 'ROUND1' || roomData.state === 'ROUND3') && (
           <div className="flex-1 flex flex-col gap-6">
              {roomData.headChefId === user.uid && (
                 <div className="bg-orange-500 p-8 rounded-[3rem] text-white shadow-xl border-b-[15px] border-orange-800 animate-in slide-in-from-top">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] italic mb-4 opacity-80">You are Head Chef: SHOUT THE ORDER!</p>
                   <div className="flex flex-wrap gap-3">
                     {Object.values(roomData.pots)[0].recipe.map((cat, i) => (
                       <span key={i} className={`px-4 py-2 rounded-2xl font-black text-2xl uppercase tracking-tighter transition-all ${i === Object.values(roomData.pots)[0].index ? 'bg-white text-orange-600 scale-110 shadow-xl' : 'opacity-40'}`}>{cat}</span>
                     ))}
                   </div>
                 </div>
              )}
              <div className="bg-slate-950 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden border-b-[15px] border-black">
                 <div className="flex items-center gap-3 mb-2 opacity-50">
                     <Utensils size={18} className="text-orange-500" />
                     <p className="text-[11px] font-black text-white uppercase tracking-widest italic">Station Call:</p>
                 </div>
                 <h2 className="text-7xl font-black uppercase tracking-tighter leading-none italic mb-4 text-white">
                   {roomData.state === 'ROUND3' ? '???' : Object.values(roomData.pots)[0].recipe[Object.values(roomData.pots)[0].index] || 'COMPLETE'}
                 </h2>
                 <p className="text-orange-500 text-sm font-black uppercase tracking-widest italic drop-shadow-lg">{Object.values(roomData.pots)[0].name}</p>
              </div>
              <div className="grid grid-cols-2 gap-6 flex-1 overflow-y-auto pb-6">
                 {me.hand.map((card, i) => (
                    <button key={i} onClick={() => playCard(i, Object.keys(roomData.pots)[0])} className={`relative p-8 rounded-[3.5rem] border-b-[15px] text-left min-h-[160px] flex flex-col justify-between active:scale-95 active:translate-y-4 transition-all shadow-xl ${me.role === 'SABOTEUR' ? 'bg-slate-900 border-black text-white' : 'bg-white border-slate-200 text-slate-950'}`}>
                      <span className={`text-xs font-black uppercase italic ${me.role === 'SABOTEUR' ? 'text-red-500' : 'text-orange-500'}`}>{card.category}</span>
                      <span className="font-black text-2xl leading-[1.1] uppercase tracking-tighter italic">{card.name}</span>
                      {me.role === 'SABOTEUR' && <Skull size={16} className="absolute bottom-6 right-6 opacity-10" />}
                    </button>
                 ))}
              </div>
           </div>
        )}

        {roomData.state === 'ROUND2' && (
           <div className="flex-1 flex flex-col gap-6">
              {!selectedStation ? (
                 <div className="flex-1 flex flex-col gap-8 items-center justify-center p-4">
                   <h2 className="text-7xl font-black text-center mb-12 uppercase tracking-tighter italic text-slate-950 leading-none">STATION <br/> SELECT</h2>
                   <button onClick={() => setSelectedStation('soup')} className="w-full py-12 bg-white border-b-[18px] border-blue-200 rounded-[4rem] font-black text-5xl shadow-2xl flex items-center justify-center gap-8 text-blue-600 active:translate-y-4 active:shadow-none transition-all uppercase tracking-tighter italic shadow-blue-100"><Wind size={60} /> SOUP</button>
                   <button onClick={() => setSelectedStation('steak')} className="w-full py-12 bg-white border-b-[18px] border-red-200 rounded-[4rem] font-black text-5xl shadow-2xl flex items-center justify-center gap-8 text-red-600 active:translate-y-4 active:shadow-none transition-all uppercase tracking-tighter italic shadow-red-100"><Flame size={60} /> STEAK</button>
                   <button onClick={() => setSelectedStation('cake')} className="w-full py-12 bg-white border-b-[18px] border-pink-200 rounded-[4rem] font-black text-5xl shadow-2xl flex items-center justify-center gap-8 text-pink-600 active:translate-y-4 active:shadow-none transition-all uppercase tracking-tighter italic shadow-pink-100"><ShoppingBasket size={60} /> CAKE</button>
                 </div>
              ) : (
                <div className="flex-1 flex flex-col animate-in zoom-in duration-300">
                  <div className="flex justify-between items-center mb-8">
                    <button onClick={() => setSelectedStation(null)} className="font-black text-orange-600 bg-white px-8 py-4 rounded-full shadow-lg border-b-4 border-orange-200 flex items-center gap-3 uppercase italic text-sm active:translate-y-1 transition-all"> <RotateCcw size={18} className="rotate-180" /> EXIT {selectedStation.toUpperCase()}</button>
                    <div className="bg-slate-950 text-white px-8 py-4 rounded-full font-black italic tracking-widest text-lg uppercase shadow-2xl border-b-4 border-black">{selectedStation}</div>
                  </div>
                  <div className="bg-slate-950 p-12 rounded-[4rem] text-white border-b-[20px] border-black shadow-3xl mb-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-10 rotate-45 scale-150"><Zap size={120} /></div>
                    <p className="text-[12px] font-black text-orange-400 uppercase tracking-[0.5em] mb-3 italic">Ticket Requirements:</p>
                    <h2 className="text-8xl font-black uppercase tracking-tighter leading-none italic text-white drop-shadow-xl">{roomData.pots[selectedStation].recipe[roomData.pots[selectedStation].index] || 'COMPLETE'}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-6 flex-1 overflow-y-auto px-2">
                    {me.hand.map((card, i) => (
                        <button key={i} onClick={() => playCard(i, selectedStation)} className={`relative p-8 rounded-[3.5rem] border-b-[15px] text-left min-h-[170px] flex flex-col justify-between active:scale-95 active:translate-y-4 transition-all shadow-xl ${me.role === 'SABOTEUR' ? 'bg-slate-900 border-black text-white' : 'bg-white border-slate-200 text-slate-950'}`}>
                          <span className={`text-xs font-black uppercase italic ${me.role === 'SABOTEUR' ? 'text-red-500' : 'text-orange-500'}`}>{card.category}</span>
                          <span className="font-black text-2xl leading-[1.1] uppercase tracking-tighter italic">{card.name}</span>
                        </button>
                    ))}
                  </div>
                </div>
              )}
           </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col space-y-10 pt-8 animate-in slide-in-from-bottom duration-500">
             <div className="bg-red-600 p-14 rounded-[5rem] text-white text-center shadow-3xl border-b-[25px] border-red-900 flex flex-col items-center">
               <Skull size={100} className="mb-8 animate-pulse" />
               <h2 className="text-7xl font-black italic tracking-tighter leading-none uppercase text-white">TERMINATE!</h2>
               <p className="font-black text-red-100 uppercase tracking-widest text-xs mt-4 italic opacity-80">Identify the contaminated employee</p>
             </div>
             <div className="space-y-5 px-2">
               {Object.values(roomData.players).filter(p => p.id !== user.uid).map(p => (
                 <button key={p.id} onClick={() => handleVote(p.id)} disabled={!!roomData.votes?.[user.uid]} className={`w-full p-12 rounded-[4rem] border-b-[20px] font-black text-5xl transition-all flex items-center justify-between tracking-tighter italic uppercase ${roomData.votes?.[user.uid] === p.id ? 'bg-red-500 border-red-800 text-white translate-y-5 shadow-none' : 'bg-white border-slate-200 text-slate-950 shadow-3xl active:translate-y-5 active:shadow-none'}`}>
                   {p.name} {roomData.votes?.[user.uid] === p.id && <CheckCircle size={60} />}
                 </button>
               ))}
             </div>
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL' || roomData.state === 'GAME_OVER') && (
           <div className="flex-1 flex flex-col items-center justify-center p-16 bg-white rounded-[5.5rem] border-b-[25px] border-slate-200 shadow-3xl text-center animate-in zoom-in duration-500 italic">
              <div className="bg-orange-100 p-16 rounded-full mb-12 shadow-inner group">
                 <Utensils size={120} className="text-orange-500 animate-spin-slow group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-[6rem] font-black text-slate-950 tracking-tighter mb-6 uppercase leading-none italic drop-shadow-lg">ORDER UP!</h2>
              <p className="text-slate-400 font-black uppercase tracking-[0.5em] text-sm text-center px-12">Checking the guest reviews on the big screen...</p>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white italic">
      <div className="relative mb-16">
        <div className="absolute inset-0 bg-orange-500/20 blur-[100px] animate-pulse" />
        <Flame size={200} className="text-orange-500 relative z-10 animate-bounce" />
      </div>
      <span className="font-black uppercase tracking-[1em] text-white/30 text-lg animate-pulse">Prepping Shift...</span>
    </div>
  );
}