import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app", () => {
  render(<App />);
  expect(document.querySelector("div")).toBeInTheDocument();
});

test("renders current year", () => {
  render(<App />);
  expect(screen.getByText(new RegExp(new Date().getFullYear().toString()))).toBeInTheDocument();
});

test("renders cycles logged", () => {
  render(<App />);
  expect(screen.getByText(/Cycles logged/i)).toBeInTheDocument();
});

test("renders avg cycle stat", () => {
  render(<App />);
  expect(screen.getByText(/Avg cycle/i)).toBeInTheDocument();
});

test("renders period days stat", () => {
  render(<App />);
  expect(screen.getByText(/Period days/i)).toBeInTheDocument();
}); 