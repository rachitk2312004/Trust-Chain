import nativewindPreset from "nativewind/preset";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: {
        ink: "#0b1f33",
        accent: "#0e7c66",
      },
    },
  },
  plugins: [],
};
