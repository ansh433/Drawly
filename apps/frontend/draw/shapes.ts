export type Point = {
    x: number;
    y: number;
};

export type ShapeStyle = {
    strokeColor: string;
    fillColor: string | null;
    strokeWidth: number;
};

export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
    strokeColor: "#ffffff",
    fillColor: null,
    strokeWidth: 2
};

type RectangleGeometry = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type CircleGeometry = {
    centerX: number;
    centerY: number;
    radius: number;
};

type PencilGeometry = {
    points: Point[];
};

export type RectangleData = RectangleGeometry & ShapeStyle;
export type CircleData = CircleGeometry & ShapeStyle;
export type PencilData = PencilGeometry & ShapeStyle;

export type Shape =
    | ({ id?: string; type: "rect" } & RectangleData)
    | ({ id?: string; type: "circle" } & CircleData)
    | ({ id?: string; type: "pencil" } & PencilData);

export type PersistedShape =
    | {
        id: string;
        type: "rect";
        data: RectangleData;
    }
    | {
        id: string;
        type: "circle";
        data: CircleData;
    }
    | {
        id: string;
        type: "pencil";
        data: PencilData;
    };

export function applyDefaultStyle<T extends Partial<ShapeStyle>>(data: T): T & ShapeStyle {
    return {
        ...data,
        strokeColor: data.strokeColor ?? DEFAULT_SHAPE_STYLE.strokeColor,
        fillColor: data.fillColor ?? DEFAULT_SHAPE_STYLE.fillColor,
        strokeWidth: data.strokeWidth ?? DEFAULT_SHAPE_STYLE.strokeWidth
    };
}

export function shapeFromRecord(shape: PersistedShape): Shape {
    switch (shape.type) {
        case "rect":
            return { id: shape.id, type: "rect", ...applyDefaultStyle(shape.data) };
        case "circle":
            return { id: shape.id, type: "circle", ...applyDefaultStyle(shape.data) };
        case "pencil":
            return { id: shape.id, type: "pencil", ...applyDefaultStyle({ ...shape.data, fillColor: null }) };
    }
}

export function shapeToPayload(shape: Shape) {
    if (shape.type === "rect") {
        return {
            shapeType: "rect",
            data: {
                x: shape.x,
                y: shape.y,
                width: shape.width,
                height: shape.height,
                strokeColor: shape.strokeColor,
                fillColor: shape.fillColor,
                strokeWidth: shape.strokeWidth
            }
        };
    }

    if (shape.type === "circle") {
        return {
            shapeType: "circle",
            data: {
                centerX: shape.centerX,
                centerY: shape.centerY,
                radius: shape.radius,
                strokeColor: shape.strokeColor,
                fillColor: shape.fillColor,
                strokeWidth: shape.strokeWidth
            }
        };
    }

    return {
        shapeType: "pencil",
        data: {
            points: shape.points,
            strokeColor: shape.strokeColor,
            fillColor: null,
            strokeWidth: shape.strokeWidth
        }
    };
}
