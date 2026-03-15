"use client";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export const SparklesCore = ({
  background,
  minSize,
  maxSize,
  particleDensity,
  className,
  particleColor,
}: {
  background?: string;
  minSize?: number;
  maxSize?: number;
  particleDensity?: number;
  className?: string;
  particleColor?: string;
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [particleArray, setParticleArray] = useState<Array<{
    width: number;
    height: number;
    top: string;
    left: string;
    duration: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      setParticleArray(
        Array.from({ length: particleDensity || 50 }).map(() => ({
          width: Math.random() * (maxSize || 2) + (minSize || 0.5),
          height: Math.random() * (maxSize || 2) + (minSize || 0.5),
          top: Math.random() * 100 + "%",
          left: Math.random() * 100 + "%",
          duration: Math.random() * 3 + 2,
          delay: Math.random() * 3,
        }))
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [particleDensity, maxSize, minSize]);

  if (!isMounted) return <div className={className} style={{ background }} />;

  return (
    <div className={className} style={{ background }}>
      {particleArray.map((p, i: number) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            backgroundColor: particleColor || "#FFF",
            width: p.width,
            height: p.height,
            top: p.top,
            left: p.left,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay,
          }}
        />
      ))}
    </div>
  );
};
