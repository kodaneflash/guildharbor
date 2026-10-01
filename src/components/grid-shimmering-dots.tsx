"use client";

import { useCallback, useEffect, useRef } from "react";

export interface GridShimmeringDotsProps {
  gap?: number;
  dotSize?: number;
  speed?: number;
  opacity?: number;
  colors?: readonly string[];
  background?: string;
  height?: number | string;
}

const DEFAULTS = {
  gap: 25,
  dotSize: 3.5,
  speed: 49,
  opacity: 1,
  colors: ["#2a2a2a", "#3b3b3b", "#525252"] as const,
  background: "#0a0a0c",
  height: "100%" as const,
};

class Pixel {
  private readonly context: CanvasRenderingContext2D;
  private readonly x: number;
  private readonly y: number;
  private readonly color: string;
  private readonly speed: number;
  private readonly sizeStep: number;
  private readonly minSize = 0.5;
  private readonly dotSize: number;
  private readonly maxSize: number;
  private readonly delay: number;
  private readonly counterStep: number;
  private size = 0;
  private counter = 0;
  private isReverse = false;
  private isShimmering = false;

  constructor({
    width,
    height,
    context,
    x,
    y,
    color,
    speed,
    delay,
    dotSize,
    reducedMotion,
  }: {
    width: number;
    height: number;
    context: CanvasRenderingContext2D;
    x: number;
    y: number;
    color: string;
    speed: number;
    delay: number;
    dotSize: number;
    reducedMotion: boolean;
  }) {
    this.context = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.randomBetween(0.1, 0.9) * speed;
    this.sizeStep = Math.random() * 0.4;
    this.dotSize = dotSize;
    this.maxSize = this.randomBetween(this.minSize, dotSize);
    if (reducedMotion) {
      this.size = this.maxSize;
      this.isShimmering = true;
    }
    this.delay = delay;
    this.counterStep = Math.random() * 4 + (width + height) * 0.01;
  }

  private randomBetween(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  private draw() {
    const centerOffset = this.dotSize * 0.5 - this.size * 0.5;
    this.context.fillStyle = this.color;
    this.context.fillRect(
      this.x + centerOffset,
      this.y + centerOffset,
      this.size,
      this.size,
    );
  }

  private shimmer() {
    if (this.size >= this.maxSize) this.isReverse = true;
    else if (this.size <= this.minSize) this.isReverse = false;

    this.size += this.isReverse ? -this.speed : this.speed;
  }

  appear() {
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }

    if (this.size >= this.maxSize) this.isShimmering = true;
    if (this.isShimmering) this.shimmer();
    else this.size += this.sizeStep;
    this.draw();
  }
}

function getEffectiveSpeed(value: number, reducedMotion: boolean) {
  if (value <= 0 || reducedMotion) return 0;
  return Math.min(value, 100) * 0.001;
}

export function GridShimmeringDots({
  gap = DEFAULTS.gap,
  dotSize = DEFAULTS.dotSize,
  speed = DEFAULTS.speed,
  opacity = DEFAULTS.opacity,
  colors = DEFAULTS.colors,
  background = DEFAULTS.background,
  height = DEFAULTS.height,
}: GridShimmeringDotsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const reducedMotionRef = useRef(false);
  const lastFrameRef = useRef(0);

  const initialize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const { width: measuredWidth, height: measuredHeight } =
      container.getBoundingClientRect();
    const width = Math.floor(measuredWidth);
    const canvasHeight = Math.floor(measuredHeight);
    const context = canvas.getContext("2d");
    if (!context || width === 0 || canvasHeight === 0) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = width * devicePixelRatio;
    canvas.height = canvasHeight * devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${canvasHeight}px`;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    const gridGap = Math.max(1, Math.floor(gap));
    const normalizedDotSize = Math.max(1, dotSize);
    const effectiveSpeed = getEffectiveSpeed(
      speed,
      reducedMotionRef.current,
    );
    const diagonal = Math.hypot(width, canvasHeight);
    const colorList = colors.length > 0 ? colors : DEFAULTS.colors;
    const pixels: Pixel[] = [];

    for (let x = 0; x < width; x += gridGap) {
      for (let y = 0; y < canvasHeight; y += gridGap) {
        pixels.push(
          new Pixel({
            width,
            height: canvasHeight,
            context,
            x,
            y,
            color: colorList[Math.floor(Math.random() * colorList.length)],
            speed: effectiveSpeed,
            delay: reducedMotionRef.current ? 0 : Math.random() * diagonal * 0.5,
            dotSize: normalizedDotSize,
            reducedMotion: reducedMotionRef.current,
          }),
        );
      }
    }

    pixelsRef.current = pixels;
  }, [colors, dotSize, gap, speed]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      reducedMotionRef.current = reducedMotion.matches;
      initialize();
    };

    reducedMotionRef.current = reducedMotion.matches;
    reducedMotion.addEventListener("change", updateMotionPreference);
    return () =>
      reducedMotion.removeEventListener("change", updateMotionPreference);
  }, [initialize]);

  useEffect(() => {
    initialize();
    const observer = new ResizeObserver(initialize);
    const container = containerRef.current;
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [initialize]);

  useEffect(() => {
    let animationFrame = 0;
    const frameInterval = 1000 / 60;

    const tick = (now: number) => {
      animationFrame = requestAnimationFrame(tick);
      const elapsed = now - lastFrameRef.current;
      if (elapsed < frameInterval) return;
      lastFrameRef.current = now - (elapsed % frameInterval);

      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      const devicePixelRatio = window.devicePixelRatio || 1;
      context.clearRect(
        0,
        0,
        canvas.width / devicePixelRatio,
        canvas.height / devicePixelRatio,
      );
      for (const pixel of pixelsRef.current) pixel.appear();
    };

    lastFrameRef.current = performance.now();
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ height, background }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        style={{ opacity }}
      />
    </div>
  );
}
