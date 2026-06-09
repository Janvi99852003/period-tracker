import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App";

// ── Smoke test ───────────────────────────────────────────────────────────────
test("renders app header", () => {
  render(<App />);
  expect(screen.getByText(/FemFlow/i)).toBeInTheDocument();
});

// ── Calendar renders ─────────────────────────────────────────────────────────
test("renders current month name", () => {
  render(<App />);
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const currentMonth = months[new Date().getMonth()];
  expect(screen.getByText(new RegExp(currentMonth, "i"))).toBeInTheDocument();
});

// ── Log Period button exists ──────────────────────────────────────────────────
test("log period button is present", () => {
  render(<App />);
  expect(screen.getByText(/Log Period/i)).toBeInTheDocument();
});

// ── Stats render ──────────────────────────────────────────────────────────────
test("shows cycles logged stat", () => {
  render(<App />);
  expect(screen.getByText(/Cycles logged/i)).toBeInTheDocument();
});

// ── Cancel button appears when marking mode is active ────────────────────────
test("cancel button appears after clicking log period", () => {
  render(<App />);
  fireEvent.click(screen.getByText(/Log Period/i));
  expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
});