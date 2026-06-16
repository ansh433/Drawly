import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Ban, Circle, Minus, MousePointer2, PaintBucket, Palette, Pencil, RectangleHorizontalIcon, Trash2 } from "lucide-react";
import { Game } from "@/draw/Game";
import { DEFAULT_SHAPE_STYLE, Shape, ShapeStyle } from "@/draw/shapes";

export type Tool = "circle" | "rect" | "pencil" | "select";

const STROKE_COLORS = [
    "#ffffff",
    "#111827",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#38bdf8",
    "#6366f1",
    "#a855f7"
];

const FILL_COLORS = [
    null,
    "#ffffff",
    "#fde047",
    "#86efac",
    "#93c5fd",
    "#fca5a5",
    "#c4b5fd"
];

const STROKE_WIDTHS = [1, 2, 4, 8, 12];

function getShapeStyle(shape: Shape): ShapeStyle {
    return {
        strokeColor: shape.strokeColor,
        fillColor: shape.type === "pencil" ? null : shape.fillColor,
        strokeWidth: shape.strokeWidth
    };
}

export function Canvas({
    roomId,
    socket
}: {
    socket: WebSocket;
    roomId: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [game, setGame] = useState<Game>();
    const [selectedTool, setSelectedTool] = useState<Tool>("circle")
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
    const [shapeStyle, setShapeStyle] = useState<ShapeStyle>(DEFAULT_SHAPE_STYLE);

    useEffect(() => {
        game?.setTool(selectedTool);
    }, [selectedTool, game]);

    useEffect(() => {
        game?.setStyle(shapeStyle);
    }, [shapeStyle, game]);

    useEffect(() => {

        if (canvasRef.current) {
            const g = new Game(canvasRef.current, roomId, socket, (shape) => {
                setSelectedShapeId(shape?.id ?? null);

                if (shape) {
                    setShapeStyle(getShapeStyle(shape));
                }
            });
            setGame(g);

            return () => {
                g.destroy();
            }
        }


    }, [canvasRef]);

    function updateShapeStyle(style: ShapeStyle) {
        setShapeStyle(style);

        if (selectedShapeId) {
            game?.updateSelectedShapeStyle(style);
        }
    }

    return <div style={{
        height: "100vh",
        overflow: "hidden"
    }}>
        <canvas ref={canvasRef} width={typeof window !== 'undefined' ? window.innerWidth : 1920} height={typeof window !== 'undefined' ? window.innerHeight : 1080}></canvas>
        <Topbar
            setSelectedTool={setSelectedTool}
            selectedTool={selectedTool}
            selectedShapeId={selectedShapeId}
            onDeleteSelected={() => game?.deleteSelectedShape()}
            shapeStyle={shapeStyle}
            setShapeStyle={updateShapeStyle}
        />
    </div>
}

function Topbar({selectedTool, setSelectedTool, selectedShapeId, onDeleteSelected, shapeStyle, setShapeStyle}: {
    selectedTool: Tool,
    setSelectedTool: (s: Tool) => void,
    selectedShapeId: string | null,
    onDeleteSelected: () => void,
    shapeStyle: ShapeStyle,
    setShapeStyle: (style: ShapeStyle) => void
}) {
    return <div style={{
            position: "fixed",
            top: 10,
            left: 10
        }}>
            <div className="flex max-w-[calc(100vw-20px)] flex-wrap items-center gap-2 rounded-base border-2 border-border bg-secondary-background p-2 shadow-shadow">
                <IconButton
                    onClick={() => {
                        setSelectedTool("select")
                    }}
                    activated={selectedTool === "select"}
                    icon={<MousePointer2 />}
                />
                <IconButton 
                    onClick={() => {
                        setSelectedTool("pencil")
                    }}
                    activated={selectedTool === "pencil"}
                    icon={<Pencil />}
                />
                <IconButton onClick={() => {
                    setSelectedTool("rect")
                }} activated={selectedTool === "rect"} icon={<RectangleHorizontalIcon />} ></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("circle")
                }} activated={selectedTool === "circle"} icon={<Circle />}></IconButton>
                <IconButton
                    onClick={() => {
                        if (selectedShapeId) {
                            onDeleteSelected();
                        }
                    }}
                    activated={Boolean(selectedShapeId)}
                    icon={<Trash2 />}
                />
                <div className="mx-1 h-8 w-px bg-border" />
                <StyleSwatches
                    icon={<Palette className="size-4" />}
                    colors={STROKE_COLORS}
                    selectedColor={shapeStyle.strokeColor}
                    onSelectColor={(strokeColor) => setShapeStyle({ ...shapeStyle, strokeColor: strokeColor ?? shapeStyle.strokeColor })}
                    swatchPrefix="Stroke"
                />
                <StyleSwatches
                    icon={<PaintBucket className="size-4" />}
                    colors={FILL_COLORS}
                    selectedColor={shapeStyle.fillColor}
                    onSelectColor={(fillColor) => setShapeStyle({ ...shapeStyle, fillColor })}
                    swatchPrefix="Fill"
                />
                <StrokeWidthControl
                    strokeWidth={shapeStyle.strokeWidth}
                    setStrokeWidth={(strokeWidth) => setShapeStyle({ ...shapeStyle, strokeWidth })}
                />
            </div>
        </div>
}

function StyleSwatches({
    icon,
    colors,
    selectedColor,
    onSelectColor,
    swatchPrefix
}: {
    icon: ReactNode,
    colors: (string | null)[],
    selectedColor: string | null,
    onSelectColor: (color: string | null) => void,
    swatchPrefix: string
}) {
    return <div className="flex items-center gap-1">
        <div className="flex size-8 items-center justify-center text-foreground">
            {icon}
        </div>
        {colors.map((color) => (
            <button
                key={color ?? "none"}
                type="button"
                aria-label={`${swatchPrefix} ${color ?? "none"}`}
                title={`${swatchPrefix} ${color ?? "none"}`}
                onClick={() => onSelectColor(color)}
                className={`flex size-7 items-center justify-center rounded-base border-2 border-border transition-transform hover:-translate-y-0.5 ${
                    selectedColor === color ? "ring-2 ring-black ring-offset-2" : ""
                }`}
                style={{ backgroundColor: color ?? "#ffffff" }}
            >
                {!color && <Ban className="size-4 text-foreground" />}
            </button>
        ))}
    </div>
}

function StrokeWidthControl({
    strokeWidth,
    setStrokeWidth
}: {
    strokeWidth: number,
    setStrokeWidth: (strokeWidth: number) => void
}) {
    return <div className="flex items-center gap-2">
        <Minus className="size-4" />
        <input
            aria-label="Stroke width"
            title="Stroke width"
            type="range"
            min={1}
            max={12}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="h-8 w-24 accent-black"
        />
        <div className="flex h-8 w-10 items-center justify-center rounded-base border-2 border-border bg-background">
            <div
                className="w-6 rounded-full bg-foreground"
                style={{ height: strokeWidth }}
            />
        </div>
        <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((width) => (
                <button
                    key={width}
                    type="button"
                    aria-label={`Stroke width ${width}`}
                    title={`Stroke width ${width}`}
                    onClick={() => setStrokeWidth(width)}
                    className={`flex size-7 items-center justify-center rounded-base border-2 border-border bg-secondary-background transition-transform hover:-translate-y-0.5 ${
                        strokeWidth === width ? "ring-2 ring-black ring-offset-2" : ""
                    }`}
                >
                    <div
                        className="w-4 rounded-full bg-foreground"
                        style={{ height: width }}
                    />
                </button>
            ))}
        </div>
    </div>
}
