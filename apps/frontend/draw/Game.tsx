import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";
import { cloneShape, DEFAULT_SHAPE_STYLE, Shape, shapeFromRecord, shapeToPayload, translateShape } from "./shapes";

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[];
    private roomId: string;
    private clicked: boolean;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = "circle";
    private selectedShapeId: string | null = null;
    private onSelectionChange: (shapeId: string | null) => void;
    private movingShapeId: string | null = null;
    private moveStartShape: Shape | null = null;
    private hasMovedShape = false;

    // Pencil
    private pencilPoints: { x: number; y: number }[] = [];

    // Pan
    private isPanning = false;
    private isSpaceDown = false;
    private panX = 0;
    private panY = 0;
    private lastPanX = 0;
    private lastPanY = 0;

    // Zoom
    private scale = 1;

    socket: WebSocket;

    constructor(
        canvas: HTMLCanvasElement,
        roomId: string,
        socket: WebSocket,
        onSelectionChange: (shapeId: string | null) => void
    ) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.existingShapes = [];
        this.roomId = roomId;
        this.socket = socket;
        this.clicked = false;
        this.onSelectionChange = onSelectionChange;
        this.init();
        this.initHandlers();
        this.initMouseHandlers();
        this.initKeyHandlers();
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.removeEventListener("wheel", this.wheelHandler);
        window.removeEventListener("keydown", this.keyDownHandler);
        window.removeEventListener("keyup", this.keyUpHandler);
    }

    setTool(tool: Tool) {
        this.selectedTool = tool;
    }

    deleteSelectedShape() {
        if (!this.selectedShapeId) {
            return;
        }

        this.socket.send(JSON.stringify({
            type: "shape:delete",
            roomId: this.roomId,
            shapeId: this.selectedShapeId
        }));
    }

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId);
        this.clearCanvas();
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "shape:created" && message.roomId === this.roomId) {
                this.existingShapes.push(shapeFromRecord(message.shape));
                this.clearCanvas();
            } else if (message.type === "shape:updated" && message.roomId === this.roomId) {
                const updatedShape = shapeFromRecord(message.shape);
                this.existingShapes = this.existingShapes.map((shape) => (
                    shape.id === updatedShape.id ? updatedShape : shape
                ));
                this.clearCanvas();
            } else if (message.type === "shape:deleted" && message.roomId === this.roomId) {
                this.existingShapes = this.existingShapes.filter((shape) => shape.id !== message.shapeId);
                if (this.selectedShapeId === message.shapeId) {
                    this.setSelectedShape(null);
                }
                this.clearCanvas();
            }
        };
    }

    // Convert screen coords to world coords (accounts for pan/zoom)
    private toWorld(screenX: number, screenY: number) {
        return {
            x: (screenX - this.panX) / this.scale,
            y: (screenY - this.panY) / this.scale,
        };
    }

    private setSelectedShape(shapeId: string | null) {
        this.selectedShapeId = shapeId;
        this.onSelectionChange(shapeId);
    }

    private getShapeBounds(shape: Shape) {
        if (shape.type === "rect") {
            return {
                x: Math.min(shape.x, shape.x + shape.width),
                y: Math.min(shape.y, shape.y + shape.height),
                width: Math.abs(shape.width),
                height: Math.abs(shape.height)
            };
        }

        if (shape.type === "circle") {
            const radius = Math.abs(shape.radius);
            return {
                x: shape.centerX - radius,
                y: shape.centerY - radius,
                width: radius * 2,
                height: radius * 2
            };
        }

        const xs = shape.points.map((point) => point.x);
        const ys = shape.points.map((point) => point.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    private drawSelectionOutline(shape: Shape) {
        const bounds = this.getShapeBounds(shape);
        const padding = 6 / this.scale;

        this.ctx.save();
        this.ctx.strokeStyle = "#38bdf8";
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.setLineDash([6 / this.scale, 4 / this.scale]);
        this.ctx.strokeRect(
            bounds.x - padding,
            bounds.y - padding,
            bounds.width + padding * 2,
            bounds.height + padding * 2
        );
        this.ctx.restore();
    }

    private getShapeAt(point: { x: number; y: number }) {
        const tolerance = 8 / this.scale;

        for (let i = this.existingShapes.length - 1; i >= 0; i--) {
            const shape = this.existingShapes[i];
            if (!shape?.id) {
                continue;
            }

            if (this.isPointInShape(point, shape, tolerance)) {
                return shape;
            }
        }

        return null;
    }

    private isPointInShape(point: { x: number; y: number }, shape: Shape, tolerance: number) {
        if (shape.type === "rect") {
            const bounds = this.getShapeBounds(shape);
            return (
                point.x >= bounds.x - tolerance &&
                point.x <= bounds.x + bounds.width + tolerance &&
                point.y >= bounds.y - tolerance &&
                point.y <= bounds.y + bounds.height + tolerance
            );
        }

        if (shape.type === "circle") {
            const distance = Math.hypot(point.x - shape.centerX, point.y - shape.centerY);
            return distance <= Math.abs(shape.radius) + tolerance;
        }

        for (let i = 1; i < shape.points.length; i++) {
            const start = shape.points[i - 1];
            const end = shape.points[i];
            if (this.distanceToSegment(point, start, end) <= tolerance) {
                return true;
            }
        }

        return false;
    }

    private distanceToSegment(
        point: { x: number; y: number },
        start: { x: number; y: number },
        end: { x: number; y: number }
    ) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        if (dx === 0 && dy === 0) {
            return Math.hypot(point.x - start.x, point.y - start.y);
        }

        const segmentLengthSquared = dx * dx + dy * dy;
        const projectedDistance = (point.x - start.x) * dx + (point.y - start.y) * dy;
        const t = Math.max(0, Math.min(1, projectedDistance / segmentLengthSquared));
        const projection = {
            x: start.x + t * dx,
            y: start.y + t * dy
        };

        return Math.hypot(point.x - projection.x, point.y - projection.y);
    }

    clearCanvas() {
        const ctx = this.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply pan and zoom transform
        ctx.setTransform(this.scale, 0, 0, this.scale, this.panX, this.panY);

        this.existingShapes.forEach((shape) => {
            ctx.save();
            ctx.strokeStyle = shape.strokeColor;
            ctx.lineWidth = shape.strokeWidth;
            if (shape.type === "rect") {
                if (shape.fillColor) {
                    ctx.fillStyle = shape.fillColor;
                    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
                }
                ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            } else if (shape.type === "circle") {
                ctx.beginPath();
                ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
                if (shape.fillColor) {
                    ctx.fillStyle = shape.fillColor;
                    ctx.fill();
                }
                ctx.stroke();
                ctx.closePath();
            } else if (shape.type === "pencil") {
                if (shape.points.length < 2) return;
                ctx.beginPath();
                ctx.moveTo(shape.points[0].x, shape.points[0].y);
                shape.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            }
            ctx.restore();

            if (shape.id && shape.id === this.selectedShapeId) {
                this.drawSelectionOutline(shape);
            }
        });
    }

    mouseDownHandler = (e: MouseEvent) => {
        // Middle mouse or space+left = pan
        if (e.button === 1 || (e.button === 0 && this.isSpaceDown)) {
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            return;
        }

        this.clicked = true;
        const world = this.toWorld(e.clientX, e.clientY);
        this.startX = world.x;
        this.startY = world.y;

        if (this.selectedTool === "select") {
            const selectedShape = this.getShapeAt(world);
            const selectedShapeId = selectedShape?.id ?? null;

            this.setSelectedShape(selectedShapeId);
            this.movingShapeId = selectedShapeId;
            this.moveStartShape = selectedShape ? cloneShape(selectedShape) : null;
            this.hasMovedShape = false;
            this.clicked = Boolean(selectedShapeId);
            this.clearCanvas();
            return;
        }

        if (this.selectedTool === "pencil") {
            this.pencilPoints = [{ x: world.x, y: world.y }];
        }
    };

    mouseUpHandler = (e: MouseEvent) => {
        if (this.isPanning) {
            this.isPanning = false;
            return;
        }

        this.clicked = false;
        const world = this.toWorld(e.clientX, e.clientY);

        if (this.movingShapeId && this.moveStartShape) {
            const movingShapeId = this.movingShapeId;
            const movedShape = this.existingShapes.find((shape) => shape.id === movingShapeId);
            const shouldPersistMove = Boolean(movedShape && this.hasMovedShape);

            this.movingShapeId = null;
            this.moveStartShape = null;
            this.hasMovedShape = false;

            if (movedShape && shouldPersistMove) {
                const payload = shapeToPayload(movedShape);
                this.socket.send(JSON.stringify({
                    type: "shape:update",
                    roomId: this.roomId,
                    shapeId: movingShapeId,
                    ...payload
                }));
            }
            return;
        }

        let shape: Shape | null = null;

        if (this.selectedTool === "rect") {
            shape = {
                ...DEFAULT_SHAPE_STYLE,
                type: "rect",
                x: this.startX,
                y: this.startY,
                width: world.x - this.startX,
                height: world.y - this.startY,
            };
        } else if (this.selectedTool === "circle") {
            const width = world.x - this.startX;
            const height = world.y - this.startY;
            const radius = Math.max(width, height) / 2;
            shape = {
                ...DEFAULT_SHAPE_STYLE,
                type: "circle",
                radius,
                centerX: this.startX + radius,
                centerY: this.startY + radius,
            };
        } else if (this.selectedTool === "pencil") {
            if (this.pencilPoints.length > 1) {
                shape = {
                    ...DEFAULT_SHAPE_STYLE,
                    fillColor: null,
                    type: "pencil",
                    points: this.pencilPoints,
                };
            }
            this.pencilPoints = [];
        }

        if (!shape) return;

        const payload = shapeToPayload(shape);
        this.socket.send(JSON.stringify({
            type: "shape:create",
            roomId: this.roomId,
            ...payload
        }));
    };

    mouseMoveHandler = (e: MouseEvent) => {
        // Handle panning
        if (this.isPanning) {
            this.panX += e.clientX - this.lastPanX;
            this.panY += e.clientY - this.lastPanY;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            this.clearCanvas();
            return;
        }

        if (!this.clicked) return;

        const world = this.toWorld(e.clientX, e.clientY);

        if (this.movingShapeId && this.moveStartShape) {
            const dx = world.x - this.startX;
            const dy = world.y - this.startY;
            const movedShape = translateShape(this.moveStartShape, dx, dy);

            this.hasMovedShape = Math.abs(dx) > 0 || Math.abs(dy) > 0;
            this.existingShapes = this.existingShapes.map((shape) => (
                shape.id === this.movingShapeId ? movedShape : shape
            ));
            this.clearCanvas();
            return;
        }

        const width = world.x - this.startX;
        const height = world.y - this.startY;

        this.clearCanvas();
        this.ctx.strokeStyle = DEFAULT_SHAPE_STYLE.strokeColor;
        this.ctx.lineWidth = DEFAULT_SHAPE_STYLE.strokeWidth;

        if (this.selectedTool === "rect") {
            this.ctx.strokeRect(this.startX, this.startY, width, height);
        } else if (this.selectedTool === "circle") {
            const radius = Math.max(width, height) / 2;
            this.ctx.beginPath();
            this.ctx.arc(this.startX + radius, this.startY + radius, Math.abs(radius), 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.closePath();
        } else if (this.selectedTool === "pencil") {
            this.pencilPoints.push({ x: world.x, y: world.y });
            // Draw current pencil stroke in progress
            if (this.pencilPoints.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.pencilPoints[0].x, this.pencilPoints[0].y);
                this.pencilPoints.slice(1).forEach((p) => this.ctx.lineTo(p.x, p.y));
                this.ctx.stroke();
            }
        }
    };

    wheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const worldX = (e.clientX - this.panX) / this.scale;
        const worldY = (e.clientY - this.panY) / this.scale;

        this.scale *= zoomFactor;
        this.scale = Math.min(Math.max(this.scale, 0.1), 10); // clamp between 0.1x and 10x

        // Adjust pan so zoom is centered on cursor
        this.panX = e.clientX - worldX * this.scale;
        this.panY = e.clientY - worldY * this.scale;

        this.clearCanvas();
    };

    keyDownHandler = (e: KeyboardEvent) => {
        if ((e.key === "Backspace" || e.key === "Delete") && this.selectedShapeId) {
            e.preventDefault();
            this.deleteSelectedShape();
            return;
        }

        if (e.code === "Space") {
            this.isSpaceDown = true;
            this.canvas.style.cursor = "grab";
        }
    };

    keyUpHandler = (e: KeyboardEvent) => {
        if (e.code === "Space") {
            this.isSpaceDown = false;
            this.isPanning = false;
            this.canvas.style.cursor = "default";
        }
    };

    initMouseHandlers() {
        this.canvas.addEventListener("mousedown", this.mouseDownHandler);
        this.canvas.addEventListener("mouseup", this.mouseUpHandler);
        this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
    }

    initKeyHandlers() {
        window.addEventListener("keydown", this.keyDownHandler);
        window.addEventListener("keyup", this.keyUpHandler);
    }
}
