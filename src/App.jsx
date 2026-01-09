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

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rawAppId = typeof __firebase_config === 'undefined' ? 'stir-the-pot-game' : (typeof __app_id !== 'undefined' ? __app_id : 'stir-the-pot-game');
const appId = rawAppId.replace(/\//g, '_');

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

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
      } catch (err) { await signInAnonymously(auth); }
      setAuthInited(true);
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) setRoomData(snapshot.data());
      else if (view !== 'landing') { setError("Shift ended."); setView('landing'); }
    });
    return () => unsubscribe();
  }, [user, roomCode, view]);

  useEffect(() => {
    if (view !== 'host' || !roomData || roomData.state === 'LOBBY' || !roomData.expiresAt) return;
    const timer = setInterval(async () => {
      const remaining = Math.max(0, Math.floor((roomData.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && roomData.state.includes('ROUND')) {
          const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
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
      expiresAt: Date.now() + 60000 
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
      <p className="text-[10px] font-black uppercase text-slate-400 mb-1 leading-none tracking-tighter">Category: {ing.category}</p>
      <p className={`text-xl font-black ${ing.type === 'TAINTED' ? 'text-red-600' : 'text-slate-800'} leading-tight`}>{ing.name}</p>
      <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2">
         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{ing.playerName}</p>
         {ing.trashing && <Trash2 size={12} className="text-red-500" />}
      </div>
    </div>
  );

  const PotVisual = ({ pot, blurred = false }) => (
    <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full">
      <div className="relative w-48 h-48 md:w-80 md:h-80 flex items-center justify-center">
        <div className={`absolute inset-0 rounded-full blur-[80px] md:blur-[120px] opacity-20 transition-colors ${roomData.stinkMeter > 50 ? 'bg-red-600' : 'bg-orange-500'}`} />
        <div className={`relative z-10 p-8 md:p-12 bg-slate-800 rounded-full border-8 border-slate-700 shadow-2xl transition-all ${pot.index === 0 && pot.history.length > 0 ? 'border-red-500' : ''}`}>
          <Flame className={`${roomData.stinkMeter > 50 ? 'text-red-500' : 'text-orange-500'} animate-pulse w-24 h-24 md:w-32 md:h-32`} />
          {pot.index === 0 && pot.history.length > 0 && (
             <div className="absolute inset-0 bg-red-600/60 flex items-center justify-center rounded-full animate-in fade-in duration-300">
               <Trash2 className="text-white animate-bounce w-16 h-16 md:w-20 md:h-20" />
             </div>
          )}
        </div>
        <div className={`absolute -top-2 -right-2 md:-top-4 md:-right-4 px-6 md:px-10 py-2 md:py-4 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-xl md:text-4xl shadow-2xl transition-all ${pot.index >= pot.recipe.length ? 'bg-green-500' : 'bg-orange-600'} text-white italic`}>
            {pot.index >= pot.recipe.length ? <CheckCircle className="w-8 h-8 md:w-10 md:h-10" /> : `${pot.index}/${pot.recipe.length}`}
        </div>
      </div>
      <div className="mt-8 md:mt-12 text-center w-full px-4 max-w-[450px]">
        <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic mb-4 truncate text-white drop-shadow-lg">{pot.name}</h3>
        <div className="bg-white text-slate-950 px-8 md:px-12 py-8 md:py-10 rounded-[2.5rem] md:rounded-[3rem] shadow-[0_15px_0_rgb(203,213,225)] min-h-[160px] md:min-h-[180px] flex flex-col justify-center border-4 border-slate-50 relative overflow-hidden">
          {pot.index >= pot.recipe.length ? (
              <div className="space-y-2 animate-in zoom-in">
                 <h2 className="text-4xl md:text-6xl font-black text-green-600 uppercase italic leading-none">ORDER READY!</h2>
                 <p className="text-slate-400 font-bold uppercase text-[10px] md:text-xs">Waiting for kitchen clear...</p>
              </div>
          ) : blurred ? (
             <div className="flex gap-4 md:gap-6 justify-center">
               {Array.from({length: 3}).map((_, i) => <Zap key={i} className="text-slate-200 animate-pulse w-10 h-10 md:w-14 md:h-14" />)}
             </div>
          ) : (
            <>
                <p className="text-[10px] md:text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] mb-3">Kitchen Needs:</p>
                <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none">{pot.recipe[pot.index]}</h2>
                {pot.recipe[pot.index+1] && (
                    <div className="mt-4 md:mt-6 flex items-center justify-center gap-3 border-t border-slate-100 pt-4 md:pt-5">
                        <span className="text-slate-300 text-[10px] font-black uppercase tracking-widest leading-none">UP NEXT:</span>
                        <span className="text-slate-600 font-black uppercase text-base md:text-lg leading-none italic">{pot.recipe[pot.index+1]}</span>
                    </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // --- Views ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 italic overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 rotate-12"><ChefHat size={200} /></div>
            <div className="absolute bottom-1/4 right-1/4 -rotate-12"><Utensils size={200} /></div>
        </div>
        <div className="bg-white p-8 md:p-12 rounded-[3rem] md:rounded-[4rem] shadow-2xl w-full max-w-2xl border-b-[20px] border-slate-200 relative z-10 transition-all">
           <div className="flex flex-col items-center mb-10 md:mb-12">
             <div className="bg-orange-500 p-8 rounded-[3rem] shadow-[0_15px_0_rgb(194,65,12)] mb-8 transform hover:scale-105 transition-transform">
               <Utensils size={70} className="text-white" />
             </div>
             <h1 className="text-6xl md:text-8xl font-black text-slate-950 tracking-tighter text-center leading-none italic">STIR THE POT</h1>
             <p className="text-slate-400 font-black uppercase tracking-[0.5em] text-[11px] md:text-sm mt-4 text-center">Gourmet Sabotage Simulator</p>
           </div>
           
           <div className="space-y-8">
             <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-4 italic">Chef Identity</label>
                <input className="w-full p-6 bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] font-black text-3xl md:text-4xl focus:border-orange-500 outline-none uppercase placeholder:text-slate-200 text-center" placeholder="Gordon" value={playerName} onChange={e => setPlayerName(e.target.value.toUpperCase())} />
             </div>
             
             <div className="grid grid-cols-1 gap-6">
                <div className="bg-slate-100 p-8 rounded-[3.5rem] space-y-6 border-4 border-slate-100 shadow-inner">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center block italic">Room Code</label>
                        <input className="w-full p-6 bg-white border-4 border-slate-200 rounded-[2rem] font-black text-5xl md:text-7xl text-center uppercase tracking-[0.5em] focus:border-orange-500 outline-none shadow-sm" placeholder="----" maxLength={4} value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} />
                    </div>
                    <button onClick={handleJoinRoom} className="w-full py-8 md:py-10 bg-orange-500 text-white font-black text-4xl md:text-5xl rounded-[2.5rem] shadow-[0_15px_0_rgb(194,65,12)] active:shadow-none active:translate-y-2 transition-all italic tracking-tighter flex items-center justify-center gap-4">
                        <ChevronRight size={48} /> JOIN THE LINE
                    </button>
                </div>
                
                <div className="relative py-4 flex items-center gap-6">
                    <div className="flex-grow border-t-4 border-slate-100 rounded-full opacity-50"></div>
                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] italic whitespace-nowrap">Shift Management</span>
                    <div className="flex-grow border-t-4 border-slate-100 rounded-full opacity-50"></div>
                </div>

                <button onClick={handleCreateRoom} className="w-full py-6 md:py-8 bg-slate-900 text-white font-black text-2xl md:text-4xl rounded-[2.5rem] flex items-center justify-center gap-6 shadow-[0_15px_0_rgb(30,41,59)] active:translate-y-2 active:shadow-none transition-all hover:bg-slate-950 border-4 border-white/5 italic uppercase tracking-tighter">
                    <ChefHat className="text-orange-500 w-8 h-8 md:w-12 md:h-12" /> START THE DINNER RUSH
                </button>
             </div>
           </div>
           {error && (
            <div className="mt-8 p-6 bg-red-50 border-4 border-red-100 rounded-[2.5rem] flex items-center gap-4 animate-in shake">
              <AlertTriangle size={32} className="text-red-500 shrink-0" />
              <p className="text-sm font-black text-red-600 uppercase tracking-tight leading-tight italic">{error}</p>
            </div>
           )}
        </div>
      </div>
    );
  }

  if (view === 'host' && roomData) {
    return (
      <div className={`min-h-screen bg-slate-900 text-white p-6 md:p-12 flex flex-col font-sans italic overflow-hidden transition-all duration-1000 ${roomData.activePower === 'SMOKE' ? 'filter blur-[100px] opacity-20 scale-125' : ''}`}>
        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-around md:justify-between py-12">
            <div className="text-center">
              <span className="bg-orange-500 text-white px-10 md:px-14 py-3 md:py-4 rounded-full font-black uppercase tracking-[0.6em] text-xl md:text-3xl shadow-2xl mb-8 md:mb-12 inline-block italic">DOORS ARE OPEN</span>
              <h2 className="text-[12rem] md:text-[24rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_40px_80px_rgba(255,255,255,0.15)] italic uppercase">{roomCode}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-12 w-full max-w-full px-8 md:px-24">
              {Object.values(roomData.players).map(p => (
                <div key={p.id} className="bg-white/5 backdrop-blur-3xl p-8 md:p-14 rounded-[3.5rem] md:rounded-[4.5rem] border-4 border-white/10 flex flex-col items-center gap-6 md:gap-10 animate-in zoom-in shadow-3xl transform hover:rotate-3 transition-transform">
                  <div className="w-24 h-24 md:w-40 md:h-40 rounded-[2.5rem] md:rounded-[3rem] bg-orange-500 flex items-center justify-center text-6xl md:text-8xl font-black shadow-[0_15px_0_rgb(194,65,12)] italic text-white leading-none">{p.name[0]}</div>
                  <span className="font-black text-2xl md:text-5xl truncate w-full text-center tracking-tighter italic uppercase text-white/90 leading-tight">{p.name}</span>
                </div>
              ))}
            </div>
            <button onClick={startRound} disabled={Object.keys(roomData.players).length < 3} className="bg-white text-slate-950 px-32 md:px-64 py-10 md:py-20 rounded-full font-black text-5xl md:text-[8rem] shadow-[0_25px_0_rgb(203,213,225)] active:translate-y-5 active:shadow-none transition-all flex items-center gap-10 md:gap-20 italic uppercase tracking-tighter group hover:bg-orange-500 hover:text-white mt-16 border-t-8 border-white">
              <Play size={100} className="group-hover:scale-125 transition-transform fill-current" /> {roomData.round === 0 ? 'START' : 'NEXT'}
            </button>
          </div>
        )}

        {(roomData.state === 'ROUND1' || roomData.state === 'ROUND2' || roomData.state === 'ROUND3') && (
           <div className="flex-1 flex flex-col gap-8 md:gap-16 max-w-full mx-auto w-full animate-in fade-in duration-500 h-full">
              <div className="flex flex-col md:flex-row justify-between items-center md:items-end px-8 md:px-24 gap-12">
                 <div className="space-y-6 text-center md:text-left">
                    <span className="text-orange-500 font-black uppercase tracking-[0.6em] text-2xl md:text-3xl italic block animate-pulse">LIVE SHIFT #{roomData.round}</span>
                    <h2 className="text-7xl md:text-[12rem] font-black uppercase tracking-tighter leading-none italic drop-shadow-xl">{roomData.state.replace('ROUND', 'SHIFT ')}</h2>
                    <div className={`px-10 py-8 md:px-14 md:py-10 rounded-[3rem] md:rounded-[4rem] border-8 inline-flex items-center gap-8 ${timeLeft < 15 ? 'bg-red-600 border-red-800 animate-pulse' : 'bg-white/5 border-white/10 shadow-3xl'}`}>
                        <Clock className="w-12 h-12 md:w-20 md:h-20" />
                        <span className="text-7xl md:text-[10rem] font-black tabular-nums tracking-tighter italic leading-none">{timeLeft}s</span>
                    </div>
                 </div>
                 <div className="flex flex-col items-center md:items-end gap-6 md:gap-8 bg-white/5 p-10 md:p-14 rounded-[4rem] md:rounded-[5rem] border-4 border-white/10 shadow-3xl w-full md:w-auto">
                    <div className="flex items-center gap-8">
                        <Skull className={`${roomData.stinkMeter > 50 ? 'text-red-500 animate-pulse' : 'text-white/10'} w-14 h-14 md:w-24 md:h-24`} />
                        <span className="text-6xl md:text-[9rem] font-black italic tracking-tighter tabular-nums text-white/40 leading-none">{roomData.stinkMeter}% STINK</span>
                    </div>
                    <div className="w-full md:w-[600px] h-12 md:h-16 bg-black/50 rounded-full overflow-hidden p-2.5 border-4 border-white/5 shadow-inner">
                      <div className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-600 rounded-full transition-all duration-1000 shadow-[0_0_40px_rgba(220,38,38,0.5)]" style={{width: `${roomData.stinkMeter}%`}} />
                    </div>
                 </div>
              </div>

              <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 px-8 md:px-24">
                 {Object.values(roomData.pots).map(p => (
                     <PotVisual key={p.name} pot={p} blurred={roomData.state === 'ROUND3'} />
                 ))}
              </div>

              <div className="bg-[#fcfcfc] p-10 md:p-14 rounded-[4rem] md:rounded-[6rem] flex gap-8 md:gap-14 items-center border-b-[30px] md:border-b-[40px] border-slate-300 shadow-3xl relative mx-8 md:mx-24 min-h-[160px] md:min-h-[220px] overflow-hidden">
                 <div className="shrink-0 font-black text-slate-300 uppercase tracking-[1em] text-xs md:text-sm transform -rotate-90 italic">Black Box Log</div>
                 <div className="flex gap-8 md:gap-12 items-center w-full overflow-x-auto pb-6 custom-scrollbar px-6">
                    {Object.values(roomData.pots).flatMap(p => p.history).slice(-15).reverse().map((ing, i) => <ReceiptCard key={i} ing={ing} />)}
                 </div>
              </div>
           </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-16 md:space-y-24 animate-in zoom-in h-full py-12">
             <div className="bg-red-600 p-16 md:p-20 rounded-full shadow-[0_0_250px_rgba(239,68,68,1)] animate-pulse border-[15px] border-red-500">
                <Skull className="text-white w-56 h-56 md:w-80 md:h-80" />
             </div>
             <h2 className="text-9xl md:text-[18rem] font-black italic tracking-tighter leading-none text-white underline decoration-red-600 decoration-[15px] md:decoration-[30px] underline-offset-[30px] md:underline-offset-[60px] text-center uppercase">CRITICAL FAILURE</h2>
             <div className="bg-white p-14 md:p-32 rounded-[5rem] md:rounded-[8rem] text-slate-950 w-full max-w-full md:max-w-[1400px] shadow-[0_50px_100px_rgba(0,0,0,0.4)] relative border-b-[35px] md:border-b-[60px] border-slate-400 flex flex-col items-center overflow-hidden">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-20 md:px-32 py-8 md:py-14 rounded-[2rem] md:rounded-[4rem] font-black uppercase tracking-widest text-4xl md:text-7xl italic shadow-3xl whitespace-nowrap border-b-8 border-red-900">EVIDENCE TRACE</div>
                <div className="flex gap-10 md:gap-16 items-center overflow-x-auto w-full py-10 px-12 justify-center">
                    {Object.values(roomData.pots).flatMap(p => p.history).slice(-6).map((ing, i) => <ReceiptCard key={i} ing={ing} />)}
                </div>
             </div>
             <p className="text-5xl md:text-9xl text-white/30 font-black animate-bounce uppercase italic tracking-widest text-center px-12">IDENTIFY THE TRAITOR ON YOUR PHONE!</p>
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL') && (
           <div className="flex-1 flex flex-col items-center justify-center text-center gap-16 md:gap-32 animate-in zoom-in px-8 md:px-32">
              <h2 className="text-8xl md:text-[20rem] font-black italic tracking-tighter leading-none uppercase text-white drop-shadow-[0_60px_60px_rgba(0,0,0,0.6)]">
                 {roomData.state === 'ROUND_END' ? 'ORDERS READY!' : roomData.voteWinner === 'SABOTEUR' ? 'TERMINATED!' : 'MISFIRE!'}
              </h2>
              <div className="text-5xl md:text-[10rem] bg-orange-600 px-16 md:px-48 py-14 md:py-24 rounded-[4rem] md:rounded-[7rem] shadow-[0_25px_0_rgb(194,65,12)] md:shadow-[0_60px_0_rgb(194,65,12)] transform -rotate-1 font-black text-white italic tracking-tight flex items-center gap-12 md:gap-20 border-t-8 border-white/20">
                 <Utensils size={120} className="md:w-32 md:h-32" />
                 {roomData.state === 'ROUND_END' ? '5-STAR SERVICE ACHIEVED!' : `THE MOLE WAS ${Object.values(roomData.players).find(p => p.role === 'SABOTEUR')?.name}!`}
              </div>
              <button onClick={startRound} className="bg-white text-slate-950 px-32 md:px-72 py-12 md:py-24 rounded-full font-black text-6xl md:text-[9rem] hover:bg-orange-500 hover:text-white transition-all transform hover:scale-110 shadow-[0_40px_0_rgb(203,213,225)] active:translate-y-6 italic uppercase tracking-tighter border-b-[20px] border-slate-200">
                  {roomData.round >= 3 ? 'FINISH SHIFT' : 'NEXT TICKET'}
              </button>
           </div>
        )}

        {roomData.state === 'GAME_OVER' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-12 md:gap-32 animate-in fade-in py-16">
                <Trophy className="text-yellow-400 animate-bounce drop-shadow-[0_50px_100px_rgba(250,204,21,0.5)] w-56 h-56 md:w-[500px] md:h-[500px]" />
                <h2 className="text-8xl md:text-[18rem] font-black italic tracking-tighter text-white uppercase leading-none px-12 text-center drop-shadow-2xl">RESTAURANT RATING</h2>
                <div className="grid grid-cols-1 gap-12 w-full max-w-7xl px-12">
                    {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, i) => (
                        <div key={p.id} className="bg-white/10 p-12 md:p-24 rounded-[5rem] flex justify-between items-center border-8 border-white/10 shadow-3xl transform transition hover:scale-105">
                            <div className="flex items-center gap-12 md:gap-24">
                                <span className="text-9xl font-black text-white/20 italic leading-none">#{i+1}</span>
                                <span className="text-6xl md:text-[10rem] font-black uppercase tracking-tighter italic text-white leading-none">{p.name}</span>
                            </div>
                            <span className="text-9xl md:text-[14rem] font-black text-orange-400 tabular-nums italic tracking-tighter leading-none">{p.score}</span>
                        </div>
                    ))}
                </div>
                <button onClick={() => window.location.reload()} className="bg-orange-500 px-32 py-16 rounded-full font-black text-6xl md:text-9xl text-white shadow-[0_30px_0_rgb(194,65,12)] transform transition hover:scale-110 active:translate-y-5 uppercase tracking-widest italic mt-20 border-8 border-orange-400">NEW CAREER</button>
            </div>
        )}
      </div>
    );
  }

  if (view === 'player' && roomData) {
    const me = roomData.players[user.uid];
    if (!me) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black italic text-4xl animate-pulse uppercase px-12 text-center">Identifying Chef...</div>;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col p-4 md:p-12 font-sans italic select-none transition-all">
        <div className="flex justify-between items-center mb-8 bg-white p-6 md:p-12 rounded-[3rem] md:rounded-[4rem] shadow-xl border-b-[10px] border-slate-200">
           <div className="flex items-center gap-4 md:gap-10 text-slate-950">
              <div className={`p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-inner border-b-[6px] ${me.role === 'SABOTEUR' ? 'bg-red-600 text-white border-red-800' : 'bg-orange-500 text-white border-orange-700'}`}>
                 {me.role === 'SABOTEUR' ? <Skull className="w-10 h-10 md:w-20 md:h-20" /> : <ChefHat className="w-10 h-10 md:w-20 md:h-20" />}
              </div>
              <div>
                <h3 className="font-black text-3xl md:text-7xl leading-none tracking-tight uppercase truncate max-w-[150px] md:max-w-none">{me.name}</h3>
                <span className="text-[12px] md:text-2xl font-black uppercase text-slate-300 tracking-[0.4em] italic">{me.role}</span>
              </div>
           </div>
           <div className="text-6xl md:text-[10rem] font-black text-slate-950 tabular-nums tracking-tighter italic leading-none">{me.score}</div>
        </div>

        {roomData.state === 'LOBBY' && (
           <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-[4rem] md:rounded-[6rem] border-b-[20px] md:border-b-[30px] border-slate-200 shadow-3xl transition-all">
              <Coffee className="text-orange-500 animate-bounce mb-12 md:mb-20 w-32 h-32 md:w-64 md:h-64" />
              <h2 className="text-6xl md:text-[10rem] font-black text-slate-950 tracking-tighter mb-6 md:mb-10 uppercase text-center leading-none italic">BREAK <br/> ROOM</h2>
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm md:text-3xl text-center px-10 md:px-32 leading-relaxed">Relaxing until Management triggers the shift alarm...</p>
           </div>
        )}

        {(roomData.state === 'ROUND1' || roomData.state === 'ROUND3') && (
           <div className="flex-1 flex flex-col gap-6 md:gap-12 h-full">
              {roomData.headChefId === user.uid && (
                 <div className="bg-orange-500 p-8 md:p-14 rounded-[3rem] md:rounded-[5rem] text-white shadow-3xl border-b-[15px] md:border-b-[25px] border-orange-800 animate-in slide-in-from-top overflow-hidden">
                   <p className="text-xs md:text-3xl font-black uppercase tracking-[0.4em] italic mb-6 opacity-90 flex items-center gap-4"><ChefHat className="w-8 h-8 md:w-16 md:h-16"/> HEAD CHEF: SHOUT THE TICKET!</p>
                   <div className="flex flex-wrap gap-4 md:gap-8 max-h-[160px] md:max-h-none overflow-y-auto custom-scrollbar pr-4">
                     {Object.values(roomData.pots)[0].recipe.map((cat, i) => (
                       <span key={i} className={`px-6 md:px-10 py-3 md:py-6 rounded-[1.5rem] md:rounded-[3rem] font-black text-2xl md:text-7xl uppercase tracking-tighter transition-all ${i === Object.values(roomData.pots)[0].index ? 'bg-white text-orange-600 scale-110 shadow-2xl rotate-1' : 'opacity-30'}`}>{cat}</span>
                     ))}
                   </div>
                 </div>
              )}
              <div className="bg-slate-950 p-10 md:p-20 rounded-[4rem] md:rounded-[6rem] text-white shadow-3xl relative overflow-hidden border-b-[15px] md:border-b-[30px] border-black">
                 <div className="flex items-center gap-4 mb-4 opacity-50">
                     <Utensils className="text-orange-500 w-6 h-6 md:w-14 md:h-14" />
                     <p className="text-sm md:text-4xl font-black text-white uppercase tracking-widest italic">Station Requirement:</p>
                 </div>
                 <h2 className="text-7xl md:text-[14rem] font-black uppercase tracking-tighter leading-none italic mb-8 text-white drop-shadow-2xl">
                   {roomData.state === 'ROUND3' ? '???' : Object.values(roomData.pots)[0].recipe[Object.values(roomData.pots)[0].index] || 'DONE'}
                 </h2>
                 <p className="text-orange-500 text-xl md:text-5xl font-black uppercase tracking-[0.4em] italic drop-shadow-lg truncate">{Object.values(roomData.pots)[0].name}</p>
              </div>
              <div className="grid grid-cols-2 gap-6 md:gap-12 flex-1 overflow-y-auto pb-10 px-2 custom-scrollbar">
                 {me.hand.map((card, i) => (
                    <button key={i} onClick={() => playCard(i, Object.keys(roomData.pots)[0])} className={`relative p-8 md:p-14 rounded-[3rem] md:rounded-[5rem] border-b-[15px] md:border-b-[30px] text-left min-h-[160px] md:min-h-[250px] flex flex-col justify-between active:scale-95 active:translate-y-6 transition-all shadow-3xl group ${me.role === 'SABOTEUR' ? 'bg-slate-900 border-black text-white' : 'bg-white border-slate-200 text-slate-950'}`}>
                      <span className={`text-sm md:text-3xl font-black uppercase italic ${me.role === 'SABOTEUR' ? 'text-red-500' : 'text-orange-500'}`}>{card.category}</span>
                      <span className="font-black text-3xl md:text-7xl leading-[1.1] uppercase tracking-tighter italic pr-8 break-words">{card.name}</span>
                      {me.role === 'SABOTEUR' && <Skull className="absolute bottom-10 right-10 opacity-10 group-hover:opacity-40 transition-opacity w-10 h-10 md:w-24 md:h-24" />}
                    </button>
                 ))}
              </div>
           </div>
        )}

        {roomData.state === 'ROUND2' && (
           <div className="flex-1 flex flex-col gap-6 animate-in slide-in-from-right h-full">
              {!selectedStation ? (
                 <div className="flex-1 flex flex-col gap-8 md:gap-16 items-center justify-center p-4">
                   <h2 className="text-7xl md:text-[10rem] font-black text-center mb-12 md:mb-24 uppercase tracking-tighter italic text-slate-950 leading-none">STATION <br/> SELECT</h2>
                   <div className="w-full flex flex-col gap-6 md:gap-12 px-6">
                        <button onClick={() => setSelectedStation('soup')} className="w-full py-12 md:py-24 bg-white border-b-[20px] md:border-b-[35px] border-blue-200 rounded-[4rem] md:rounded-[6rem] font-black text-5xl md:text-9xl shadow-3xl flex items-center justify-center gap-12 text-blue-600 active:translate-y-6 transition-all uppercase tracking-tighter italic shadow-blue-100 hover:scale-[1.02]"><Wind className="w-16 h-16 md:w-32 md:h-32" /> SOUP</button>
                        <button onClick={() => setSelectedStation('steak')} className="w-full py-12 md:py-24 bg-white border-b-[20px] md:border-b-[35px] border-red-200 rounded-[4rem] md:rounded-[6rem] font-black text-5xl md:text-9xl shadow-3xl flex items-center justify-center gap-12 text-red-600 active:translate-y-6 transition-all uppercase tracking-tighter italic shadow-red-100 hover:scale-[1.02]"><Flame className="w-16 h-16 md:w-32 md:h-32" /> STEAK</button>
                        <button onClick={() => setSelectedStation('cake')} className="w-full py-12 md:py-24 bg-white border-b-[20px] md:border-b-[35px] border-pink-200 rounded-[4rem] md:rounded-[6rem] font-black text-5xl md:text-9xl shadow-3xl flex items-center justify-center gap-12 text-pink-600 active:translate-y-6 transition-all uppercase tracking-tighter italic shadow-pink-100 hover:scale-[1.02]"><ShoppingBasket className="w-16 h-16 md:w-32 md:h-32" /> CAKE</button>
                   </div>
                 </div>
              ) : (
                <div className="flex-1 flex flex-col animate-in zoom-in duration-300 h-full overflow-hidden">
                  <div className="flex justify-between items-center mb-8 md:mb-14">
                    <button onClick={() => setSelectedStation(null)} className="font-black text-orange-600 bg-white px-10 md:px-14 py-4 md:py-8 rounded-full shadow-2xl border-b-8 border-orange-100 flex items-center gap-4 uppercase italic text-xs md:text-4xl active:translate-y-2 transition-all"> <RotateCcw className="rotate-180 w-6 h-6 md:w-14 md:h-14" /> EXIT</button>
                    <div className="bg-slate-950 text-white px-10 md:px-16 py-4 md:py-8 rounded-full font-black italic tracking-widest text-lg md:text-5xl uppercase shadow-3xl border-b-8 border-black">{selectedStation} <span className="text-orange-500 ml-6 md:ml-12">{roomData.pots[selectedStation].index}/{roomData.pots[selectedStation].recipe.length}</span></div>
                  </div>
                  <div className="bg-slate-950 p-12 md:p-24 rounded-[4rem] md:rounded-[6rem] text-white border-b-[20px] md:border-b-[40px] border-black shadow-4xl mb-10 md:mb-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10 rotate-45 scale-150"><Zap size={200} /></div>
                    <p className="text-sm md:text-4xl font-black text-orange-400 uppercase tracking-[0.5em] mb-4 md:mb-10 italic">Ticket Requirements:</p>
                    <h2 className="text-7xl md:text-[15rem] font-black uppercase tracking-tighter leading-none italic text-white drop-shadow-2xl">{roomData.pots[selectedStation].recipe[roomData.pots[selectedStation].index] || 'DONE'}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-8 md:gap-14 flex-1 overflow-y-auto px-2 custom-scrollbar pb-10">
                    {me.hand.map((card, i) => (
                        <button key={i} onClick={() => playCard(i, selectedStation)} className={`relative p-10 md:p-20 rounded-[3.5rem] md:rounded-[5.5rem] border-b-[20px] md:border-b-[35px] text-left min-h-[180px] md:min-h-[300px] flex flex-col justify-between active:scale-95 active:translate-y-6 transition-all shadow-4xl ${me.role === 'SABOTEUR' ? 'bg-slate-900 border-black text-white' : 'bg-white border-slate-200 text-slate-950'}`}>
                          <span className={`text-sm md:text-3xl font-black uppercase italic ${me.role === 'SABOTEUR' ? 'text-red-400' : 'text-orange-500'}`}>{card.category}</span>
                          <span className="font-black text-4xl md:text-[8rem] leading-[1.1] uppercase tracking-tighter italic break-words">{card.name}</span>
                        </button>
                    ))}
                  </div>
                </div>
              )}
           </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col space-y-12 md:space-y-24 pt-10 md:pt-20 animate-in slide-in-from-bottom duration-500 overflow-y-auto px-4 h-full">
             <div className="bg-red-600 p-16 md:p-24 rounded-[5rem] md:rounded-[7rem] text-white text-center shadow-4xl border-b-[25px] md:border-b-[45px] border-red-900 flex flex-col items-center">
               <Skull className="mb-10 md:mb-20 animate-pulse w-32 h-32 md:w-64 md:h-64" />
               <h2 className="text-8xl md:text-[14rem] font-black italic tracking-tighter leading-none uppercase text-white">TERMINATE!</h2>
               <p className="font-black text-red-100 uppercase tracking-[0.5em] text-sm md:text-5xl mt-8 italic opacity-90">EXPOSE THE CONTAMINATED EMPLOYEE</p>
             </div>
             <div className="space-y-6 md:space-y-12 pb-24">
               {Object.values(roomData.players).filter(p => p.id !== user.uid).map(p => (
                 <button key={p.id} onClick={() => handleVote(p.id)} disabled={!!roomData.votes?.[user.uid]} className={`w-full p-12 md:p-24 rounded-[4rem] md:rounded-[6rem] border-b-[20px] md:border-b-[40px] font-black text-5xl md:text-[10rem] transition-all flex items-center justify-between tracking-tighter italic uppercase leading-none ${roomData.votes?.[user.uid] === p.id ? 'bg-red-500 border-red-800 text-white translate-y-6 shadow-none' : 'bg-white border-slate-200 text-slate-950 shadow-4xl active:translate-y-8 transition-transform'}`}>
                   {p.name} {roomData.votes?.[user.uid] === p.id && <CheckCircle className="w-16 h-16 md:w-40 md:h-40" />}
                 </button>
               ))}
             </div>
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL' || roomData.state === 'GAME_OVER') && (
           <div className="flex-1 flex flex-col items-center justify-center p-16 md:p-32 bg-white rounded-[6rem] md:rounded-[10rem] border-b-[30px] md:border-b-[60px] border-slate-200 shadow-4xl text-center animate-in zoom-in duration-500 italic h-full transition-all">
              <div className="bg-orange-100 p-20 md:p-32 rounded-full mb-12 md:mb-24 shadow-inner">
                 <Utensils className="text-orange-500 animate-spin-slow w-48 h-48 md:w-[400px] md:h-[400px]" />
              </div>
              <h2 className="text-8xl md:text-[18rem] font-black text-slate-950 tracking-tighter mb-10 md:mb-20 uppercase leading-none italic drop-shadow-2xl">ORDER UP!</h2>
              <p className="text-slate-400 font-black uppercase tracking-[0.6em] text-sm md:text-5xl text-center px-10 md:px-48 leading-relaxed">Shift records are being audited on the big screen...</p>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white italic p-16 text-center overflow-hidden">
      <div className="relative mb-20 md:mb-32">
        <div className="absolute inset-0 bg-orange-500/20 blur-[100px] md:blur-[180px] animate-pulse" />
        <Flame className="text-orange-500 relative z-10 animate-bounce w-48 h-48 md:w-[400px] md:h-[400px]" />
      </div>
      <span className="font-black uppercase tracking-[1.5em] text-white/30 text-xl md:text-6xl animate-pulse leading-none">PREPPING <br/> THE LINE...</span>
    </div>
  );
}