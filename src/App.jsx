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

const rawAppId = typeof __firebase_config === 'undefined' 
  ? 'stir-the-pot-game' 
  : (typeof __app_id !== 'undefined' ? __app_id : 'stir-the-pot-game');

const appId = rawAppId.replace(/\//g, '_');

// --- Game Data ---
const FLAVOR_POOL = {
  Sweet: ["Honey", "Maple Syrup", "Sugar", "Vanilla Bean", "Cocoa Powder", "Date Syrup", "Agave", "Cinnamon", "Strawberry", "Peach"],
  Savory: ["Garlic", "Onion", "Rosemary", "Thyme", "Beef Stock", "Mushrooms", "Black Pepper", "Truffle Oil", "Cumin", "Paprika"],
  Spicy: ["Chili Flakes", "Jalapeño", "Sriracha", "Wasabi", "Habanero", "Ginger", "Cayenne", "Black Mustard Seed", "Horseradish", "Chipotle"],
  Sour: ["Lemon Juice", "Lime Zest", "Vinegar", "Green Apple", "Yogurt", "Tamarind", "Pickle Brine", "Kalamansi", "Sumac", "Kimchi Juice"],
  Umami: ["Soy Sauce", "Miso Paste", "Worcestershire Sauce", "Nutritional Yeast", "Dried Seaweed", "Parmesan", "Anchovies", "Tomato Paste", "Bonito Flakes", "Fish Sauce"],
  Bitter: ["Dark Chocolate", "Coffee Grounds", "Kale", "Grapefruit Peel", "Turmeric", "Dandelion Greens", "Matcha", "Beer", "Radicchio", "Cranberry"]
};

const TAINTED_INGREDIENTS = [
  "Motor Oil", "Old Gym Sock", "High Fructose Corn Syrup", "Industrial Sludge", 
  "Expired Milk", "Rusty Nails", "Dish Soap", "Blue Paint", "Lawn Clippings", 
  "Moldy Bread", "Hairball", "Mystery Goo", "Laundry Detergent", "Pesticide"
];

const CATEGORIES = Object.keys(FLAVOR_POOL);

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const getRandomItem = (arr) => arr[arr.length > 0 ? Math.floor(Math.random() * arr.length) : 0];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');
  const [roomCode, setRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [authInited, setAuthInited] = useState(false);
  const [localTimeLeft, setLocalTimeLeft] = useState(0);

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        try { await signInAnonymously(auth); } catch (e) {}
      } finally {
        setAuthInited(true);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Sync Room Data
  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomData(snapshot.data());
      } else if (view !== 'landing') {
        setError("This table has been closed.");
        setView('landing');
      }
    }, (err) => {
      if (err.code === 'permission-denied') {
        setError(`Access Denied: Check rules for path artifacts/${appId}`);
      }
    });
    return () => unsubscribe();
  }, [user, roomCode, view]);

  // Timer Effect (Host Only)
  useEffect(() => {
    if (view === 'host' && roomData?.state === 'ROUND1' && roomData.expiresAt) {
      const timerInterval = setInterval(async () => {
        const now = Date.now();
        const diff = Math.ceil((roomData.expiresAt - now) / 1000);
        setLocalTimeLeft(diff);

        if (diff <= 0) {
          clearInterval(timerInterval);
          // Auto-fail ticket if time is up
          const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
          await updateDoc(roomRef, {
            currentRecipe: Array.from({ length: 5 }, () => getRandomItem(CATEGORIES)),
            recipeIndex: 0,
            expiresAt: Date.now() + 30000,
            stinkMeter: Math.min(100, roomData.stinkMeter + 10)
          });
        }
      }, 1000);
      return () => clearInterval(timerInterval);
    }
  }, [view, roomData?.expiresAt, roomData?.state]);

  const handleCreateRoom = async () => {
    if (!auth.currentUser) return;
    setIsBusy(true);
    const code = generateRoomCode();
    const initialRoomState = {
      code,
      state: 'LOBBY',
      players: {},
      hostId: auth.currentUser.uid,
      currentRecipe: [],
      pot: [],
      stinkMeter: 0,
      round: 0,
      scores: {},
      lastUpdated: Date.now()
    };
    
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
      await setDoc(roomRef, initialRoomState);
      setRoomCode(code);
      setView('host');
      setError('');
    } catch (err) {
      setError(`Permission Error: Rules must allow writes to artifacts/${appId}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinRoom = async (code) => {
    if (!auth.currentUser) return;
    const upperCode = code.trim().toUpperCase();
    if (!upperCode) return;
    setIsBusy(true);

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', upperCode);
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setError("Table not found. Check the code.");
        setIsBusy(false);
        return;
      }
      if (snap.data().state !== 'LOBBY') {
        setError("Dinner service has already started.");
        setIsBusy(false);
        return;
      }
      await updateDoc(roomRef, {
        [`players.${auth.currentUser.uid}`]: {
          id: auth.currentUser.uid,
          name: playerName || `Chef ${Math.floor(Math.random() * 900) + 100}`,
          role: 'CHEF',
          hand: [],
          score: 0,
          joinedAt: Date.now()
        }
      });
      setRoomCode(upperCode);
      setView('player');
      setError('');
    } catch (err) {
      setError(`Join Error: Database access denied.`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartGame = async () => {
    if (!roomData || !auth.currentUser) return;
    const playerIds = Object.keys(roomData.players);
    if (playerIds.length < 3) {
      setError("We need at least 3 chefs!");
      return;
    }
    const shuffledIds = shuffle(playerIds);
    const saboteurId = shuffledIds[0];
    const newPlayers = { ...roomData.players };
    shuffledIds.forEach((id) => {
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
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), {
      state: 'ROUND1',
      players: newPlayers,
      currentRecipe: Array.from({ length: 6 }, () => getRandomItem(CATEGORIES)),
      recipeIndex: 0,
      pot: [],
      stinkMeter: 0,
      round: (roomData.round || 0) + 1,
      votes: {},
      expiresAt: Date.now() + 45000 // 45 seconds for first ticket
    });
  };

  const handlePlayCard = async (cardIndex) => {
    if (!roomData || !auth.currentUser) return;
    const player = roomData.players[auth.currentUser.uid];
    const card = player.hand[cardIndex];
    if (!card) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const newHand = [...player.hand];
    newHand.splice(cardIndex, 1);
    const newCat = getRandomItem(CATEGORIES);
    newHand.push(player.role === 'SABOTEUR'
      ? { name: getRandomItem(TAINTED_INGREDIENTS), category: newCat, type: 'TAINTED' }
      : { name: getRandomItem(FLAVOR_POOL[newCat]), category: newCat, type: 'CLEAN' }
    );

    const targetCategory = roomData.currentRecipe[roomData.recipeIndex];
    let points = 0;
    let newStink = roomData.stinkMeter;
    let nextIndex = roomData.recipeIndex;
    let nextRecipe = [...roomData.currentRecipe];
    let nextExpires = roomData.expiresAt;

    // SCORING LOGIC
    if (card.type === 'TAINTED') {
      newStink += 34; // 3 items = Taste Test
      points = 15; // Saboteurs get points for successful sabotage
      nextIndex += 1;
    } else if (card.category !== targetCategory) {
      // MISTAKE: Trash ticket, move to new one
      points = -25;
      nextRecipe = Array.from({ length: 6 }, () => getRandomItem(CATEGORIES));
      nextIndex = 0;
      nextExpires = Date.now() + 30000; // Fresh timer for new ticket
    } else {
      // SUCCESS
      points = 10;
      nextIndex += 1;
    }

    const updates = {
      [`players.${auth.currentUser.uid}.hand`]: newHand,
      [`players.${auth.currentUser.uid}.score`]: player.score + points,
      pot: [...roomData.pot, { ...card, playedBy: auth.currentUser.uid, playerName: player.name }],
      stinkMeter: newStink,
      recipeIndex: nextIndex,
      currentRecipe: nextRecipe,
      expiresAt: nextExpires
    };

    if (newStink >= 100) {
      updates.state = 'TASTE_TEST';
    } else if (nextIndex >= nextRecipe.length) {
      updates.state = 'ROUND_END';
    }

    await updateDoc(roomRef, updates);
  };

  const handleVote = async (targetId) => {
    if (!roomData || !auth.currentUser || roomData.votes?.[auth.currentUser.uid]) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const currentVotes = { ...(roomData.votes || {}), [auth.currentUser.uid]: targetId };
    await updateDoc(roomRef, { votes: currentVotes });
    const totalPlayers = Object.keys(roomData.players).length;
    if (Object.keys(currentVotes).length >= totalPlayers) {
      const tallies = {};
      Object.values(currentVotes).forEach(v => tallies[v] = (tallies[v] || 0) + 1);
      const sorted = Object.entries(tallies).sort((a,b) => b[1] - a[1]);
      const topVoted = sorted[0][0];
      const saboteur = Object.values(roomData.players).find(p => p.role === 'SABOTEUR');
      
      // Update scores based on reveal
      const finalPlayers = {...roomData.players};
      if (topVoted === saboteur?.id) {
        // Saboteur caught: Penalty
        finalPlayers[saboteur.id].score -= 50;
      } else {
        // Saboteur wins: Points for saboteur
        finalPlayers[saboteur.id].score += 100;
      }

      await updateDoc(roomRef, {
        state: 'VOTE_REVEAL',
        voteWinner: topVoted,
        voteSuccess: topVoted === saboteur?.id,
        players: finalPlayers
      });
    }
  };

  // --- VIEWS ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] max-w-sm w-full border-b-[12px] border-slate-200">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-orange-500 p-5 rounded-[2rem] shadow-[0_10px_0_rgb(194,65,12)] mb-6">
              <Utensils size={52} className="text-white" />
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase text-center leading-none mb-2 italic">STIR THE POT</h1>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Industrial Kitchen Chaos</p>
          </div>
          
          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 italic">Chef Callsign</label>
              <input 
                className="w-full p-5 bg-slate-50 border-4 border-slate-100 rounded-[1.5rem] font-black text-xl focus:border-orange-500 outline-none transition-all placeholder:text-slate-300 italic" 
                placeholder="Gordon R." 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)} 
              />
            </div>
            
            <div className="bg-slate-50 p-6 rounded-[2rem] border-4 border-slate-100 space-y-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 italic text-center block">Table Code</label>
                  <input 
                    className="w-full p-4 bg-white border-4 border-slate-100 rounded-2xl font-black text-3xl uppercase tracking-[0.4em] text-center focus:border-orange-500 outline-none transition-all" 
                    placeholder="----" 
                    maxLength={4} 
                    value={roomCode} 
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())} 
                  />
               </div>
               
               <button 
                  disabled={!authInited || isBusy || !roomCode}
                  onClick={() => handleJoinRoom(roomCode)} 
                  className="w-full py-5 bg-orange-500 text-white font-black rounded-2xl shadow-[0_8px_0_rgb(194,65,12)] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none text-lg italic"
               >
                  {isBusy ? <Loader2 className="animate-spin" /> : <ChevronRight size={24} />} JOIN THE LINE
                </button>
            </div>

            <button 
              disabled={!authInited || isBusy}
              onClick={handleCreateRoom} 
              className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_0_rgb(30,41,59)] active:shadow-none active:translate-y-1 transition-all hover:bg-slate-800 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none text-lg italic"
            >
              {isBusy ? <Loader2 className="animate-spin" /> : <ChefHat size={24} className="text-orange-400" />} OPEN A TABLE
            </button>
          </div>
          
          {error && (
            <div className="mt-8 p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0" />
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight leading-tight">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'host' && roomData) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-12 flex flex-col font-sans">
        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-between">
            <div className="text-center">
              <span className="bg-orange-500 text-white px-8 py-2 rounded-full font-black uppercase tracking-[0.4em] text-sm shadow-xl italic">Table Code</span>
              <h2 className="text-[15rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_20px_50px_rgba(255,255,255,0.1)]">{roomCode}</h2>
            </div>
            <div className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
              {Object.values(roomData.players).map((p) => (
                <div key={p.id} className="bg-white/5 backdrop-blur-md p-10 rounded-[2.5rem] border-2 border-white/5 flex flex-col items-center gap-6 animate-in zoom-in">
                  <div className="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center text-5xl shadow-[0_10px_0_rgb(194,65,12)] font-black italic">{p.name[0]?.toUpperCase()}</div>
                  <span className="font-black text-3xl truncate w-full text-center tracking-tight leading-none italic">{p.name}</span>
                </div>
              ))}
            </div>
            <button onClick={handleStartGame} disabled={Object.keys(roomData.players).length < 3} className="bg-white text-slate-900 px-24 py-10 rounded-full font-black text-5xl shadow-[0_15px_0_rgb(203,213,225)] active:translate-y-2 transition-all flex items-center gap-8 italic">
              <Play size={48} className="fill-current" /> START SERVICE
            </button>
          </div>
        )}

        {roomData.state === 'ROUND1' && (
          <div className="flex-1 flex flex-col gap-12 max-w-7xl mx-auto w-full">
            <div className="grid grid-cols-12 gap-12 flex-1">
              <div className="col-span-8 flex flex-col gap-8">
                <div className="bg-white/5 rounded-[4rem] border-2 border-white/5 p-16 relative flex flex-col items-center justify-center overflow-hidden">
                   <div className="absolute top-12 left-16 flex items-center gap-10">
                      <div>
                        <div className="flex items-center gap-3 text-orange-400 mb-2 font-black uppercase tracking-[0.3em] text-lg italic">
                          <Utensils size={24} /> Order #0{roomData.round}
                        </div>
                        <h3 className="text-6xl font-black italic tracking-tighter text-white/90">Main Course</h3>
                      </div>
                      <div className={`p-8 rounded-3xl border-4 ${localTimeLeft < 10 ? 'bg-red-500 border-red-600 animate-pulse' : 'bg-white/10 border-white/20'} flex items-center gap-4`}>
                        <Clock size={48} />
                        <span className="text-6xl font-black tabular-nums tracking-tighter italic">{localTimeLeft}s</span>
                      </div>
                   </div>

                   <div className="relative mt-20">
                      <div className={`absolute inset-0 rounded-full blur-[120px] transition-all duration-1000 ${roomData.stinkMeter > 50 ? 'bg-red-500/40' : 'bg-orange-500/20'}`}></div>
                      <Flame size={200} className={`${roomData.stinkMeter > 50 ? 'text-red-500' : 'text-orange-500'} animate-pulse`} />
                   </div>

                   <div className="mt-16 text-center">
                      <p className="text-white/40 font-black uppercase tracking-[0.5em] mb-4 text-xl italic">Active Requirement:</p>
                      <div className="bg-white text-slate-950 px-20 py-10 rounded-[2.5rem] inline-block shadow-[0_15px_0_rgb(203,213,225)]">
                        <h2 className="text-9xl font-black uppercase tracking-tighter italic">{roomData.currentRecipe[roomData.recipeIndex] || 'DONE'}</h2>
                      </div>
                   </div>
                </div>

                <div className="bg-[#f3f4f6] text-slate-900 p-8 rounded-3xl shadow-inner font-mono flex items-center gap-8 overflow-hidden relative">
                   <span className="shrink-0 font-black text-slate-400 uppercase tracking-widest text-sm transform -rotate-90 italic">Live Receipt</span>
                   <div className="flex gap-6 items-center">
                      {roomData.pot.slice(-10).reverse().map((ing, i) => (
                        <div key={i} className={`px-8 py-5 rounded-2xl border-4 flex flex-col min-w-[150px] ${ing.type === 'TAINTED' ? 'bg-red-100 border-red-400' : 'bg-white border-slate-200 shadow-sm'} animate-in slide-in-from-right`}>
                           <span className="text-[11px] uppercase font-black opacity-50 italic">{ing.category}</span>
                           <span className={`font-black text-2xl italic ${ing.type === 'TAINTED' ? 'text-red-600' : 'text-slate-800'}`}>{ing.name}</span>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="col-span-4 flex flex-col gap-8">
                 <div className="bg-white/5 rounded-[3rem] p-10 border-2 border-white/5">
                    <h4 className="text-white/40 font-black uppercase tracking-widest text-xs mb-4 italic flex items-center gap-2">
                      <AlertTriangle size={16} /> Contamination Level
                    </h4>
                    <div className="flex justify-between items-end mb-4">
                       <span className={`text-6xl font-black italic tracking-tighter ${roomData.stinkMeter > 50 ? 'text-red-500' : 'text-green-400'}`}>
                          {roomData.stinkMeter}%
                       </span>
                    </div>
                    <div className="w-full h-24 bg-black/40 rounded-[2.5rem] p-3 relative overflow-hidden border border-white/10">
                       <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-600 rounded-[1.5rem] transition-all duration-1000 shadow-lg" style={{ width: `${roomData.stinkMeter}%` }} />
                    </div>
                    {roomData.stinkMeter > 0 && <p className="mt-6 text-red-400 font-black uppercase text-center animate-bounce text-sm">Contamination Detected!</p>}
                 </div>

                 <div className="bg-white/5 rounded-[3rem] p-10 border-2 border-white/5 flex-1 overflow-hidden">
                    <h4 className="text-white/40 font-black uppercase tracking-widest text-xs mb-8 flex items-center gap-2 italic">
                      <Trophy size={16} /> Chef Ranking
                    </h4>
                    <div className="space-y-6">
                      {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, idx) => (
                        <div key={p.id} className="flex justify-between items-center bg-white/5 p-6 rounded-[1.5rem] border border-white/5 animate-in slide-in-from-left">
                           <div className="flex items-center gap-5">
                              <span className="text-white/20 font-black italic text-2xl">#{idx + 1}</span>
                              <span className="font-black text-2xl italic tracking-tight">{p.name}</span>
                           </div>
                           <span className={`text-3xl font-black tabular-nums italic ${p.score < 0 ? 'text-red-500' : 'text-orange-400'}`}>{p.score}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12">
            <div className="text-center">
               <div className="bg-red-500 w-48 h-48 rounded-full flex items-center justify-center mx-auto mb-10 animate-pulse shadow-[0_0_120px_rgba(239,68,68,0.8)]">
                 <Skull size={120} className="text-white" />
               </div>
               <h2 className="text-[12rem] font-black text-white italic tracking-tighter leading-none mb-4">HEALTH INSPECTION!</h2>
               <p className="text-5xl text-white/40 font-bold uppercase tracking-[0.4em] italic">The Saboteur has ruined the kitchen</p>
            </div>
            
            <div className="bg-white p-16 rounded-[4rem] text-slate-900 w-full max-w-6xl shadow-2xl relative border-b-[24px] border-slate-200">
              <div className="absolute top-0 right-16 transform -translate-y-1/2 bg-red-600 text-white px-12 py-6 rounded-3xl font-black uppercase tracking-widest text-2xl italic shadow-lg">Evidence Log</div>
              <div className="grid grid-cols-5 gap-8">
                {roomData.pot.slice(-5).map((ing, i) => (
                  <div key={i} className={`p-12 rounded-[2.5rem] border-4 text-center space-y-4 shadow-sm ${ing.type === 'TAINTED' ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-slate-400 text-xs font-black uppercase tracking-widest italic">{ing.category}</div>
                    <div className="text-4xl font-black leading-tight italic tracking-tighter">{ing.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {(roomData.state === 'VOTE_REVEAL' || roomData.state === 'ROUND_END') && (
           <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in zoom-in duration-1000">
              <div className="space-y-6">
                <span className="bg-white/10 text-white/50 px-10 py-4 rounded-full font-black uppercase tracking-[0.5em] text-2xl italic">Shift Report</span>
                <h2 className="text-[13rem] font-black italic tracking-tighter leading-none text-white drop-shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
                  {roomData.state === 'ROUND_END' ? 'CLEAN!' : roomData.voteSuccess ? 'TERMINATED!' : 'SABOTEUR WINS!'}
                </h2>
                <div className="text-6xl bg-orange-500 text-white p-12 rounded-[3.5rem] inline-block shadow-[0_20px_0_rgb(194,65,12)] transform rotate-2 italic font-black tracking-tight">
                   {roomData.state === 'ROUND_END' 
                    ? "KITCHEN MAINTAINED STANDARDS!" 
                    : `THE MOLE WAS ${Object.values(roomData.players).find(p => p.role === 'SABOTEUR')?.name?.toUpperCase()}!`}
                </div>
              </div>
              <button onClick={handleStartGame} className="bg-white text-slate-900 px-32 py-12 rounded-full font-black text-6xl hover:bg-orange-500 hover:text-white transition-all transform hover:scale-110 shadow-[0_25px_0_rgb(203,213,225)] active:translate-y-3 italic">
                <RotateCcw size={64} className="inline mr-6" /> NEXT TICKET
              </button>
           </div>
        )}
      </div>
    );
  }

  if (view === 'player' && roomData) {
    const me = roomData.players[auth.currentUser?.uid];
    if (!me) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black italic text-2xl animate-pulse">RECLOCKING IN...</div>;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col p-6 font-sans select-none overflow-hidden italic">
        <div className="flex justify-between items-center mb-6 bg-white p-6 rounded-[2rem] shadow-sm border-b-8 border-slate-200">
          <div className="flex items-center gap-4">
             <div className={`p-4 rounded-2xl shadow-inner ${me.role === 'SABOTEUR' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                {me.role === 'SABOTEUR' ? <Skull size={32} /> : <ChefHat size={32} />}
             </div>
             <div>
               <h3 className="font-black text-slate-900 text-2xl leading-none tracking-tight">{me.name}</h3>
               <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] italic">{me.role === 'SABOTEUR' ? 'SABOTEUR' : 'LINE COOK'}</span>
             </div>
          </div>
          <div className="text-right">
             <span className={`text-4xl font-black tabular-nums tracking-tighter ${me.score < 0 ? 'text-red-500' : 'text-slate-950'}`}>{me.score}</span>
          </div>
        </div>

        {roomData.state === 'ROUND1' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-10 bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border-b-[12px] border-slate-950">
              <div className="absolute top-0 right-0 p-8 opacity-10 transform rotate-12 scale-150"><Utensils size={120} /></div>
              <p className="text-[11px] font-black text-orange-400 uppercase tracking-[0.4em] mb-3 italic">Active Ticket Needs:</p>
              <h2 className="text-6xl font-black tracking-tighter uppercase leading-none">{roomData.currentRecipe[roomData.recipeIndex] || 'DONE'}</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-5 flex-1 pb-6">
              {(me.hand || []).map((card, idx) => (
                <button key={idx} onClick={() => handlePlayCard(idx)} className={`relative p-7 rounded-[2.5rem] border-b-[12px] text-left h-full flex flex-col justify-between active:scale-95 active:translate-y-3 transition-all shadow-xl ${me.role === 'SABOTEUR' ? 'bg-slate-800 border-slate-950 text-white shadow-slate-950/20' : 'bg-white border-slate-200 text-slate-900'}`}>
                  <span className={`text-[11px] font-black uppercase tracking-widest italic ${me.role === 'SABOTEUR' ? 'text-red-400' : 'text-orange-500'}`}>{card.category}</span>
                  <span className="font-black text-2xl leading-[1.1] pr-2 tracking-tighter uppercase">{card.name}</span>
                  {me.role === 'SABOTEUR' && <Skull size={20} className="absolute bottom-6 right-6 opacity-10" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col space-y-5 pt-4">
             <div className="bg-red-600 p-10 rounded-[3rem] text-white text-center shadow-2xl mb-6 border-b-[12px] border-red-800">
               <Skull size={56} className="mx-auto mb-4" />
               <h2 className="text-5xl font-black italic tracking-tighter leading-none">VOTE NOW!</h2>
               <p className="font-black text-red-100 uppercase tracking-widest text-[10px]">Identify the contaminated cook</p>
             </div>
             <div className="space-y-4">
               {Object.values(roomData.players).filter(p => p.id !== auth.currentUser?.uid).map(p => (
                 <button key={p.id} onClick={() => handleVote(p.id)} disabled={!!roomData.votes?.[auth.currentUser?.uid]} className={`w-full p-8 rounded-[2rem] border-b-[10px] font-black text-3xl transition-all flex items-center justify-between tracking-tighter ${roomData.votes?.[auth.currentUser?.uid] === p.id ? 'bg-red-500 border-red-700 text-white translate-y-2 shadow-none' : 'bg-white border-slate-200 text-slate-900 shadow-xl active:translate-y-2 active:shadow-none'}`}>
                   {p.name}
                   {roomData.votes?.[auth.currentUser?.uid] === p.id && <CheckCircle size={36} />}
                 </button>
               ))}
             </div>
          </div>
        )}

        {(roomData.state === 'LOBBY' || roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL') && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-in zoom-in duration-500">
                 <div className="bg-white p-16 rounded-[4rem] shadow-2xl border-b-[16px] border-slate-100 w-full">
                    <div className="bg-slate-900 w-28 h-28 rounded-full flex items-center justify-center text-white mx-auto mb-10 shadow-2xl">
                      {roomData.state === 'LOBBY' ? <ChevronRight size={56} /> : <RotateCcw size={56} className="animate-spin-slow" />}
                    </div>
                    <h2 className="text-5xl font-black text-slate-950 tracking-tighter leading-none mb-4 uppercase">{roomData.state === 'LOBBY' ? 'CLOCKED IN' : 'SHIFT OVER'}</h2>
                    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs">Awaiting main screen</p>
                 </div>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white italic">
      <Flame size={100} className="text-orange-500 animate-bounce mb-8" />
      <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Prepping Table...</span>
    </div>
  );
}