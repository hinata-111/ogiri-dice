import { describe, expect, it } from "vitest";
import { computeCamera } from "./camera";

const viewSize = { width: 1280, height: 960 };
const focus = { x: 280, y: 320 };
const mapBounds = { x: -80, y: 20, width: 1440, height: 820 };

describe("computeCamera", () => {
  it("centers the current player in follow mode at scale 1", () => {
    expect(computeCamera("follow", focus, viewSize, mapBounds)).toEqual({
      x: 360,
      y: 160,
      scale: 1,
    });
  });

  it("zooms in while keeping the current player centered in moving mode", () => {
    expect(computeCamera("moving", focus, viewSize, mapBounds)).toEqual({
      x: 318,
      y: 112,
      scale: 1.15,
    });
  });

  it("zooms further for destination reveal mode", () => {
    expect(computeCamera("reveal", focus, viewSize, mapBounds)).toEqual({
      x: 276,
      y: 64,
      scale: 1.3,
    });
  });

  it("fits the whole map bounds in overview mode and centers the map", () => {
    const camera = computeCamera("overview", focus, viewSize, mapBounds);
    expect(camera.scale).toBeCloseTo(0.8888888888888888);
    expect(camera.x).toBeCloseTo(71.11111111111109);
    expect(camera.y).toBeCloseTo(97.77777777777777);
  });
});
