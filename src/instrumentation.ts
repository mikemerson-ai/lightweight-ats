export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (typeof globalThis.DOMMatrix === "undefined") {
      (globalThis as any).DOMMatrix = class DOMMatrix {
        matrix = [1, 0, 0, 1, 0, 0];
      };
    }
    if (typeof globalThis.ImageData === "undefined") {
      (globalThis as any).ImageData = class ImageData {};
    }
    if (typeof globalThis.Path2D === "undefined") {
      (globalThis as any).Path2D = class Path2D {};
    }
  }
}