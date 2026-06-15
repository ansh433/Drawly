import { z } from "zod";

export const CreateUserSchema = z.object({
    username: z.string().min(3).max(20),
    password: z.string(),
    name: z.string()
})

export const SigninSchema = z.object({
    username: z.string().min(3).max(20),
    password: z.string() 
})

export const CreateRoomSchema = z.object({
     name: z.string().min(3).max(20)
})

export const RoomIdSchema = z.string().min(1);

export const CanvasPointSchema = z.object({
    x: z.number(),
    y: z.number()
});

export const CanvasShapeTypeSchema = z.enum(["rect", "circle", "pencil"]);

export const CanvasShapeStyleSchema = z.object({
    strokeColor: z.string().min(1),
    fillColor: z.string().min(1).nullable(),
    strokeWidth: z.number().positive()
});

export const RectangleShapeDataSchema = CanvasShapeStyleSchema.extend({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
});

export const CircleShapeDataSchema = CanvasShapeStyleSchema.extend({
    centerX: z.number(),
    centerY: z.number(),
    radius: z.number()
});

export const PencilShapeDataSchema = CanvasShapeStyleSchema.extend({
    points: z.array(CanvasPointSchema).min(2),
    fillColor: z.null()
});

export const CanvasShapeDataSchema = z.union([
    RectangleShapeDataSchema,
    CircleShapeDataSchema,
    PencilShapeDataSchema
]);

export const CanvasShapeRecordSchema = z.object({
    id: z.string(),
    roomId: z.number(),
    userId: z.string(),
    type: CanvasShapeTypeSchema,
    data: CanvasShapeDataSchema,
    deleted: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string()
});

export const ChatMessageSchema = z.object({
    id: z.number(),
    roomId: z.number(),
    userId: z.string(),
    message: z.string(),
    createdAt: z.string()
});

export const CursorPositionSchema = z.object({
    x: z.number(),
    y: z.number()
});

export const JoinRoomEventSchema = z.object({
    type: z.literal("join_room"),
    roomId: RoomIdSchema
});

export const LeaveRoomEventSchema = z.object({
    type: z.literal("leave_room"),
    roomId: RoomIdSchema
});

export const ShapeCreateEventSchema = z.object({
    type: z.literal("shape:create"),
    roomId: RoomIdSchema,
    shapeType: CanvasShapeTypeSchema,
    data: CanvasShapeDataSchema
});

export const ShapeCreatedEventSchema = z.object({
    type: z.literal("shape:created"),
    roomId: RoomIdSchema,
    shape: CanvasShapeRecordSchema
});

export const ShapeUpdateEventSchema = z.object({
    type: z.literal("shape:update"),
    roomId: RoomIdSchema,
    shapeId: z.string(),
    shapeType: CanvasShapeTypeSchema,
    data: CanvasShapeDataSchema
});

export const ShapeUpdatedEventSchema = z.object({
    type: z.literal("shape:updated"),
    roomId: RoomIdSchema,
    shape: CanvasShapeRecordSchema
});

export const ShapeDeleteEventSchema = z.object({
    type: z.literal("shape:delete"),
    roomId: RoomIdSchema,
    shapeId: z.string()
});

export const ShapeDeletedEventSchema = z.object({
    type: z.literal("shape:deleted"),
    roomId: RoomIdSchema,
    shapeId: z.string()
});

export const ChatSendEventSchema = z.object({
    type: z.literal("chat:send"),
    roomId: RoomIdSchema,
    message: z.string().min(1).max(2000)
});

export const ChatMessageEventSchema = z.object({
    type: z.literal("chat:message"),
    roomId: RoomIdSchema,
    message: ChatMessageSchema
});

export const CursorUpdateEventSchema = z.object({
    type: z.literal("cursor:update"),
    roomId: RoomIdSchema,
    cursor: CursorPositionSchema
});

export const RemoteCursorEventSchema = z.object({
    type: z.literal("cursor:update"),
    roomId: RoomIdSchema,
    userId: z.string(),
    cursor: CursorPositionSchema.nullable()
});

export const ClientWebSocketEventSchema = z.union([
    JoinRoomEventSchema,
    LeaveRoomEventSchema,
    ShapeCreateEventSchema,
    ShapeUpdateEventSchema,
    ShapeDeleteEventSchema,
    ChatSendEventSchema,
    CursorUpdateEventSchema
]);

export const ServerWebSocketEventSchema = z.union([
    ShapeCreatedEventSchema,
    ShapeUpdatedEventSchema,
    ShapeDeletedEventSchema,
    ChatMessageEventSchema,
    RemoteCursorEventSchema
]);

export type CanvasPoint = z.infer<typeof CanvasPointSchema>;
export type CanvasShapeType = z.infer<typeof CanvasShapeTypeSchema>;
export type CanvasShapeStyle = z.infer<typeof CanvasShapeStyleSchema>;
export type RectangleShapeData = z.infer<typeof RectangleShapeDataSchema>;
export type CircleShapeData = z.infer<typeof CircleShapeDataSchema>;
export type PencilShapeData = z.infer<typeof PencilShapeDataSchema>;
export type CanvasShapeData = z.infer<typeof CanvasShapeDataSchema>;
export type CanvasShapeRecord = z.infer<typeof CanvasShapeRecordSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type CursorPosition = z.infer<typeof CursorPositionSchema>;
export type ClientWebSocketEvent = z.infer<typeof ClientWebSocketEventSchema>;
export type ServerWebSocketEvent = z.infer<typeof ServerWebSocketEventSchema>;
