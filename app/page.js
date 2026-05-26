import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-8">
      <h1 className="text-white text-3xl font-bold tracking-widest">翻牌互動系統</h1>
      
      <div className="flex gap-6">
        <Link 
          href="/editor" 
          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-lg font-bold text-xl transition-colors border-2 border-blue-400"
        >
          進入編輯者模式
        </Link>

        <Link 
          href="/viewer" 
          className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-lg font-bold text-xl transition-colors border-2 border-green-400"
        >
          進入檢視者模式
        </Link>
      </div>
    </div>
  );
}