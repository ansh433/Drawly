"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "./Canvas";
import { RoomChat } from "./RoomChat";
import { Button } from "./ui/button";
import { MessageSquareMore, X } from "lucide-react";
import { getCurrentUser, type CurrentUser } from "@/draw/http";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

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

  useEffect(() => {
    let active = true;

    async function loadCurrentUser() {
      try {
        const user = await getCurrentUser();
        if (active) {
          setCurrentUser(user);
        }
      } catch {
        localStorage.removeItem("token");
        router.push("/signin");
      }
    }

    loadCurrentUser();

    return () => {
      active = false;
    };
  }, [router]);

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
      <div className="fixed right-3 top-3 z-50">
        <Button
          type="button"
          variant="neutral"
          size="icon"
          aria-label={chatOpen ? "Close chat" : "Open chat"}
          title={chatOpen ? "Close chat" : "Open chat"}
          onClick={() => setChatOpen((current) => !current)}
        >
          {chatOpen ? <X className="size-4" /> : <MessageSquareMore className="size-4" />}
        </Button>
      </div>
      <RoomChat
        roomId={roomId}
        socket={socket}
        open={chatOpen}
        currentUser={currentUser}
      />
    </div>
  );
}
