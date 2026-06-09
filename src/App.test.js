import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App";

test("renders app header", () => {
  render(<App />);
  expect(screen.getByText(/Cyra/i)).toBeInTheDocument();
});

test("renders current month name", () => {
  render(<App />);
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const currentMonth = months[new Date().getMonth()];
  expect(screen.getByText(new RegExp(currentMonth, "i"))).toBeInTheDocument();
});

test("log period button is present", () => {
  render(<App />);
  expect(screen.getByText(/Log Period/i)).toBeInTheDocument();
});

test("shows cycles logged stat", () => {
  render(<App />);
  expect(screen.getByText(/Cycles logged/i)).toBeInTheDocument();
});

test("cancel button appears after clicking log period", () => {
  render(<App />);
  const logBtn = screen.getByText(/Log Period/i);
  fireEvent.click(logBtn);
  expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
});