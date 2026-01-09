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
  Trophy
} from 'lucide-react';

// --- Firebase Configuration ---
// Priority 1: Environment config (for Canvas preview)
// Priority 2: User's hardcoded config (for Vercel/GitHub deployment)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
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

// --- Game Data & Constants ---
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

// --- Utilities ---
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');
  const [roomCode, setRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  // Fixed Auth Logic with Error Handling (Fixes custom-token-mismatch)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          // Attempt sign-in with system token
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        // If token mismatch (due to custom project config in preview), fall back to anonymous
        console.warn("Auth token error, falling back to anonymous sign-in:", err.message);
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomData(snapshot.data());
      } else if (view !== 'landing') {
        setError("Room closed.");
        setView('landing');
      }
    }, (err) => {
      console.error("Firestore sync error:", err);
      setError("Connection to room lost. Try refreshing.");
    });
    return () => unsubscribe();
  }, [user, roomCode, view]);

  const handleCreateRoom = async () => {
    if (!user) return;
    const code = generateRoomCode();
    const initialRoomState = {
      code,
      state: 'LOBBY',
      players: {},
      hostId: user.uid,
      currentRecipe: [],
      pot: [],
      stinkMeter: 0,
      round: 0,
      scores: {},
      lastUpdated: Date.now()
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code), initialRoomState);
      setRoomCode(code);
      setView('host');
    } catch (err) {
      setError("Failed to create room. Please try again.");
    }
  };

  const handleJoinRoom = async (code) => {
    if (!user) return;
    const upperCode = code.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', upperCode);
    
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setError("Room not found.");
        return;
      }
      
      const data = snap.data();
      if (data.state !== 'LOBBY') {
        setError("Game in progress.");
        return;
      }

      await updateDoc(roomRef, {
        [`players.${user.uid}`]: {
          id: user.uid,
          name: playerName || `Chef ${Math.floor(Math.random() * 900) + 100}`,
          role: 'CHEF',
          hand: [],
          score: 0,
          joinedAt: Date.now()
        }
      });
      setRoomCode(upperCode);
      setView('player');
    } catch (err) {
      setError("Error joining room.");
    }
  };

  const handleStartGame = async () => {
    if (!roomData) return;
    const playerIds = Object.keys(roomData.players);
    if (playerIds.length < 3) {
      setError("Need at least 3 chefs!");
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

    const recipe = Array.from({ length: 5 }, () => getRandomItem(CATEGORIES));

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), {
      state: 'ROUND1',
      players: newPlayers,
      currentRecipe: recipe,
      recipeIndex: 0,
      pot: [],
      stinkMeter: 0,
      round: 1,
      votes: {}
    });
  };

  const handlePlayCard = async (cardIndex) => {
    if (!roomData || !user) return;
    const player = roomData.players[user.uid];
    const card = player.hand[cardIndex];
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

    if (card.type === 'TAINTED') {
      newStink += 25;
      points = -10;
    } else if (card.category === targetCategory) {
      points = 10;
    } else {
      points = 2;
    }

    const updates = {
      [`players.${user.uid}.hand`]: newHand,
      [`players.${user.uid}.score`]: player.score + points,
      pot: [...roomData.pot, { ...card, playedBy: user.uid, playerName: player.name }],
      stinkMeter: newStink,
      recipeIndex: roomData.recipeIndex + 1
    };

    if (newStink >= 100) {
      updates.state = 'TASTE_TEST';
    } else if (roomData.recipeIndex + 1 >= roomData.currentRecipe.length) {
      updates.state = 'ROUND_END';
    }

    await updateDoc(roomRef, updates);
  };

  const handleVote = async (targetId) => {
    if (!roomData || !user) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const currentVotes = { ...(roomData.votes || {}), [user.uid]: targetId };
    
    await updateDoc(roomRef, { votes: currentVotes });

    const totalPlayers = Object.keys(roomData.players).length;
    if (Object.keys(currentVotes).length >= totalPlayers) {
      const tallies = {};
      Object.values(currentVotes).forEach(v => tallies[v] = (tallies[v] || 0) + 1);
      const topVoted = Object.entries(tallies).sort((a,b) => b[1] - a[1])[0][0];
      const saboteur = Object.values(roomData.players).find(p => p.role === 'SABOTEUR');
      
      await updateDoc(roomRef, {
        state: 'VOTE_REVEAL',
        voteWinner: topVoted,
        voteSuccess: topVoted === saboteur.id
      });
    }
  };

  // --- Views ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border-t-[12px] border-orange-500 transform transition hover:scale-[1.01]">
          <div className="flex justify-center mb-4">
            <div className="bg-orange-100 p-4 rounded-full">
              <Flame className="w-12 h-12 text-orange-500 fill-current animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-center text-slate-900 mb-1 tracking-tight">Stir the Pot</h1>
          <p className="text-slate-500 text-center mb-8 font-medium">Kitchen Sabotage Party Game</p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Chef Name</label>
              <input 
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 font-bold text-lg"
                placeholder="Gordon R."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <input 
                className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 uppercase text-center font-black tracking-[0.2em] text-lg"
                placeholder="CODE"
                maxLength={4}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              />
              <button 
                onClick={() => handleJoinRoom(roomCode)}
                className="bg-orange-500 text-white px-8 font-black rounded-2xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/30"
              >
                JOIN
              </button>
            </div>
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-slate-300 font-bold text-xs uppercase">or</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>
            <button 
              onClick={handleCreateRoom}
              className="w-full py-4 border-2 border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <ChefHat size={20} /> HOST ROOM
            </button>
          </div>
          {error && <div className="mt-4 p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl text-center border border-red-100">{error}</div>}
        </div>
      </div>
    );
  }

  if (view === 'host' && roomData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col font-sans overflow-hidden">
        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12">
            <div className="text-center">
              <p className="text-orange-400 font-black tracking-[0.4em] text-xl mb-4">JOIN WITH CODE</p>
              <h2 className="text-[12rem] font-black leading-none tracking-tighter drop-shadow-[0_20px_50px_rgba(249,115,22,0.3)]">{roomCode}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full max-w-6xl">
              {Object.values(roomData.players).map((p, i) => (
                <div key={p.id} className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center font-black text-2xl shadow-lg">
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className="font-black text-xl text-center truncate w-full">{p.name}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={handleStartGame}
              disabled={Object.keys(roomData.players).length < 3}
              className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-16 py-6 rounded-full font-black text-3xl shadow-2xl transition-all flex items-center gap-4"
            >
              <Play className="fill-current w-8 h-8" /> START KITCHEN
            </button>
          </div>
        )}

        {roomData.state === 'ROUND1' && (
          <div className="flex-1 grid grid-cols-12 gap-8 max-w-7xl mx-auto w-full">
            <div className="col-span-8 flex flex-col gap-8">
              <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 relative overflow-hidden flex-1 flex flex-col items-center justify-center">
                <div className="absolute top-8 left-10 flex flex-col">
                  <span className="text-white/40 font-black uppercase tracking-widest text-sm">Now Cooking</span>
                  <h3 className="text-4xl font-black">Morning Prep</h3>
                </div>
                <div className="relative w-80 h-80 flex items-center justify-center">
                  <div className={`absolute inset-0 rounded-full blur-[80px] transition-colors duration-1000 ${roomData.stinkMeter > 60 ? 'bg-red-500/30' : 'bg-orange-500/20'}`}></div>
                  <div className="absolute inset-0 border-[16px] border-slate-800 rounded-full shadow-2xl"></div>
                  <Flame size={120} className={`${roomData.stinkMeter > 50 ? 'text-red-500' : 'text-orange-500'} transition-colors animate-bounce`} />
                </div>
                <div className="mt-12 text-center space-y-2">
                  <p className="text-orange-400 font-black tracking-[0.3em] uppercase text-xl">Current Need:</p>
                  <h2 className="text-8xl font-black">{roomData.currentRecipe[roomData.recipeIndex] || 'FINISHED'}</h2>
                </div>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex items-center gap-6 overflow-hidden">
                <span className="shrink-0 text-xs font-black uppercase tracking-widest text-white/40 border-r border-white/10 pr-6">Pot History</span>
                <div className="flex gap-4 overflow-hidden">
                   {roomData.pot.slice(-8).reverse().map((ing, i) => (
                     <div key={i} className={`px-5 py-3 rounded-2xl font-black whitespace-nowrap ${ing.type === 'TAINTED' ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}>
                       {ing.name}
                     </div>
                   ))}
                </div>
              </div>
            </div>
            <div className="col-span-4 flex flex-col gap-6">
              <div className="bg-red-500/10 p-8 rounded-[2rem] border border-red-500/20">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-red-400 font-black uppercase tracking-widest text-sm">Stink Meter</h4>
                  <span className="font-mono text-2xl font-black text-red-500">{roomData.stinkMeter}%</span>
                </div>
                <div className="w-full h-12 bg-black/40 rounded-2xl p-1.5 border border-white/5 relative">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-600 rounded-xl transition-all duration-1000"
                    style={{ width: `${Math.min(100, roomData.stinkMeter)}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 flex-1">
                 <h4 className="text-white/40 font-black uppercase tracking-widest text-sm mb-6 flex items-center gap-2"><Trophy size={16} /> Leaderboard</h4>
                 <div className="space-y-4">
                    {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, idx) => (
                      <div key={p.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                        <span className="font-black text-lg">{p.name}</span>
                        <span className="text-orange-400 font-black">{p.score}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12">
            <div className="text-center space-y-4">
               <Skull size={64} className="text-red-500 mx-auto mb-4 animate-pulse" />
               <h2 className="text-8xl font-black tracking-tighter text-white">HEALTH INSPECTION!</h2>
               <p className="text-2xl text-white/50">Who is tainting the food?</p>
            </div>
            <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 w-full max-w-4xl grid grid-cols-5 gap-4">
              {roomData.pot.slice(-5).map((ing, i) => (
                <div key={i} className="bg-black/40 p-6 rounded-3xl border-2 border-white/10 text-center space-y-3">
                  <div className="text-white/20 text-xs font-black uppercase">{ing.category}</div>
                  <div className="text-xl font-black">{ing.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL') && (
           <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <h2 className="text-9xl font-black">
                {roomData.state === 'ROUND_END' ? 'RECIPE SUCCESS!' : roomData.voteSuccess ? 'SABOTEUR CAUGHT!' : 'WRONG CHEF FIRED!'}
              </h2>
              <button 
                onClick={handleStartGame}
                className="bg-white text-slate-950 px-16 py-6 rounded-full font-black text-3xl hover:bg-orange-500 hover:text-white transition-all transform hover:scale-110"
              >
                <RotateCcw className="inline mr-2" /> NEXT RECIPE
              </button>
           </div>
        )}
      </div>
    );
  }

  if (view === 'player' && roomData) {
    const me = roomData.players[user.uid];
    if (!me) return <div>Loading...</div>;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-4 font-sans select-none">
        <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
                {me.role === 'SABOTEUR' ? <Skull size={20} /> : <ChefHat size={20} />}
             </div>
             <div>
               <h3 className="font-black text-slate-900 leading-none">{me.name}</h3>
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{me.role}</span>
             </div>
          </div>
          <div className="text-right">
             <span className="text-xl font-black text-orange-500">{me.score}</span>
          </div>
        </div>

        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
            <ChefHat size={60} className="text-orange-500 animate-bounce" />
            <h2 className="text-3xl font-black text-slate-900">Wait for Host</h2>
          </div>
        )}

        {roomData.state === 'ROUND1' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6 bg-slate-900 p-6 rounded-[2rem] text-white">
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-1">Kitchen Goal</p>
              <h2 className="text-4xl font-black">{roomData.currentRecipe[roomData.recipeIndex] || 'DONE'}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {me.hand.map((card, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePlayCard(idx)}
                  className={`p-5 rounded-[1.5rem] border-b-4 text-left h-36 flex flex-col justify-between transition-all active:scale-95 ${
                    me.role === 'SABOTEUR' ? 'bg-slate-800 border-slate-950 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-orange-500">{card.category}</span>
                  <span className="font-black text-lg leading-tight">{card.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col space-y-3">
             <h2 className="text-2xl font-black text-center mb-4">WHO DID IT?</h2>
             {Object.values(roomData.players).filter(p => p.id !== user.uid).map(p => (
               <button
                 key={p.id}
                 onClick={() => handleVote(p.id)}
                 disabled={!!roomData.votes?.[user.uid]}
                 className={`w-full p-5 rounded-3xl border-2 font-black text-xl transition-all ${
                   roomData.votes?.[user.uid] === p.id ? 'bg-red-500 border-red-600 text-white' : 'bg-white border-slate-200'
                 }`}
               >
                 {p.name}
               </button>
             ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
    </div>
  );
}