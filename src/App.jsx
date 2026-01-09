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
  EyeOff,
  Wind,
  Zap,
  Coffee
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

const TAINTED_INGREDIENTS = ["Motor Oil", "Old Gym Sock", "Industrial Sludge", "Expired Milk", "Rusty Nails", "Dish Soap", "Blue Paint", "Lawn Clippings", "Hairball", "Mystery Goo"];
const CATEGORIES = Object.keys(FLAVOR_POOL);

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

  // --- Actions ---

  const handleCreateRoom = async () => {
    if (!auth.currentUser) return;
    setIsBusy(true);
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const state = {
      code,
      state: 'LOBBY',
      round: 0,
      players: {},
      pots: { main: { recipe: [], index: 0, history: [], type: 'MAIN' } },
      stinkMeter: 0,
      activePower: null,
      lastUpdated: Date.now()
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code), state);
      setRoomCode(code);
      setView('host');
    } catch (e) { setError("Kitchen closed: " + e.message); }
    setIsBusy(false);
  };

  const handleJoinRoom = async () => {
    if (!auth.currentUser || !roomCode) return;
    setIsBusy(true);
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode.toUpperCase());
    const snap = await getDoc(roomRef);
    if (!snap.exists()) { setError("Invalid table code."); setIsBusy(false); return; }
    
    await updateDoc(roomRef, {
      [`players.${auth.currentUser.uid}`]: {
        id: auth.currentUser.uid,
        name: playerName || "Mystery Chef",
        score: 0,
        role: 'CHEF',
        hand: []
      }
    });
    setRoomCode(roomCode.toUpperCase());
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
        hand.push(isSab ? { name: getRandomItem(TAINTED_INGREDIENTS), category: cat, type: 'TAINTED' } : { name: getRandomItem(FLAVOR_POOL[cat]), category: cat, type: 'CLEAN' });
      }
      newPlayers[id].hand = hand;
    });

    let pots = {};
    let headChefId = null;

    if (nextRound === 1) {
      pots = { main: { recipe: Array.from({length: 6}, () => getRandomItem(CATEGORIES)), index: 0, history: [] } };
    } else if (nextRound === 2) {
      pots = {
        soup: { name: 'SOUP', recipe: Array.from({length: 4}, () => getRandomItem(CATEGORIES)), index: 0, history: [] },
        steak: { name: 'STEAK', recipe: Array.from({length: 4}, () => getRandomItem(CATEGORIES)), index: 0, history: [] },
        cake: { name: 'CAKE', recipe: Array.from({length: 4}, () => getRandomItem(CATEGORIES)), index: 0, history: [] }
      };
    } else {
      pots = { fusion: { recipe: Array.from({length: 8}, () => getRandomItem(CATEGORIES)), index: 0, history: [] } };
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
      votes: {}
    });
  };

  const playCard = async (cardIndex, potId = 'main') => {
    if (!roomData || isBusy) return;
    setIsBusy(true);
    const me = roomData.players[user.uid];
    const card = me.hand[cardIndex];
    const pot = roomData.pots[potId];
    if (!card || pot.index >= pot.recipe.length) { setIsBusy(false); return; }

    const isCorrect = card.category === pot.recipe[pot.index] && card.type === 'CLEAN';
    const isSabotage = card.type === 'TAINTED';

    let newStink = roomData.stinkMeter;
    let newScore = me.score;
    let nextIndex = pot.index;

    if (isSabotage) {
      newStink += 25;
      newScore += 20;
      nextIndex++;
    } else if (isCorrect) {
      newScore += 10;
      nextIndex++;
    } else {
      newScore -= 15; // Substitution penalty
      nextIndex++;
    }

    const newHand = [...me.hand];
    newHand.splice(cardIndex, 1);
    const newCat = getRandomItem(CATEGORIES);
    newHand.push(me.role === 'SABOTEUR' ? { name: getRandomItem(TAINTED_INGREDIENTS), category: newCat, type: 'TAINTED' } : { name: getRandomItem(FLAVOR_POOL[newCat]), category: newCat, type: 'CLEAN' });

    const updates = {
      [`players.${user.uid}.score`]: newScore,
      [`players.${user.uid}.hand`]: newHand,
      [`pots.${potId}.index`]: nextIndex,
      [`pots.${potId}.history`]: [...pot.history, { ...card, playerName: me.name }],
      stinkMeter: newStink
    };

    if (newStink >= 100) updates.state = 'TASTE_TEST';
    else {
      const allFinished = Object.values(roomData.pots).every(p => (p.index >= p.recipe.length || (p.id === potId && nextIndex >= p.recipe.length)));
      if (allFinished) updates.state = 'ROUND_END';
    }

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
    <div className={`p-4 rounded-xl border-4 ${ing.type === 'TAINTED' ? 'bg-red-50 border-red-500' : 'bg-white border-slate-200'} shrink-0 min-w-[140px] italic shadow-lg transform rotate-1`}>
      <p className="text-[10px] font-black uppercase text-slate-400">{ing.category}</p>
      <p className={`text-xl font-black ${ing.type === 'TAINTED' ? 'text-red-600' : 'text-slate-800'}`}>{ing.name}</p>
    </div>
  );

  const PotVisual = ({ pot, id, blurred = false }) => (
    <div className="flex flex-col items-center">
      <div className={`relative w-64 h-64 flex items-center justify-center`}>
        <div className={`absolute inset-0 rounded-full blur-[100px] opacity-20 ${roomData.stinkMeter > 50 ? 'bg-red-500' : 'bg-orange-500'}`} />
        <div className="relative z-10 p-8 bg-slate-800 rounded-full border-8 border-slate-700 shadow-2xl">
          <Flame size={100} className={`${roomData.stinkMeter > 50 ? 'text-red-500' : 'text-orange-500'} animate-pulse`} />
        </div>
        <div className="absolute -top-4 -right-4 bg-orange-500 text-white px-6 py-2 rounded-2xl font-black text-2xl shadow-xl">{pot.index}/{pot.recipe.length}</div>
      </div>
      <div className="mt-8 text-center">
        <h3 className="text-4xl font-black uppercase tracking-tighter italic mb-2">{pot.name || 'THE POT'}</h3>
        <div className="bg-white text-slate-900 px-10 py-6 rounded-3xl shadow-[0_10px_0_rgb(203,213,225)]">
          {blurred ? (
             <div className="flex gap-2">
               {Array.from({length: 3}).map((_, i) => <Zap key={i} className="text-slate-300 animate-pulse" />)}
             </div>
          ) : (
            <h2 className="text-6xl font-black uppercase tracking-tight">{pot.recipe[pot.index] || 'DONE!'}</h2>
          )}
          {!blurred && pot.recipe[pot.index+1] && (
            <p className="mt-2 text-slate-400 font-bold uppercase text-xs tracking-widest">Next: {pot.recipe[pot.index+1]}</p>
          )}
        </div>
      </div>
    </div>
  );

  // --- Views ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 italic">
        <div className="bg-white p-10 rounded-[3rem] shadow-[0_20px_0_rgba(255,255,255,0.05)] max-w-sm w-full border-b-[16px] border-slate-200">
           <div className="flex flex-col items-center mb-10">
             <div className="bg-orange-500 p-6 rounded-[2.5rem] shadow-[0_12px_0_rgb(194,65,12)] mb-6">
               <Utensils size={60} className="text-white" />
             </div>
             <h1 className="text-6xl font-black text-slate-950 tracking-tighter text-center leading-none">STIR THE POT</h1>
             <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px] mt-2">Chaos in the Kitchen</p>
           </div>
           <div className="space-y-6">
             <input className="w-full p-6 bg-slate-50 border-4 border-slate-100 rounded-[2rem] font-black text-2xl focus:border-orange-500 outline-none" placeholder="Chef Name" value={playerName} onChange={e => setPlayerName(e.target.value.toUpperCase())} />
             <div className="bg-slate-100 p-6 rounded-[2.5rem] space-y-4">
                <input className="w-full p-4 bg-white border-4 border-slate-200 rounded-2xl font-black text-4xl text-center uppercase tracking-[0.4em] focus:border-orange-500 outline-none" placeholder="CODE" maxLength={4} value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} />
                <button onClick={handleJoinRoom} className="w-full py-6 bg-orange-500 text-white font-black text-2xl rounded-3xl shadow-[0_10px_0_rgb(194,65,12)] active:shadow-none active:translate-y-2 transition-all">JOIN SHIFT</button>
             </div>
             <button onClick={handleCreateRoom} className="w-full py-5 bg-slate-950 text-white font-black text-xl rounded-3xl flex items-center justify-center gap-3 shadow-[0_10px_0_rgb(30,41,59)] active:translate-y-2 active:shadow-none transition-all hover:bg-slate-800">
               <Play size={24} className="text-orange-500" /> HOST SERVICE
             </button>
           </div>
        </div>
      </div>
    );
  }

  if (view === 'host' && roomData) {
    return (
      <div className={`min-h-screen bg-slate-900 text-white p-12 flex flex-col font-sans italic overflow-hidden transition-all duration-1000 ${roomData.activePower === 'SMOKE' ? 'filter blur-md opacity-40 scale-105' : ''}`}>
        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-between">
            <div className="text-center animate-bounce-slow">
              <span className="bg-orange-500 text-white px-10 py-3 rounded-full font-black uppercase tracking-[0.5em] text-xl shadow-2xl">Kitchen Door Open</span>
              <h2 className="text-[18rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_30px_60px_rgba(255,255,255,0.1)]">{roomCode}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 w-full max-w-7xl">
              {Object.values(roomData.players).map(p => (
                <div key={p.id} className="bg-white/5 backdrop-blur-xl p-10 rounded-[3rem] border-2 border-white/10 flex flex-col items-center gap-6 animate-in zoom-in">
                  <div className="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center text-5xl font-black shadow-[0_10px_0_rgb(194,65,12)]">{p.name[0]}</div>
                  <span className="font-black text-3xl truncate w-full text-center">{p.name}</span>
                </div>
              ))}
            </div>
            <button onClick={startRound} disabled={Object.keys(roomData.players).length < 3} className="bg-white text-slate-950 px-32 py-12 rounded-full font-black text-6xl shadow-[0_20px_0_rgb(203,213,225)] active:translate-y-3 transition-all flex items-center gap-10">
              <RotateCcw size={60} /> START PREP
            </button>
          </div>
        )}

        {roomData.state === 'ROUND1' && (
           <div className="flex-1 flex flex-col gap-12 max-w-7xl mx-auto w-full">
              <div className="flex justify-between items-center">
                 <div className="bg-orange-500 px-10 py-4 rounded-[2rem] shadow-xl">
                   <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">Morning Prep</h2>
                 </div>
                 <div className="flex items-center gap-6 bg-white/5 px-8 py-4 rounded-3xl border border-white/10">
                    <Skull className={roomData.stinkMeter > 50 ? 'text-red-500' : 'text-white/20'} />
                    <div className="w-64 h-6 bg-black/40 rounded-full overflow-hidden p-1">
                      <div className="h-full bg-red-600 transition-all duration-1000" style={{width: `${roomData.stinkMeter}%`}} />
                    </div>
                 </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                 <PotVisual pot={roomData.pots.main} />
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] flex gap-6 overflow-hidden border-b-[12px] border-slate-200">
                 <div className="shrink-0 font-black text-slate-300 uppercase tracking-[0.4em] text-xs transform -rotate-90 flex items-center">Receipt Log</div>
                 {roomData.pots.main.history.slice(-10).reverse().map((ing, i) => <ReceiptCard key={i} ing={ing} />)}
              </div>
           </div>
        )}

        {roomData.state === 'ROUND2' && (
          <div className="flex-1 flex flex-col gap-12 w-full">
             <h2 className="text-7xl font-black uppercase text-center tracking-tighter">Dinner Rush: Three Station Chaos!</h2>
             <div className="grid grid-cols-3 gap-12 flex-1 items-center">
                <PotVisual pot={roomData.pots.soup} />
                <PotVisual pot={roomData.pots.steak} />
                <PotVisual pot={roomData.pots.cake} />
             </div>
             <div className="bg-red-500/10 p-8 rounded-[3rem] border-4 border-red-500/20 flex items-center gap-8 justify-center">
                <AlertTriangle size={48} className="text-red-500 animate-pulse" />
                <span className="text-5xl font-black tracking-widest">CONTAMINATION: {roomData.stinkMeter}%</span>
             </div>
          </div>
        )}

        {roomData.state === 'ROUND3' && (
           <div className="flex-1 flex flex-col items-center justify-center gap-12">
              <div className="text-center">
                <h2 className="text-8xl font-black uppercase italic tracking-tighter mb-4">Fusion Finale</h2>
                <div className="bg-slate-800 p-8 rounded-full inline-block border-8 border-slate-700 animate-spin-slow">
                  <ChefHat size={100} className="text-orange-500" />
                </div>
                <p className="text-4xl text-white/40 font-bold uppercase tracking-[0.4em] mt-8">Recipe is Blurred: Trust the Head Chef</p>
              </div>
              <PotVisual pot={roomData.pots.fusion} blurred={true} />
           </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12">
             <Skull size={150} className="text-red-500 animate-pulse" />
             <h2 className="text-[12rem] font-black italic tracking-tighter leading-none text-white underline decoration-red-600">HEALTH INSPECTION!</h2>
             <div className="bg-white p-12 rounded-[4rem] text-slate-900 w-full max-w-6xl shadow-2xl relative border-b-[20px] border-slate-200 flex gap-8 items-center">
                <span className="font-black text-slate-300 uppercase tracking-[0.5em] text-xl transform -rotate-90">Evidence</span>
                {Object.values(roomData.pots).flatMap(p => p.history).slice(-5).map((ing, i) => <ReceiptCard key={i} ing={ing} />)}
             </div>
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL') && (
           <div className="flex-1 flex flex-col items-center justify-center text-center gap-12 animate-in zoom-in">
              <h2 className="text-[14rem] font-black italic tracking-tighter leading-none">
                 {roomData.state === 'ROUND_END' ? 'ORDER READY!' : roomData.voteWinner === 'SABOTEUR' ? 'CAUGHT!' : 'TERMINATED!'}
              </h2>
              <div className="text-5xl bg-orange-500 px-20 py-12 rounded-[3.5rem] shadow-[0_20px_0_rgb(194,65,12)] transform rotate-2 font-black">
                 {roomData.state === 'ROUND_END' ? '5 STAR SERVICE MAINTAINED!' : `THE MOLE WAS ${Object.values(roomData.players).find(p => p.role === 'SABOTEUR')?.name}!`}
              </div>
              <button onClick={startRound} className="bg-white text-slate-950 px-24 py-10 rounded-full font-black text-5xl hover:bg-orange-500 hover:text-white transition-all transform hover:scale-110">NEXT ROUND</button>
           </div>
        )}
      </div>
    );
  }

  if (view === 'player' && roomData) {
    const me = roomData.players[user.uid];
    if (!me) return <div className="p-10 text-center font-black italic text-3xl animate-pulse">RECLOCKING IN...</div>;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans italic select-none overflow-hidden">
        <div className="flex justify-between items-center mb-6 bg-white p-6 rounded-[2.5rem] shadow-sm border-b-8 border-slate-200">
           <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${me.role === 'SABOTEUR' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                 {me.role === 'SABOTEUR' ? <Skull size={32} /> : <ChefHat size={32} />}
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-2xl leading-none">{me.name}</h3>
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{me.role === 'SABOTEUR' ? 'Saboteur' : 'Chef'}</span>
              </div>
           </div>
           <div className="text-4xl font-black text-slate-950 tabular-nums">{me.score}</div>
        </div>

        {roomData.state === 'LOBBY' && (
           <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-[4rem] border-b-[16px] border-slate-200 shadow-2xl">
              <Coffee size={100} className="text-orange-500 animate-bounce mb-8" />
              <h2 className="text-5xl font-black text-slate-950 tracking-tighter mb-4">BREAK ROOM</h2>
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm text-center">Wait for Head Chef to open the kitchen...</p>
           </div>
        )}

        {(roomData.state === 'ROUND1' || roomData.state === 'ROUND3') && (
           <div className="flex-1 flex flex-col">
              {roomData.headChefId === user.uid && (
                 <div className="mb-6 bg-orange-500 p-8 rounded-[3rem] text-white shadow-xl border-b-[12px] border-orange-700">
                   <p className="text-xs font-black uppercase tracking-widest mb-2 italic">Head Chef: Shout the ingredients!</p>
                   <h2 className="text-4xl font-black uppercase tracking-tighter">
                     {Object.values(roomData.pots)[0].recipe.map((cat, i) => (
                       <span key={i} className={i === Object.values(roomData.pots)[0].index ? 'underline' : 'opacity-30'}>{cat} </span>
                     ))}
                   </h2>
                 </div>
              )}
              <div className="mb-6 bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border-b-[12px] border-slate-950">
                 <p className="text-[11px] font-black text-orange-400 uppercase tracking-widest mb-2 italic">Station Required:</p>
                 <h2 className="text-6xl font-black uppercase tracking-tighter leading-none">
                   {roomData.state === 'ROUND3' ? '???' : Object.values(roomData.pots)[0].recipe[Object.values(roomData.pots)[0].index] || 'DONE'}
                 </h2>
              </div>
              <div className="grid grid-cols-2 gap-5 flex-1">
                 {me.hand.map((card, i) => (
                    <button key={i} onClick={() => playCard(i, Object.keys(roomData.pots)[0])} className={`relative p-6 rounded-[2.5rem] border-b-[12px] text-left h-full flex flex-col justify-between active:scale-95 active:translate-y-3 transition-all shadow-xl ${me.role === 'SABOTEUR' ? 'bg-slate-800 border-slate-950 text-white shadow-slate-950/20' : 'bg-white border-slate-200 text-slate-950'}`}>
                      <span className={`text-[11px] font-black uppercase ${me.role === 'SABOTEUR' ? 'text-red-400' : 'text-orange-500'}`}>{card.category}</span>
                      <span className="font-black text-2xl leading-[1.1] uppercase tracking-tighter">{card.name}</span>
                    </button>
                 ))}
              </div>
           </div>
        )}

        {roomData.state === 'ROUND2' && (
           <div className="flex-1 flex flex-col">
              {!selectedStation ? (
                 <div className="flex-1 flex flex-col gap-6 items-center justify-center p-8">
                   <h2 className="text-5xl font-black text-center mb-8 uppercase tracking-tighter">Choose Station</h2>
                   <button onClick={() => setSelectedStation('soup')} className="w-full py-10 bg-white border-b-[12px] border-slate-200 rounded-[3rem] font-black text-4xl shadow-xl flex items-center justify-center gap-6"><Wind size={40} className="text-orange-500" /> SOUP</button>
                   <button onClick={() => setSelectedStation('steak')} className="w-full py-10 bg-white border-b-[12px] border-slate-200 rounded-[3rem] font-black text-4xl shadow-xl flex items-center justify-center gap-6"><Flame size={40} className="text-red-500" /> STEAK</button>
                   <button onClick={() => setSelectedStation('cake')} className="w-full py-10 bg-white border-b-[12px] border-slate-200 rounded-[3rem] font-black text-4xl shadow-xl flex items-center justify-center gap-6"><ShoppingBasket size={40} className="text-pink-500" /> CAKE</button>
                 </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setSelectedStation(null)} className="font-black text-orange-500 flex items-center gap-2"> <ChevronRight className="rotate-180" /> EXIT {selectedStation.toUpperCase()}</button>
                    <span className="font-black text-slate-400">{roomData.pots[selectedStation].index}/{roomData.pots[selectedStation].recipe.length}</span>
                  </div>
                  <div className="mb-6 bg-slate-900 p-8 rounded-[3rem] text-white border-b-[12px] border-slate-950">
                    <p className="text-[11px] font-black text-orange-400 uppercase tracking-widest mb-2 italic">{selectedStation.toUpperCase()} NEEDS:</p>
                    <h2 className="text-6xl font-black uppercase tracking-tighter leading-none">{roomData.pots[selectedStation].recipe[roomData.pots[selectedStation].index] || 'DONE'}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-5 flex-1">
                    {me.hand.map((card, i) => (
                        <button key={i} onClick={() => playCard(i, selectedStation)} className={`relative p-6 rounded-[2.5rem] border-b-[12px] text-left h-full flex flex-col justify-between active:scale-95 active:translate-y-3 transition-all shadow-xl ${me.role === 'SABOTEUR' ? 'bg-slate-800 border-slate-950 text-white' : 'bg-white border-slate-200 text-slate-950'}`}>
                          <span className={`text-[11px] font-black uppercase ${me.role === 'SABOTEUR' ? 'text-red-400' : 'text-orange-500'}`}>{card.category}</span>
                          <span className="font-black text-2xl leading-[1.1] uppercase tracking-tighter">{card.name}</span>
                        </button>
                    ))}
                  </div>
                </div>
              )}
           </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col space-y-5 pt-4 animate-in slide-in-from-bottom">
             <div className="bg-red-600 p-10 rounded-[3rem] text-white text-center shadow-2xl mb-6 border-b-[12px] border-red-800">
               <Skull size={56} className="mx-auto mb-4" />
               <h2 className="text-5xl font-black italic tracking-tighter leading-none">EXPOSE THE MOLE!</h2>
             </div>
             <div className="space-y-4">
               {Object.values(roomData.players).filter(p => p.id !== user.uid).map(p => (
                 <button key={p.id} onClick={() => handleVote(p.id)} disabled={!!roomData.votes?.[user.uid]} className={`w-full p-8 rounded-[2rem] border-b-[10px] font-black text-3xl transition-all flex items-center justify-between tracking-tighter ${roomData.votes?.[user.uid] === p.id ? 'bg-red-500 border-red-700 text-white shadow-none' : 'bg-white border-slate-200 text-slate-900 shadow-xl'}`}>
                   {p.name} {roomData.votes?.[user.uid] === p.id && <CheckCircle size={36} />}
                 </button>
               ))}
             </div>
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL') && (
           <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-[4rem] border-b-[16px] border-slate-200 shadow-2xl">
              <RotateCcw size={80} className="text-orange-500 animate-spin-slow mb-8" />
              <h2 className="text-5xl font-black text-slate-950 tracking-tighter mb-4 uppercase">SHIFT OVER</h2>
              <p className="text-slate-400 font-black uppercase tracking-widest text-center text-xs">Cleaning the counters for the next round...</p>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white italic">
      <div className="relative mb-10">
        <div className="absolute inset-0 bg-orange-500/20 blur-[60px] animate-pulse" />
        <Flame size={120} className="text-orange-500 relative z-10 animate-bounce" />
      </div>
      <span className="font-black uppercase tracking-[0.5em] text-white/30 text-xs">Washing the Pots...</span>
    </div>
  );
}