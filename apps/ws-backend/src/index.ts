import "dotenv/config";
import { WebSocket, WebSocketServer } from 'ws';
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common/config';
import { prismaClient } from "@repo/db/client";
import { ClientWebSocketEventSchema } from "@repo/common/types";


const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket,
  rooms: string[],
  userId: string
}

const users: User[] = [];

function broadcastToRoom(roomId: string, message: unknown) {
  users.forEach(user => {
    if (user.rooms.includes(roomId) && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify(message));
    }
  });
}

function serializeCanvasShape(shape: {
  id: string;
  roomId: number;
  userId: string;
  type: string;
  data: unknown;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...shape,
    createdAt: shape.createdAt.toISOString(),
    updatedAt: shape.updatedAt.toISOString()
  };
}

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded == "string") {
      return null;
    }

    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  } catch(e) {
    return null;
  }
  return null;
}

wss.on('connection', function connection(ws, request) {
  const url = request.url;
  if (!url) {
    return;
  }
  const queryParams = new URLSearchParams(url.split('?')[1]);
  const token = queryParams.get('token') || "";
  const userId = checkUser(token);

  if (userId == null) {
    ws.close()
    return null;
  }

  users.push({
    userId,
    rooms: [],
    ws
  })

  ws.on('message', async function message(data) {
  try {
    // Parse incoming data whether it arrives as a Buffer or a string
    let parsedData;
    if (typeof data !== "string") {
      parsedData = JSON.parse(data.toString());
    } else {
      parsedData = JSON.parse(data);
    }

    const parsedMessage = ClientWebSocketEventSchema.safeParse(parsedData);
    if (!parsedMessage.success) {
      return;
    }

    const message = parsedMessage.data;

    if (message.type === "join_room") {
      const user = users.find(x => x.ws === ws);
      if (user && !user.rooms.includes(message.roomId)) {
        user.rooms.push(message.roomId);
      }
    }

    if (message.type === "leave_room") {
      const user = users.find(x => x.ws === ws);
      if (!user) return;
      user.rooms = user.rooms.filter(x => x !== message.roomId);
    }

    if (message.type === "chat:send") {
      const roomId = Number(message.roomId);
      if (!Number.isInteger(roomId)) {
        return;
      }

      const chatMessage = await prismaClient.chat.create({
        data: {
          roomId,
          userId,
          message: message.message.trim()
        }
      });

      broadcastToRoom(message.roomId, {
        type: "chat:message",
        roomId: message.roomId,
        message: chatMessage,
        clientMessageId: message.clientMessageId
      });
    }

    if (message.type === "shape:create") {
      const roomId = Number(message.roomId);
      if (!Number.isInteger(roomId)) {
        return;
      }

      const shape = await prismaClient.canvasShape.create({
        data: {
          roomId,
          type: message.shapeType,
          data: message.data,
          userId
        }
      });

      broadcastToRoom(message.roomId, {
        type: "shape:created",
        roomId: message.roomId,
        shape: serializeCanvasShape(shape)
      });
    }

    if (message.type === "shape:update") {
      const roomId = Number(message.roomId);
      if (!Number.isInteger(roomId)) {
        return;
      }

      const updateResult = await prismaClient.canvasShape.updateMany({
        where: {
          id: message.shapeId,
          roomId,
          deleted: false
        },
        data: {
          type: message.shapeType,
          data: message.data
        }
      });

      if (updateResult.count === 0) {
        return;
      }

      const shape = await prismaClient.canvasShape.findUnique({
        where: { id: message.shapeId }
      });

      if (!shape) {
        return;
      }

      broadcastToRoom(message.roomId, {
        type: "shape:updated",
        roomId: message.roomId,
        shape: serializeCanvasShape(shape)
      });
    }

    if (message.type === "shape:delete") {
      const roomId = Number(message.roomId);
      if (!Number.isInteger(roomId)) {
        return;
      }

      const deleteResult = await prismaClient.canvasShape.updateMany({
        where: {
          id: message.shapeId,
          roomId,
          deleted: false
        },
        data: {
          deleted: true
        }
      });

      if (deleteResult.count === 0) {
        return;
      }

      broadcastToRoom(message.roomId, {
        type: "shape:deleted",
        roomId: message.roomId,
        shapeId: message.shapeId
      });
    }

  } catch (error) {
    // Log the error but don't let it kill the server process
    console.error("WebSocket message error:", error);
  }
});

});
