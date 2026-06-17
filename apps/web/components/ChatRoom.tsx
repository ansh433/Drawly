import { BACKEND_URL } from "../app/config"
import { ChatRoomClient } from "./ChatRoomClient";

type ChatMessage = {
    message: string
}

type ChatsResponse = {
    messages: ChatMessage[]
}

async function getChats(roomId: string) {
    const response = await fetch(`${BACKEND_URL}/chats/${roomId}`, {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error("Failed to fetch chats");
    }

    const data = await response.json() as ChatsResponse;
    return data.messages;
}

export async function ChatRoom({id}: {
    id: string
}) {
    const messages = await getChats(id);
    return <ChatRoomClient id={id} messages={messages} />
}
