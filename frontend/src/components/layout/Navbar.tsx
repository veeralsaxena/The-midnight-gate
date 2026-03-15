"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/simulation", label: "Simulator", icon: "rocket_launch" },
  { href: "/admin", label: "War Room", icon: "shield_with_heart" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav
      className={`fixed top-0 z-[100] w-full transition-all duration-500 animate-nav-slide-down ${
        scrolled
          ? "bg-[#0A0A16]/90 backdrop-blur-xl border-b border-[#00F0FF]/15 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#00F0FF]/10 text-[#00F0FF] group-hover:bg-[#00F0FF]/20 group-hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all duration-300">
            <span className="material-symbols-outlined text-2xl">security</span>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white hidden sm:block">
            The Midnight Gate
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 group ${
                  isActive
                    ? "text-[#00F0FF]"
                    : "text-[#8F9BB3] hover:text-white"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-lg transition-all duration-300 ${
                    isActive
                      ? "text-[#00F0FF] drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]"
                      : "group-hover:text-white"
                  }`}
                >
                  {link.icon}
                </span>
                {link.label}

                {/* Active indicator — glowing underline */}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.6)] animate-nav-glow" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Desktop CTA — hidden on /simulation page */}
        {pathname !== "/simulation" && (
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/simulation"
              className="rounded-full bg-[#00F0FF] px-5 py-2 text-sm font-bold text-[#0A0A16] transition-all hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] active:scale-95"
            >
              Start Simulation
            </Link>
          </div>
        )}

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-[2px] w-6 bg-[#00F0FF] rounded transition-all duration-300 ${
              menuOpen ? "rotate-45 translate-y-[5px]" : ""
            }`}
          />
          <span
            className={`block h-[2px] w-6 bg-[#00F0FF] rounded transition-all duration-300 ${
              menuOpen ? "opacity-0 scale-x-0" : ""
            }`}
          />
          <span
            className={`block h-[2px] w-6 bg-[#00F0FF] rounded transition-all duration-300 ${
              menuOpen ? "-rotate-45 -translate-y-[5px]" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-400 ease-in-out ${
          menuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-[#0A0A16]/95 backdrop-blur-xl border-t border-[#00F0FF]/10 px-6 py-4 flex flex-col gap-1">
          {navLinks.map((link, i) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20"
                    : "text-[#8F9BB3] hover:bg-white/5 hover:text-white"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span
                  className={`material-symbols-outlined text-xl ${
                    isActive ? "text-[#00F0FF] drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" : ""
                  }`}
                >
                  {link.icon}
                </span>
                {link.label}
                {isActive && (
                  <span className="ml-auto relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F0FF] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00F0FF]" />
                  </span>
                )}
              </Link>
            );
          })}
          {pathname !== "/simulation" && (
            <Link
              href="/simulation"
              className="mt-3 w-full text-center rounded-xl bg-[#00F0FF] py-3 text-sm font-bold text-[#0A0A16] transition-all active:scale-[0.98]"
            >
              Start Simulation
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
