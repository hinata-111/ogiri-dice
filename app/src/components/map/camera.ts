export type CameraMode = "follow" | "moving" | "reveal" | "overview";

export interface Point {
  x: number;
  y: number;
}

export interface ViewSize {
  width: number;
  height: number;
}

export interface MapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraState {
  x: number;
  y: number;
  scale: number;
}

const MODE_SCALE: Record<Exclude<CameraMode, "overview">, number> = {
  follow: 1,
  moving: 1.15,
  reveal: 1.3,
};

export function computeCamera(
  mode: CameraMode,
  focus: Point,
  viewSize: ViewSize,
  mapBounds: MapBounds,
): CameraState {
  if (mode === "overview") {
    const scale = Math.min(viewSize.width / mapBounds.width, viewSize.height / mapBounds.height);
    const center = {
      x: mapBounds.x + mapBounds.width / 2,
      y: mapBounds.y + mapBounds.height / 2,
    };
    return centerOn(center, viewSize, scale);
  }

  return centerOn(focus, viewSize, MODE_SCALE[mode]);
}

function centerOn(point: Point, viewSize: ViewSize, scale: number): CameraState {
  return {
    x: viewSize.width / 2 - point.x * scale,
    y: viewSize.height / 2 - point.y * scale,
    scale,
  };
}
