"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "./Canvas";
import { RoomChat } from "./RoomChat";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(JSON.stringify({ type: "join_room", roomId }));
    };

    ws.onclose = () => setSocket(null);

    return () => ws.close();
  }, [roomId, router]);

  if (!socket) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-main border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 font-base text-sm">Connecting to canvas...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Canvas roomId={roomId} socket={socket} />
      <RoomChat roomId={roomId} socket={socket} />
    </div>
  );
}
