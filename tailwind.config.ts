import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        role: {
          dev: "hsl(var(--role-dev))",
          admin: "hsl(var(--role-admin))",
          gerente: "hsl(var(--role-gerente))",
          vendedor: "hsl(var(--role-vendedor))",
          criacao: "hsl(var(--role-criacao))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "marquee": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(251, 191, 36, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(251, 191, 36, 0)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "float-up": {
          "0%": { 
            opacity: "1", 
            transform: "translateY(0) scale(1)" 
          },
          "50%": { 
            opacity: "1", 
            transform: "translateY(-150px) scale(1.2)" 
          },
          "100%": { 
            opacity: "0", 
            transform: "translateY(-300px) scale(0.8)" 
          },
        },
        "paper-ball-throw": {
          "0%": {
            opacity: "0",
            transform: "translate(-50%, -50%) scale(0.3) rotate(0deg)",
          },
          "15%": {
            opacity: "1",
            transform: "translate(-30%, -100%) scale(1.2) rotate(180deg)",
          },
          "40%": {
            transform: "translate(0%, -150%) scale(1) rotate(360deg)",
          },
          "70%": {
            transform: "translate(30%, -50%) scale(1.1) rotate(540deg)",
          },
          "85%": {
            opacity: "1",
            transform: "translate(45%, 20%) scale(1.3) rotate(720deg)",
          },
          "100%": {
            opacity: "0",
            transform: "translate(50%, 50%) scale(0.5) rotate(900deg)",
          },
        },
        "paper-ball-impact": {
          "0%": {
            transform: "scale(1)",
          },
          "20%": {
            transform: "scale(1.15) rotate(-3deg)",
          },
          "40%": {
            transform: "scale(0.95) rotate(2deg)",
          },
          "60%": {
            transform: "scale(1.05) rotate(-1deg)",
          },
          "80%": {
            transform: "scale(0.98) rotate(1deg)",
          },
          "100%": {
            transform: "scale(1) rotate(0deg)",
          },
        },
        "splat": {
          "0%": {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(0.5)",
          },
          "50%": {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1.5)",
          },
          "100%": {
            opacity: "0",
            transform: "translate(-50%, -50%) scale(2)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in-from-left 0.3s ease-out",
        "marquee": "marquee 20s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "bounce-gentle": "bounce-gentle 1s ease-in-out infinite",
        "float-up": "float-up 3s ease-out forwards",
        "paper-ball-throw": "paper-ball-throw 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "paper-ball-impact": "paper-ball-impact 0.4s ease-out",
        "splat": "splat 0.5s ease-out forwards",
      },
      boxShadow: {
        primary: "var(--shadow-primary)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
