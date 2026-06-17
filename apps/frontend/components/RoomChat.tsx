"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { MessageSquareMore, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { getChatMessages } from "@/draw/http";
import type { ChatMessage } from "@repo/common/types";

function formatMessageTime(createdAt: string) {
    return new Date(createdAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
    const byId = new Map<number, ChatMessage>();

    [...existing, ...incoming].forEach((message) => {
        byId.set(message.id, message);
    });

    return Array.from(byId.values()).sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();

        if (leftTime !== rightTime) {
            return leftTime - rightTime;
        }

        return left.id - right.id;
    });
}

export function RoomChat({
    roomId,
    socket
}: {
    roomId: string;
    socket: WebSocket;
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;

        async function loadMessages() {
            try {
                const data = await getChatMessages(roomId);
                if (active) {
                    setMessages((current) => mergeMessages(current, data));
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadMessages();

        return () => {
            active = false;
        };
    }, [roomId]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            try {
                const parsed = JSON.parse(event.data);

                if (parsed.type === "chat:message" && parsed.roomId === roomId) {
                    setMessages((current) => [...current, parsed.message]);
                }
            } catch {
                // Ignore non-chat payloads here.
            }
        };

        socket.addEventListener("message", handleMessage);

        return () => {
            socket.removeEventListener("message", handleMessage);
        };
    }, [roomId, socket]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages]);

    function sendMessage(event?: FormEvent<HTMLFormElement>) {
        event?.preventDefault();

        const message = draft.trim();
        if (!message) {
            return;
        }

        socket.send(JSON.stringify({
            type: "chat:send",
            roomId,
            message
        }));

        setDraft("");
    }

    const emptyState = loading
        ? "Loading messages..."
        : "No messages yet. Say hello.";

    return (
        <aside className="fixed right-0 top-0 flex h-screen w-[20rem] flex-col border-l-2 border-border bg-secondary-background shadow-shadow">
            <div className="flex items-center gap-2 border-b-2 border-border px-4 py-3">
                <div className="flex size-8 items-center justify-center rounded-base border-2 border-border bg-background">
                    <MessageSquareMore className="size-4" />
                </div>
                <div>
                    <p className="text-sm font-heading">Room chat</p>
                    <p className="text-xs font-base text-foreground/60">Messages only, no drawings</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                    <p className="text-sm font-base text-foreground/50">{emptyState}</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className="rounded-base border-2 border-border bg-background px-3 py-2 shadow-shadow"
                            >
                                <p className="text-sm font-base text-foreground">{message.message}</p>
                                <p className="mt-1 text-[11px] font-base text-foreground/45">
                                    {formatMessageTime(message.createdAt)}
                                </p>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            <form className="border-t-2 border-border p-3" onSubmit={sendMessage}>
                <div className="flex items-end gap-2">
                    <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Write a message"
                        className="h-10"
                    />
                    <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
                        <Send className="size-4" />
                    </Button>
                </div>
            </form>
        </aside>
    );
}
