import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, MousePointer2, Pencil, RectangleHorizontalIcon, Trash2 } from "lucide-react";
import { Game } from "@/draw/Game";

export type Tool = "circle" | "rect" | "pencil" | "select";

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

    useEffect(() => {
        game?.setTool(selectedTool);
    }, [selectedTool, game]);

    useEffect(() => {

        if (canvasRef.current) {
            const g = new Game(canvasRef.current, roomId, socket, setSelectedShapeId);
            setGame(g);

            return () => {
                g.destroy();
            }
        }


    }, [canvasRef]);

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
        />
    </div>
}

function Topbar({selectedTool, setSelectedTool, selectedShapeId, onDeleteSelected}: {
    selectedTool: Tool,
    setSelectedTool: (s: Tool) => void,
    selectedShapeId: string | null,
    onDeleteSelected: () => void
}) {
    return <div style={{
            position: "fixed",
            top: 10,
            left: 10
        }}>
            <div className="flex gap-t">
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
            </div>
        </div>
}
