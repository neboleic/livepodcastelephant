"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

const CARD_CONFIG = [
  { id: 0, image: "/card1.jpg" },
  { id: 1, image: "/card2.jpg" },
  { id: 2, image: "/card3.jpg" },
  { id: 3, image: "/card4.jpg" },
  { id: 4, image: "/card5.jpg" },
  { id: 5, image: "/card6.jpg" },
  { id: 6, image: "/card7.jpg" },
  { id: 7, image: "/card8.jpg" },
  { id: 8, image: "/card9.jpg" },
];

export default function ViewerPage() {
  const [cards, setCards] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false); // 新增：遊戲結束狀態
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [lastClickTime, setLastClickTime] = useState(0);
  const emojiChannelRef = useRef(null);

  const activeCard = cards.find(c => c.is_flipped && !c.is_disabled);
  const isAllCardsDisabled = cards.length > 0 && cards.every(c => c.is_disabled);

  useEffect(() => {
    fetchCards();
    fetchGameStatus();

    const dbChannel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, (payload) => {
        setCards((prev) => prev.map((card) => (card.id === payload.new.id ? payload.new : card)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_status' }, (payload) => {
        if (payload.new.id === 1) {
          setGameStarted(payload.new.is_started);
          setGameEnded(payload.new.is_ended); // 同步更新結束狀態
        }
      })
      .subscribe();

    emojiChannelRef.current = supabase.channel('emoji-room');
    emojiChannelRef.current.subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      if (emojiChannelRef.current) supabase.removeChannel(emojiChannelRef.current);
    };
  }, []);

  const fetchCards = async () => {
    const { data } = await supabase.from('cards').select('*').order('id', { ascending: true });
    if (data) setCards(data);
  };

  const fetchGameStatus = async () => {
    const { data } = await supabase.from('game_status').select('*').eq('id', 1).single();
    if (data) {
      setGameStarted(data.is_started);
      setGameEnded(data.is_ended);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCards((prevCards) => {
        return prevCards.map((card) => {
          if (card.is_flipped && !card.is_disabled && card.time_left > 0) {
            return { ...card, time_left: card.time_left - 1 };
          }
          return card;
        });
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleEmojiSend = (emoji) => {
    const now = Date.now();
    if (now - lastClickTime < 300) return; 
    setLastClickTime(now);

    if (emojiChannelRef.current) {
      emojiChannelRef.current.send({
        type: 'broadcast',
        event: 'send-emoji',
        payload: { emoji },
      });
    }

    const newEmoji = { id: Math.random(), emoji: emoji, left: Math.floor(Math.random() * 80) + 10 };
    
    setFloatingEmojis((prev) => {
      const next = [...prev, newEmoji];
      if (next.length > 30) return next.slice(next.length - 30);
      return next;
    });

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
    }, 6000);
  };

  return (
    <div className="h-screen bg-gray-900 p-4 pb-24 flex flex-col items-center relative overflow-hidden">
      <h1 className="text-gray-400 text-xs mb-4 font-bold tracking-widest z-10">VIEWER MODE</h1>
      
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(10vh) scale(0.5); opacity: 0; }
          10% { transform: translateY(0vh) scale(1.2); opacity: 1; }
          20% { transform: translateY(-20vh) scale(1); opacity: 1; }
          90% { transform: translateY(-90vh) scale(1); opacity: 1; }
          100% { transform: translateY(-110vh) scale(1); opacity: 0; }
        }
        .animate-float { animation: floatUp 6s linear forwards; position: absolute; bottom: 0; pointer-events: none; z-index: 70; }
        @keyframes zoomInCenterViewer {
          0% { transform: translate(-50%, 100%) scale(0.1); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .animate-zoomInViewer { animation: zoomInCenterViewer 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; position: fixed; top: 50%; left: 50%; z-index: 60; }
      `}</style>

      {/* 待機頁面 */}
      {!gameStarted && (
        <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-[80] px-6 text-center">
          <div className="bg-gray-800/80 p-8 rounded-xl border border-gray-700 shadow-2xl">
            <p className="text-white text-xl font-bold tracking-widest leading-loose">
              等待九張卡牌浮現<br />方可發動卡牌
            </p>
          </div>
        </div>
      )}

      {activeCard && gameStarted && !gameEnded && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="animate-zoomInViewer flex flex-col items-center">
            <img src={CARD_CONFIG.find(c => String(c.id) === String(activeCard.id))?.image} alt="卡片正面" className="h-[60vh] aspect-[2/3] object-contain shadow-2xl rounded-md" />
            <div className="mt-6 text-white text-3xl font-black bg-blue-600 px-6 py-2 rounded-full shadow-md animate-pulse">
              ⏱️ 倒數: {activeCard.time_left}s
            </div>
          </div>
        </div>
      )}

      <div className={`flex-grow w-full max-w-md flex items-center justify-center min-h-0 z-10 transition-opacity duration-300 ${activeCard ? "opacity-20" : "opacity-100"}`}>
        {/* 判斷顯示：若是被控制台按下結束，Viewer 端同步顯示指定失效文字 */}
        {gameEnded ? (
          <div className="text-center bg-red-950/30 p-8 rounded-xl border border-red-900/40 shadow-2xl max-w-xs">
            <p className="text-orange-400 text-lg font-bold tracking-widest leading-loose">
              卡牌可發動時間已過<br />所有卡牌已失效
            </p>
          </div>
        ) : isAllCardsDisabled && gameStarted ? (
          <div className="text-center bg-gray-800/80 p-8 rounded-xl border border-gray-700 shadow-2xl">
            <p className="text-white text-lg font-bold tracking-wider leading-relaxed">
              卡牌已全數發動<br />暫無可使用卡牌
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 w-full aspect-[2/3] max-h-full">
            {cards.map((card) => (
              !card.is_disabled ? (
                <div key={card.id} className="w-full aspect-[2/3] rounded-sm bg-gray-800">
                  <img src="/遊戲王卡背.png" alt="卡片背面" className="w-full h-full object-cover rounded-sm shadow-sm" />
                </div>
              ) : (
                <div key={card.id} className="w-full aspect-[2/3] opacity-0 pointer-events-none"></div>
              )
            ))}
          </div>
        )}
      </div>

      {floatingEmojis.map((item) => (
        <div key={item.id} className="animate-float text-5xl" style={{ left: `${item.left}%` }}>{item.emoji}</div>
      ))}

      <div className="fixed bottom-0 left-0 w-full bg-gray-800/90 backdrop-blur-sm p-4 flex justify-around items-center border-t border-gray-700 z-[90] pointer-events-auto">
        {['👍', '😍', '😂', '😮', '❓'].map((emoji) => (
          <button key={emoji} onClick={() => handleEmojiSend(emoji)} className="text-4xl active:scale-75 hover:-translate-y-1 transition-transform duration-150">
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}